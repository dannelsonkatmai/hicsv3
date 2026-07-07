/*
  # Incident core: incidents, operational periods, HIMT, objectives, JAS/IRG

  1. New Tables
    - `incidents` — declared events/exercises/drills with activation level,
      severity, status lifecycle, and training-mode flag.
    - `operational_periods` — bounded windows each IAP covers.
    - `himt_positions` — GLOBAL catalog of HICS positions (tenant_id NULL =
      standard set; tenants may add their own rows).
    - `himt_assignments` — person → position per incident (the org chart).
    - `objectives` — incident objectives per operational period.
    - `incident_tasks` — work items delegated to sections/positions.
    - `jas_templates` — Job Action Sheet checklists per position (global +
      tenant-custom), items stored as jsonb.
    - `jas_progress` — per-incident, per-assignment checklist state.
    - `irg_templates` — Incident Response Guides for common scenarios (global +
      tenant-custom).

  2. Security
    - RLS on everything. Global catalog rows (tenant_id IS NULL) are readable
      by all authenticated users but only writable within one's own tenant.
*/

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  name text NOT NULL,
  incident_number text DEFAULT '',
  incident_type text NOT NULL DEFAULT 'real'
    CHECK (incident_type IN ('real', 'exercise', 'drill', 'planned_event')),
  scenario text DEFAULT '',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'demobilizing', 'closed')),
  severity text NOT NULL DEFAULT 'moderate'
    CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  activation_level text NOT NULL DEFAULT 'full'
    CHECK (activation_level IN ('monitoring', 'partial', 'full')),
  is_training boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  description text DEFAULT '',
  command_location text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operational_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  period_number integer NOT NULL DEFAULT 1,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT now() + interval '12 hours',
  is_current boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS himt_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  section text NOT NULL DEFAULT 'command'
    CHECK (section IN ('command', 'operations', 'planning', 'logistics', 'finance')),
  parent_code text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS himt_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  position_title text NOT NULL DEFAULT '',
  section text NOT NULL DEFAULT 'command',
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  assignee_name text NOT NULL DEFAULT '',
  contact_info text DEFAULT '',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  description text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'carried_over')),
  owner_section text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  objective_id uuid REFERENCES objectives(id) ON DELETE SET NULL,
  title text NOT NULL,
  detail text DEFAULT '',
  assigned_section text DEFAULT '',
  assigned_position text DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done')),
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jas_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jas_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES himt_assignments(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  checked_items jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS irg_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  scenario_type text NOT NULL DEFAULT 'other',
  phases jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  -- Standard tenant tables
  FOREACH t IN ARRAY ARRAY['incidents', 'operational_periods', 'himt_assignments', 'objectives', 'incident_tasks', 'jas_progress']
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
  END LOOP;

  -- Global catalogs: standard rows (tenant_id IS NULL) readable by everyone;
  -- tenant-custom rows scoped to the tenant.
  FOREACH t IN ARRAY ARRAY['himt_positions', 'jas_templates', 'irg_templates']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "catalog_select_%s" ON %I FOR SELECT TO authenticated USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "catalog_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "catalog_update_%s" ON %I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id())',
      t, t);
    EXECUTE format(
      'CREATE POLICY "catalog_delete_%s" ON %I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id())',
      t, t);
  END LOOP;

  -- updated_at triggers
  FOREACH t IN ARRAY ARRAY['incidents', 'operational_periods', 'himt_positions', 'himt_assignments', 'objectives', 'incident_tasks', 'jas_templates', 'jas_progress', 'irg_templates']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON %I', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_op_periods_incident ON operational_periods(incident_id);
CREATE INDEX IF NOT EXISTS idx_himt_assignments_incident ON himt_assignments(incident_id);
CREATE INDEX IF NOT EXISTS idx_objectives_incident ON objectives(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_tasks_incident ON incident_tasks(incident_id);
