import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { DEFAULT_PERMISSIONS, type PermissionAction } from '../../lib/permissions';
import { Button, Card, Field, Input, PageHeader } from '../../components/ui';
import { titleCase } from '../../lib/utils';
import type { PlatformRole } from '../../types/domain';

// Data-driven permission matrix (spec §6): tune which platform roles may
// perform sensitive actions, and the cost threshold requiring Finance
// sign-off. Overrides persist per tenant in permission_settings.

const ACTIONS = Object.keys(DEFAULT_PERMISSIONS) as PermissionAction[];
const ROLES: PlatformRole[] = ['org_admin', 'facility_admin', 'program_manager', 'responder', 'viewer', 'auditor'];

interface SettingRow {
  id?: string;
  action: string;
  allowed_platform_roles: string[];
  cost_threshold?: number | null;
}

export function PermissionsPage() {
  const { refreshProfile } = useAuth();
  const { rows: settings, reload } = useRecords<SettingRow & { id: string }>('permission_settings', {});
  const [savedFor, setSavedFor] = useState('');

  const rowFor = (action: PermissionAction): SettingRow => {
    const existing = settings.find((s) => s.action === action);
    return existing ?? { action, allowed_platform_roles: DEFAULT_PERMISSIONS[action], cost_threshold: action === 'approve_resource_request' ? 10000 : null };
  };

  const toggleRole = async (action: PermissionAction, role: PlatformRole) => {
    const row = rowFor(action);
    const roles = row.allowed_platform_roles.includes(role)
      ? row.allowed_platform_roles.filter((r) => r !== role)
      : [...row.allowed_platform_roles, role];
    await saveRecord('permission_settings', { ...row, allowed_platform_roles: roles } as Record<string, unknown>);
    await reload();
    await refreshProfile();
    setSavedFor(action);
    setTimeout(() => setSavedFor(''), 1500);
  };

  const setThreshold = async (action: PermissionAction, value: number) => {
    const row = rowFor(action);
    await saveRecord('permission_settings', { ...row, cost_threshold: value } as Record<string, unknown>);
    await reload();
    await refreshProfile();
  };

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Who can declare incidents, approve IAPs and resource requests, and send mass notifications. Super Admin always retains access; tenant isolation itself is enforced by database RLS."
      />

      <div className="space-y-4">
        {ACTIONS.map((action) => {
          const row = rowFor(action);
          return (
            <Card
              key={action}
              title={titleCase(action)}
              actions={savedFor === action ? <span className="text-xs text-emerald-400">Saved</span> : undefined}
            >
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const active = row.allowed_platform_roles.includes(role);
                  return (
                    <button
                      key={role}
                      onClick={() => void toggleRole(action, role)}
                      className={`min-h-touch rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-600/30 text-brand-200'
                          : 'border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {titleCase(role)}
                    </button>
                  );
                })}
              </div>
              {action === 'approve_resource_request' && (
                <div className="mt-4 max-w-xs">
                  <Field label="Finance sign-off threshold ($)">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        defaultValue={row.cost_threshold ?? 10000}
                        onBlur={(e) => void setThreshold(action, Number(e.target.value))}
                      />
                      <Button size="sm" variant="secondary" type="button" onClick={() => void setThreshold(action, row.cost_threshold ?? 10000)}>
                        Apply
                      </Button>
                    </div>
                  </Field>
                  <p className="mt-1 text-xs text-slate-500">Requests at or above this amount are flagged for Finance Chief sign-off.</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
