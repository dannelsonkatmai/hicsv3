/*
  # Resources, ordering, inventory, and cost accounting

  1. New Tables
    - `vendors` — supplier catalog for procurement.
    - `resources` — requestable/trackable catalog items (equipment, supplies,
      meds, beds, vehicles, personnel types).
    - `inventory_items` — par levels & on-hand counts for critical caches.
    - `resource_requests` — the HICS 213RR-style request flow with priority,
      need-by, justification, and an approval lifecycle.
    - `procurement_orders` — fulfillment records (vendor, PO, delivery status).
    - `cost_records` — cost lines for resources/orders/labor; FEMA PA category
      tagging and mutual-aid flag for reimbursement roll-ups.
    - `resource_checkouts` — check-in/check-out + demobilization tracking.
    - `mutual_aid_records` — EMAC/mutual-aid sharing for cost recovery.

  2. Security
    - Standard tenant RLS on all tables.
*/

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  account_number text DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'supplies'
    CHECK (category IN ('equipment', 'supplies', 'medications', 'beds', 'vehicles', 'facilities', 'personnel', 'other')),
  unit_of_measure text DEFAULT 'each',
  unit_cost numeric DEFAULT 0,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'supplies',
  location text DEFAULT '',
  par_level numeric NOT NULL DEFAULT 0,
  on_hand numeric NOT NULL DEFAULT 0,
  unit_of_measure text DEFAULT 'each',
  is_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  request_number integer,
  item_description text NOT NULL,
  resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'supplies',
  quantity numeric NOT NULL DEFAULT 1,
  unit_of_measure text DEFAULT 'each',
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'immediate')),
  needed_by timestamptz,
  deliver_to text DEFAULT '',
  justification text DEFAULT '',
  requesting_section text NOT NULL DEFAULT 'operations',
  requested_by_name text DEFAULT '',
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_review', 'approved', 'denied', 'ordered', 'delivered', 'demobilized', 'cancelled')),
  estimated_cost numeric DEFAULT 0,
  review_notes text DEFAULT '',
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  resource_request_id uuid REFERENCES resource_requests(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_name text DEFAULT '',
  po_number text DEFAULT '',
  description text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'placed'
    CHECK (status IN ('draft', 'placed', 'shipped', 'delivered', 'cancelled')),
  ordered_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  cost_type text NOT NULL DEFAULT 'supplies'
    CHECK (cost_type IN ('labor', 'equipment', 'supplies', 'medications', 'contract', 'facility', 'other')),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  incurred_on date DEFAULT CURRENT_DATE,
  procurement_order_id uuid REFERENCES procurement_orders(id) ON DELETE SET NULL,
  resource_request_id uuid REFERENCES resource_requests(id) ON DELETE SET NULL,
  fema_category text DEFAULT ''
    CHECK (fema_category IN ('', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Z')),
  reimbursable boolean NOT NULL DEFAULT false,
  mutual_aid boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  resource_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  checked_out_to text DEFAULT '',
  location text DEFAULT '',
  checked_out_at timestamptz DEFAULT now(),
  checked_in_at timestamptz,
  condition_notes text DEFAULT '',
  demobilized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mutual_aid_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE,
  partner_name text NOT NULL,
  direction text NOT NULL DEFAULT 'received' CHECK (direction IN ('received', 'provided')),
  description text NOT NULL DEFAULT '',
  quantity numeric DEFAULT 1,
  estimated_value numeric DEFAULT 0,
  agreement_reference text DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'returned', 'reimbursed', 'closed')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-number resource requests per incident.
CREATE OR REPLACE FUNCTION public.assign_request_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_number IS NULL THEN
    SELECT COALESCE(MAX(request_number), 0) + 1 INTO NEW.request_number
    FROM resource_requests WHERE incident_id = NEW.incident_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_request_number ON resource_requests;
CREATE TRIGGER trg_assign_request_number
  BEFORE INSERT ON resource_requests
  FOR EACH ROW EXECUTE FUNCTION public.assign_request_number();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vendors', 'resources', 'inventory_items', 'resource_requests', 'procurement_orders', 'cost_records', 'resource_checkouts', 'mutual_aid_records']
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

CREATE INDEX IF NOT EXISTS idx_resource_requests_incident ON resource_requests(incident_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_incident ON procurement_orders(incident_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_incident ON cost_records(incident_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_items(tenant_id);
