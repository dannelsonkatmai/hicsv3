/*
# Add performance indexes for common query patterns

## Changes
- `personnel(tenant_id, is_active)` — notification fan-out filters by both
- `notifications(tenant_id, status)` — querying draft/queued/sending notifications
- `organizations(invite_code)` — join-org lookup by invite code
- `himt_assignments(incident_id, released_at)` — filtering active assignments
- `form_instances(incident_id, operational_period_id)` — IAP form queries
- `exercises(tenant_id, status)` — dashboard and compliance queries by status
- `corrective_actions(tenant_id, status)` — dashboard open CAPA queries
- `resource_requests(tenant_id, status)` — dashboard open request queries

## Security
No security changes. Read-only optimization.
*/

CREATE INDEX IF NOT EXISTS idx_personnel_tenant_active ON personnel(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_organizations_invite_code ON organizations(invite_code);
CREATE INDEX IF NOT EXISTS idx_himt_assignments_incident_released ON himt_assignments(incident_id, released_at);
CREATE INDEX IF NOT EXISTS idx_form_instances_incident_op ON form_instances(incident_id, operational_period_id);
CREATE INDEX IF NOT EXISTS idx_exercises_tenant_status ON exercises(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_tenant_status ON corrective_actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_tenant_status ON resource_requests(tenant_id, status);
