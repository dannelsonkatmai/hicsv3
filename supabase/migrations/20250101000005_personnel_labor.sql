/*
  # Labor pool, temporary/volunteer personnel, time tracking

  1. New Tables
    - `labor_pool_entries` — staff checked into the labor pool during an
      incident: availability, skills, and current assignment.
    - `temporary_personnel` — temp hires, agency staff, credentialed
      volunteers (HICS 253 intake), and internal reassignments, with
      credential-verification status (PII, protected by tenant RLS).
    - `time_entries` — HICS 252-style personnel time records feeding labor
      cost analysis.
    - `staffing_requirements` — needed vs. on-hand by role/unit to surface
      staffing gaps.

  2. Security
    - Standard tenant RLS on all tables.
*/

CREATE TABLE IF NOT EXISTS labor_pool_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  role_or_skill text DEFAULT '',
  department text DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'assigned', 'on_break', 'released')),
  current_assignment text DEFAULT '',
  assigned_unit text DEFAULT '',
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS temporary_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  personnel_category text NOT NULL DEFAULT 'volunteer'
    CHECK (personnel_category IN ('volunteer', 'agency', 'temp_hire', 'internal_reassignment', 'mutual_aid')),
  phone text DEFAULT '',
  email text DEFAULT '',
  organization_name text DEFAULT '',
  license_type text DEFAULT '',
  license_number text DEFAULT '',
  license_state text DEFAULT '',
  license_expires date,
  credential_status text NOT NULL DEFAULT 'pending'
    CHECK (credential_status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  privileges_granted text DEFAULT '',
  assignment text DEFAULT '',
  badge_issued boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  section text NOT NULL DEFAULT 'operations',
  position_title text DEFAULT '',
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  time_in timestamptz,
  time_out timestamptz,
  hours numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  overtime boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staffing_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  unit_or_area text NOT NULL,
  role_needed text NOT NULL,
  needed_count integer NOT NULL DEFAULT 0,
  on_hand_count integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['labor_pool_entries', 'temporary_personnel', 'time_entries', 'staffing_requirements']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
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
      'CREATE POLICY "tenant_delete_%s" ON %I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON %I', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_labor_pool_incident ON labor_pool_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_temp_personnel_tenant ON temporary_personnel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_incident ON time_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_staffing_reqs_incident ON staffing_requirements(incident_id);
