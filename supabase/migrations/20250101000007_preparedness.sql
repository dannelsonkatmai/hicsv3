/*
  # Preparedness program: HVA, EOP, exercises, AAR/CAPA, compliance

  1. New Tables
    - `hva_entries` — Hazard Vulnerability Analysis rows with Kaiser-style
      probability/impact scoring; relative risk computed in the app.
    - `plan_documents` — EOP + annexes with version metadata and review cycle.
    - `exercises` — tabletop / functional / full-scale / drills and real
      activations, with CMS exercise-type tracking and real-event exemption.
    - `aar_reports` — After-Action Report / Improvement Plan per exercise or
      incident.
    - `corrective_actions` — CAPA items with owner, due date, status.
    - `compliance_requirements` — GLOBAL seeded library (tenant_id IS NULL) of
      CMS EP Rule + Joint Commission EM elements; versioned.
    - `compliance_statuses` — per-tenant status against each requirement.
    - `compliance_evidence` — evidence records (documents, exercise refs,
      attestations) attached to a requirement.
    - `training_records` — staff training/education tracking for compliance.
    - `app_documents` — metadata for files kept in Supabase Storage
      (tenant-scoped paths, versioned).

  2. Security
    - Standard tenant RLS; the requirement library is world-readable
      (authenticated) for global rows.
*/

CREATE TABLE IF NOT EXISTS hva_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  hazard_name text NOT NULL,
  hazard_category text NOT NULL DEFAULT 'natural'
    CHECK (hazard_category IN ('natural', 'technological', 'human', 'hazmat', 'public_health')),
  probability integer NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 3),
  human_impact integer NOT NULL DEFAULT 0 CHECK (human_impact BETWEEN 0 AND 3),
  property_impact integer NOT NULL DEFAULT 0 CHECK (property_impact BETWEEN 0 AND 3),
  business_impact integer NOT NULL DEFAULT 0 CHECK (business_impact BETWEEN 0 AND 3),
  preparedness integer NOT NULL DEFAULT 0 CHECK (preparedness BETWEEN 0 AND 3),
  internal_response integer NOT NULL DEFAULT 0 CHECK (internal_response BETWEEN 0 AND 3),
  external_response integer NOT NULL DEFAULT 0 CHECK (external_response BETWEEN 0 AND 3),
  notes text DEFAULT '',
  assessment_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'eop'
    CHECK (doc_type IN ('eop', 'annex', 'policy', 'irg', 'other')),
  version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'under_review', 'archived')),
  storage_path text DEFAULT '',
  content text DEFAULT '',
  effective_date date,
  next_review_date date,
  owner_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  title text NOT NULL,
  exercise_type text NOT NULL DEFAULT 'drill'
    CHECK (exercise_type IN ('tabletop', 'functional', 'full_scale', 'drill', 'real_event')),
  drill_category text DEFAULT ''
    CHECK (drill_category IN ('', 'fire', 'evacuation', 'active_threat', 'decon', 'utility_failure', 'mass_casualty', 'severe_weather', 'other')),
  scenario text DEFAULT '',
  objectives text DEFAULT '',
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  is_community_based boolean NOT NULL DEFAULT false,
  counts_toward_cms boolean NOT NULL DEFAULT true,
  cms_exemption_claimed boolean NOT NULL DEFAULT false,
  participants text DEFAULT '',
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aar_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text DEFAULT '',
  strengths text DEFAULT '',
  areas_for_improvement text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'final')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  aar_report_id uuid REFERENCES aar_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  owner_name text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'deferred')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  framework text NOT NULL DEFAULT 'cms' CHECK (framework IN ('cms', 'tjc', 'custom')),
  reference_code text NOT NULL,
  element_code text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  library_version text NOT NULL DEFAULT '2024.1',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_assessed'
    CHECK (status IN ('not_assessed', 'met', 'partially_met', 'not_met', 'not_applicable')),
  last_reviewed date,
  next_due date,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, requirement_id)
);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  evidence_type text NOT NULL DEFAULT 'document'
    CHECK (evidence_type IN ('document', 'exercise', 'attestation', 'training', 'other')),
  title text NOT NULL,
  description text DEFAULT '',
  storage_path text DEFAULT '',
  exercise_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  evidence_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  personnel_id uuid REFERENCES personnel(id) ON DELETE SET NULL,
  person_name text NOT NULL,
  training_name text NOT NULL,
  completed_on date,
  expires_on date,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  title text NOT NULL,
  doc_category text NOT NULL DEFAULT 'general',
  storage_path text NOT NULL DEFAULT '',
  mime_type text DEFAULT '',
  size_bytes bigint DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hva_entries', 'plan_documents', 'exercises', 'aar_reports', 'corrective_actions', 'compliance_statuses', 'compliance_evidence', 'training_records', 'app_documents']
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

-- Requirement library: global rows readable by all authenticated users.
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_select_compliance_requirements" ON compliance_requirements FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_insert_compliance_requirements" ON compliance_requirements FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_update_compliance_requirements" ON compliance_requirements FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_delete_compliance_requirements" ON compliance_requirements FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());
DROP TRIGGER IF EXISTS set_updated_at_compliance_requirements ON compliance_requirements;
CREATE TRIGGER set_updated_at_compliance_requirements BEFORE UPDATE ON compliance_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hva_tenant ON hva_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exercises_tenant ON exercises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_tenant ON corrective_actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_statuses_tenant ON compliance_statuses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_req ON compliance_evidence(requirement_id);
