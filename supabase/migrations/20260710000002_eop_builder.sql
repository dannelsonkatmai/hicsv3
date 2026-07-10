/*
  # EOP Plan Builder

  1. New Tables
    - `eop_plans` — step-by-step Emergency Operations Plan drafts built from
      the regulatory content catalog (src/data/eopBuilderCatalog.ts).
      `variables` holds the facility-profile merge fields; `sections` maps
      section key → { content, done } as the planner works through the wizard.
      On publish the assembled plan is written to `plan_documents` and linked
      back via `plan_document_id`.

  2. Security
    - RLS: tenant-scoped like the other preparedness tables.
*/

CREATE TABLE IF NOT EXISTS eop_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Emergency Operations Plan',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'published')),
  catalog_version text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step integer NOT NULL DEFAULT 0,
  plan_document_id uuid REFERENCES plan_documents(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE eop_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_eop_plans" ON eop_plans FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_insert_eop_plans" ON eop_plans FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update_eop_plans" ON eop_plans FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete_eop_plans" ON eop_plans FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS set_updated_at_eop_plans ON eop_plans;
CREATE TRIGGER set_updated_at_eop_plans BEFORE UPDATE ON eop_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_eop_plans_tenant ON eop_plans(tenant_id, status);
