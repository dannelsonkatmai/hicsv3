import { insertRecord } from './repo';

// Best-effort append to the immutable audit_log (insert-only under RLS).
// Queued through the offline outbox like any other write, so audit events
// captured at a disconnected command post still land once connectivity
// returns.

let actor: { id: string | null; email: string } = { id: null, email: '' };

export function setAuditActor(id: string | null, email: string) {
  actor = { id, email };
}

export function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  detail: Record<string, unknown> = {}
): void {
  void insertRecord('audit_log', {
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail,
    created_at: new Date().toISOString()
  }).catch(() => undefined);
}
