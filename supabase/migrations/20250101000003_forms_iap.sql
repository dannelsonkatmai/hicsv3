/*
  # Forms engine and IAP

  1. New Tables
    - `form_templates` — data-driven HICS form definitions. Global rows
      (tenant_id IS NULL) are the standard HICS 2014 set (shipped in the app
      bundle and optionally mirrored here); tenant rows are org customizations
      or fully custom forms. `schema` holds the section/field definitions.
      `no_phi` marks patient-related forms that must stay aggregate-only.
    - `form_instances` — a filled-in form tied to an incident + operational
      period. `data` holds field values keyed by field key.
    - `form_instance_versions` — immutable version history for auditability.
    - `iaps` — the IAP packet for an operational period, with an approval
      lifecycle (draft → in_review → approved → published → archived).
    - `iap_forms` — which form instances compose the IAP packet, in order.

  2. Security
    - RLS everywhere; version history is insert-only (no update/delete) to
      preserve the audit trail.
*/

CREATE TABLE IF NOT EXISTS form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'command'
    CHECK (category IN ('command', 'resource', 'personnel', 'situation', 'custom')),
  description text DEFAULT '',
  schema jsonb NOT NULL DEFAULT '{"sections": []}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  no_phi boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  template_code text NOT NULL,
  template_title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'final')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  prepared_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  prepared_by_name text DEFAULT '',
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_instance_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_instance_id uuid NOT NULL REFERENCES form_instances(id) ON DELETE CASCADE,
  version integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Incident Action Plan',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'archived')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by_name text DEFAULT '',
  approved_at timestamptz,
  published_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iap_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  iap_id uuid NOT NULL REFERENCES iaps(id) ON DELETE CASCADE,
  form_instance_id uuid NOT NULL REFERENCES form_instances(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['form_instances', 'iaps', 'iap_forms']
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

  FOREACH t IN ARRAY ARRAY['form_instances', 'iaps', 'iap_forms', 'form_templates']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at_%s ON %I', t, t);
    EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- form_templates: global standard set readable by everyone; tenant custom rows scoped.
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_select_form_templates" ON form_templates FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_insert_form_templates" ON form_templates FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_update_form_templates" ON form_templates FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "catalog_delete_form_templates" ON form_templates FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Version history is append-only: SELECT + INSERT, never UPDATE/DELETE.
ALTER TABLE form_instance_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_select" ON form_instance_versions FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "versions_insert" ON form_instance_versions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_form_instances_incident ON form_instances(incident_id);
CREATE INDEX IF NOT EXISTS idx_form_instances_tenant ON form_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_form_versions_instance ON form_instance_versions(form_instance_id);
CREATE INDEX IF NOT EXISTS idx_iaps_incident ON iaps(incident_id);
CREATE INDEX IF NOT EXISTS idx_iap_forms_iap ON iap_forms(iap_id);
