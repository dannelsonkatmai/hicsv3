/*
  # Situational awareness: status boards, SitReps, aggregate patient tracking

  IMPORTANT — NO-PHI RULE: every table in this migration stores AGGREGATE
  COUNTS AND STATUS ONLY. There are deliberately no columns for names, MRNs,
  DOBs, or any patient identifier, and none may ever be added. Patient-related
  HICS forms (254/255/259/260) are implemented in count/status mode.

  1. New Tables
    - `bed_status_entries` — live bed board per unit (staffed / occupied /
      available / blocked / surge). One current row per unit; snapshots are
      copies stamped with an operational period.
    - `acuity_entries` — counts by triage/acuity category per area.
    - `supply_status_entries` — critical item on-hand, burn rate, days-on-hand.
    - `staffing_status_entries` — on-hand vs needed by role/unit for the board.
    - `facility_system_status` — HICS 251-style utilities/infrastructure
      red/yellow/green board.
    - `sitreps` — point-in-time situation report per operational period.
    - `patient_tracking_summaries` — aggregate counts by category/status/
      destination (HICS 254/255/260 in count mode).
    - `casualty_summaries` — aggregate casualty/fatality counts (HICS 259).
    - `reunification_log` — family-reunification workflow counts only.

  2. Security
    - Standard tenant RLS.
  3. Realtime
    - Board tables are added to the `supabase_realtime` publication so command
      post displays update live.
*/

CREATE TABLE IF NOT EXISTS bed_status_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES units(id) ON DELETE SET NULL,
  unit_name text NOT NULL,
  bed_type text NOT NULL DEFAULT 'med_surg',
  staffed_beds integer NOT NULL DEFAULT 0,
  occupied_beds integer NOT NULL DEFAULT 0,
  available_beds integer NOT NULL DEFAULT 0,
  blocked_beds integer NOT NULL DEFAULT 0,
  surge_beds_available integer NOT NULL DEFAULT 0,
  divert_status text NOT NULL DEFAULT 'open' CHECK (divert_status IN ('open', 'partial', 'divert')),
  is_snapshot boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acuity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  area text NOT NULL DEFAULT 'ED',
  category text NOT NULL DEFAULT 'immediate'
    CHECK (category IN ('immediate', 'delayed', 'minimal', 'expectant', 'deceased', 'icu', 'med_surg', 'peds', 'other')),
  patient_count integer NOT NULL DEFAULT 0,
  is_snapshot boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_status_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  category text NOT NULL DEFAULT 'supplies',
  on_hand numeric NOT NULL DEFAULT 0,
  unit_of_measure text DEFAULT 'each',
  burn_rate_per_day numeric NOT NULL DEFAULT 0,
  days_on_hand numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
  is_snapshot boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staffing_status_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  unit_or_area text NOT NULL,
  role text NOT NULL,
  on_hand integer NOT NULL DEFAULT 0,
  needed integer NOT NULL DEFAULT 0,
  is_snapshot boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_system_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  system_name text NOT NULL,
  status text NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red', 'unknown')),
  comments text DEFAULT '',
  estimated_restoration text DEFAULT '',
  is_snapshot boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sitreps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  sitrep_number integer NOT NULL DEFAULT 1,
  reported_at timestamptz NOT NULL DEFAULT now(),
  summary text DEFAULT '',
  current_situation text DEFAULT '',
  actions_taken text DEFAULT '',
  resource_needs text DEFAULT '',
  next_steps text DEFAULT '',
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  prepared_by_name text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patient_tracking_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  tracking_type text NOT NULL DEFAULT 'tracking'
    CHECK (tracking_type IN ('tracking', 'evacuation')),
  category text NOT NULL DEFAULT 'immediate',
  unit_or_area text DEFAULT '',
  destination text DEFAULT '',
  status text NOT NULL DEFAULT 'in_place'
    CHECK (status IN ('in_place', 'awaiting_transport', 'in_transit', 'arrived', 'discharged', 'other')),
  patient_count integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casualty_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'treated_released'
    CHECK (category IN ('treated_released', 'admitted', 'transferred', 'expired', 'morgue', 'other')),
  patient_count integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reunification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  inquiries_received integer NOT NULL DEFAULT 0,
  inquiries_resolved integer NOT NULL DEFAULT 0,
  reunifications_completed integer NOT NULL DEFAULT 0,
  pending_cases integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bed_status_entries', 'acuity_entries', 'supply_status_entries', 'staffing_status_entries', 'facility_system_status', 'sitreps', 'patient_tracking_summaries', 'casualty_summaries', 'reunification_log']
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

-- Live board updates across the command post.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bed_status_entries', 'acuity_entries', 'supply_status_entries', 'staffing_status_entries', 'facility_system_status']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_bed_status_tenant ON bed_status_entries(tenant_id, is_snapshot);
CREATE INDEX IF NOT EXISTS idx_acuity_incident ON acuity_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_supply_status_incident ON supply_status_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_fss_tenant ON facility_system_status(tenant_id, is_snapshot);
CREATE INDEX IF NOT EXISTS idx_sitreps_incident ON sitreps(incident_id);
CREATE INDEX IF NOT EXISTS idx_pt_summaries_incident ON patient_tracking_summaries(incident_id);
