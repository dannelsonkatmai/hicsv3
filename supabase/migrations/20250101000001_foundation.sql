/*
  # Foundation: tenancy, identity, roles, RLS helpers

  1. New Tables
    - `organizations` — the tenant. Subscription/plan state, branding, settings,
      invite code for joining, Stripe linkage.
    - `facilities` — physical hospital/campus within an organization.
    - `units` — nursing/clinical units within a facility (licensed + surge beds).
    - `profiles` — one row per auth user; carries `tenant_id` and platform role.
      Created automatically by trigger when an auth user signs up.
    - `personnel` — staff & external contact directory (superset of users:
      not every contact logs in). Credentials/skills for labor-pool matching.
    - `permission_settings` — data-driven permission matrix overrides per tenant
      (who may declare incidents, approve IAPs, approval cost thresholds, ...).

  2. Security
    - RLS enabled on every table.
    - `current_tenant_id()` / `current_platform_role()` helper functions
      (SECURITY DEFINER) drive all tenant-isolation policies.
    - Users read rows only in their own organization; writes additionally
      require membership; org administration restricted to admin roles.
    - `setup_organization` RPC bootstraps a new tenant for a fresh signup.
    - `join_organization` RPC lets a user join an existing tenant by invite code.

  3. Notes
    - Text + CHECK constraints are used instead of Postgres enums so values can
      evolve without destructive migrations.
    - `updated_at` is maintained by trigger on every table that has the column.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  plan text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'standard', 'professional', 'enterprise')),
  subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  seats integer NOT NULL DEFAULT 25,
  stripe_customer_id text,
  stripe_subscription_id text,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_retention_days integer NOT NULL DEFAULT 3650,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text DEFAULT '',
  city text DEFAULT '',
  state text DEFAULT '',
  zip text DEFAULT '',
  phone text DEFAULT '',
  licensed_beds integer NOT NULL DEFAULT 100,
  facility_type text NOT NULL DEFAULT 'acute_care',
  is_primary boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'med_surg'
    CHECK (unit_type IN ('ed', 'icu', 'med_surg', 'peds', 'ob', 'periop', 'behavioral', 'stepdown', 'other')),
  licensed_beds integer NOT NULL DEFAULT 0,
  surge_beds integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  platform_role text NOT NULL DEFAULT 'responder'
    CHECK (platform_role IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager', 'responder', 'viewer', 'auditor')),
  facility_ids uuid[] NOT NULL DEFAULT '{}',
  department text DEFAULT '',
  job_title text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  personnel_type text NOT NULL DEFAULT 'staff'
    CHECK (personnel_type IN ('staff', 'external_contact', 'agency', 'volunteer', 'vendor_contact', 'mutual_aid')),
  email text DEFAULT '',
  phone text DEFAULT '',
  pager text DEFAULT '',
  department text DEFAULT '',
  job_title text DEFAULT '',
  credentials jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills text[] NOT NULL DEFAULT '{}',
  callback_notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action text NOT NULL,
  allowed_platform_roles text[] NOT NULL DEFAULT '{}',
  allowed_incident_positions text[] NOT NULL DEFAULT '{}',
  cost_threshold numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, action)
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_platform_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT platform_role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin'), false);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Auto-create a profile row for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bootstrap a brand-new tenant for the calling user (onboarding wizard).
CREATE OR REPLACE FUNCTION public.setup_organization(org_name text, facility_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  new_facility_id uuid;
BEGIN
  IF (SELECT tenant_id FROM profiles WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  INSERT INTO organizations (name) VALUES (org_name) RETURNING id INTO new_org_id;

  INSERT INTO facilities (tenant_id, name, is_primary)
  VALUES (new_org_id, facility_name, true)
  RETURNING id INTO new_facility_id;

  UPDATE profiles
  SET tenant_id = new_org_id,
      platform_role = 'org_admin',
      facility_ids = ARRAY[new_facility_id]
  WHERE id = auth.uid();

  RETURN new_org_id;
END;
$$;

-- Join an existing tenant using its invite code.
CREATE OR REPLACE FUNCTION public.join_organization(code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
BEGIN
  IF (SELECT tenant_id FROM profiles WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  SELECT id INTO org_id FROM organizations WHERE invite_code = code;
  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  UPDATE profiles SET tenant_id = org_id, platform_role = 'responder' WHERE id = auth.uid();
  RETURN org_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_settings ENABLE ROW LEVEL SECURITY;

-- organizations: members see their own org; only org admins modify it.
CREATE POLICY "org_select_own" ON organizations FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());
CREATE POLICY "org_update_admin" ON organizations FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND public.current_platform_role() IN ('super_admin', 'org_admin'))
  WITH CHECK (id = public.current_tenant_id());

-- profiles: read teammates; edit self; admins edit tenant members.
CREATE POLICY "profiles_select_tenant" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (tenant_id IS NOT NULL AND tenant_id = public.current_tenant_id()));
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_admin())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Standard tenant-isolation policies for the remaining foundation tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['facilities', 'units', 'personnel', 'permission_settings']
  LOOP
    EXECUTE format(
      'CREATE POLICY "tenant_select_%s" ON %I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "tenant_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "tenant_update_%s" ON %I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "tenant_delete_%s" ON %I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND public.is_admin())',
      t, t);
  END LOOP;
END $$;

-- updated_at maintenance
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations', 'facilities', 'units', 'profiles', 'personnel', 'permission_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON %I', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_facilities_tenant ON facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_facility ON units(facility_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_personnel_tenant ON personnel(tenant_id);
