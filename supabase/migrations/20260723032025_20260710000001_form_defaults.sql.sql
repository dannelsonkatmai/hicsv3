/*
  # Form defaults library

  1. New Tables
    - `form_defaults` — org-level preloaded rows (personnel contacts, standing
      objectives, aid stations, transport services, hazards, resource
      directory entries) that responders pull into HICS form tables while
      filling them. One row per entry; `category` selects the defaults
      library tab and `data` holds the column values for that category
      (column definitions live in src/data/formDefaultsCatalog.ts).

  2. Security
    - RLS: tenant-scoped like the other operational tables.
*/

CREATE TABLE IF NOT EXISTS form_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE form_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_form_defaults" ON form_defaults FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_insert_form_defaults" ON form_defaults FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update_form_defaults" ON form_defaults FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete_form_defaults" ON form_defaults FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS set_updated_at_form_defaults ON form_defaults;
CREATE TRIGGER set_updated_at_form_defaults BEFORE UPDATE ON form_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_form_defaults_tenant_category ON form_defaults(tenant_id, category);