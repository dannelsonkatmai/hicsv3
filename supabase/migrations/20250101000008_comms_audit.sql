/*
  # Communications, notifications, activity logging, audit trail

  1. New Tables
    - `notification_templates` — reusable message templates per tenant.
    - `notifications` — a composed broadcast (activation alert, callback,
      SitRep distribution) with channel + audience; sending is performed by
      the `send-notification` edge function through the vendor-agnostic
      provider layer.
    - `notification_deliveries` — per-recipient delivery/read/ack tracking.
    - `incident_messages` — HICS 213-style incident messages (in-app log).
    - `activity_log_entries` — HICS 214 operational/activity log.
    - `audit_log` — immutable security/record audit trail (INSERT-only via
      RLS; no UPDATE/DELETE policies exist so rows can never be altered).

  2. Security
    - Standard tenant RLS; audit log is append-only and admin-readable.
  3. Realtime
    - `incident_messages` added to the realtime publication for live message
      traffic at the command post.
*/

CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text DEFAULT '',
  body text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'paging', 'all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'paging', 'all')),
  audience text NOT NULL DEFAULT 'custom'
    CHECK (audience IN ('all_staff', 'himt', 'section', 'custom')),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'queued', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_name text DEFAULT '',
  recipient_address text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'email',
  provider text DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read', 'acknowledged')),
  error text DEFAULT '',
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  message_number integer,
  from_name text NOT NULL DEFAULT '',
  from_position text DEFAULT '',
  to_name text NOT NULL DEFAULT '',
  to_position text DEFAULT '',
  subject text DEFAULT '',
  body text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'immediate')),
  reply text DEFAULT '',
  replied_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  operational_period_id uuid REFERENCES operational_periods(id) ON DELETE SET NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  section text DEFAULT '',
  position_title text DEFAULT '',
  entry text NOT NULL,
  logged_by_name text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor_id uuid,
  actor_email text DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-number 213 messages per incident.
CREATE OR REPLACE FUNCTION public.assign_message_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.message_number IS NULL THEN
    SELECT COALESCE(MAX(message_number), 0) + 1 INTO NEW.message_number
    FROM incident_messages WHERE incident_id = NEW.incident_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_message_number ON incident_messages;
CREATE TRIGGER trg_assign_message_number
  BEFORE INSERT ON incident_messages
  FOR EACH ROW EXECUTE FUNCTION public.assign_message_number();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notification_templates', 'notifications', 'notification_deliveries', 'incident_messages', 'activity_log_entries']
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

-- Audit log: append-only. INSERT for members, SELECT for admins/auditors.
-- No UPDATE or DELETE policy exists — rows are immutable under RLS.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_insert" ON audit_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "audit_select_admin" ON audit_log FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_platform_role() IN ('super_admin', 'org_admin', 'facility_admin', 'program_manager', 'auditor')
  );

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE incident_messages';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_messages_incident ON incident_messages(incident_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_incident ON activity_log_entries(incident_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_log(tenant_id, created_at DESC);
