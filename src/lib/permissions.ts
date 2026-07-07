import type { PlatformRole, Profile } from '../types/domain';

// Data-driven permission matrix. These defaults apply unless the tenant has
// an override row in permission_settings (managed in Admin → Roles &
// Permissions). Server-side enforcement is RLS; this governs UI affordances.

export type PermissionAction =
  | 'declare_incident'
  | 'close_incident'
  | 'approve_iap'
  | 'approve_resource_request'
  | 'send_mass_notification'
  | 'manage_admin'
  | 'manage_compliance'
  | 'view_audit_log'
  | 'manage_billing';

export const DEFAULT_PERMISSIONS: Record<PermissionAction, PlatformRole[]> = {
  declare_incident: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  close_incident: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  approve_iap: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  approve_resource_request: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  send_mass_notification: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  manage_admin: ['super_admin', 'org_admin', 'facility_admin'],
  manage_compliance: ['super_admin', 'org_admin', 'facility_admin', 'program_manager'],
  view_audit_log: ['super_admin', 'org_admin', 'facility_admin', 'program_manager', 'auditor'],
  manage_billing: ['super_admin', 'org_admin']
};

export interface PermissionOverride {
  action: string;
  allowed_platform_roles: string[];
  cost_threshold?: number | null;
}

export function can(
  profile: Profile | null,
  action: PermissionAction,
  overrides: PermissionOverride[] = []
): boolean {
  if (!profile) return false;
  const override = overrides.find((o) => o.action === action);
  const allowed = override?.allowed_platform_roles?.length
    ? (override.allowed_platform_roles as PlatformRole[])
    : DEFAULT_PERMISSIONS[action];
  return allowed.includes(profile.platform_role);
}

/** Cost threshold above which resource requests need Finance approval. */
export function approvalThreshold(overrides: PermissionOverride[] = []): number {
  const override = overrides.find((o) => o.action === 'approve_resource_request');
  return override?.cost_threshold ?? 10_000;
}
