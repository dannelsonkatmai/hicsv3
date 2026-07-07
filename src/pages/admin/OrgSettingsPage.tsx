import { useState, type FormEvent } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveRecord } from '../../lib/repo';
import { logAudit } from '../../lib/audit';
import { Badge, Button, Card, Field, Input, PageHeader } from '../../components/ui';
import { titleCase } from '../../lib/utils';

export function OrgSettingsPage() {
  const { organization, refreshProfile } = useAuth();
  const [name, setName] = useState(organization?.name ?? '');
  const [retention, setRetention] = useState(organization?.data_retention_days ?? 3650);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!organization) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('organizations', { ...organization, name, data_retention_days: retention } as unknown as Record<string, unknown>);
    logAudit('organization.updated', 'organization', organization.id, { name });
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const regenerateInvite = async () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await saveRecord('organizations', { ...organization, invite_code: code } as unknown as Record<string, unknown>);
    logAudit('organization.invite_regenerated', 'organization', organization.id, {});
    await refreshProfile();
  };

  const copyInvite = async () => {
    await navigator.clipboard.writeText(organization.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Organization Settings" subtitle="Tenant profile, invite code, and data retention" />

      <div className="space-y-4">
        <Card title="Profile">
          <form onSubmit={save} className="space-y-4">
            <Field label="Organization Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Data Retention (days)">
              <Input type="number" min={365} value={retention} onChange={(e) => setRetention(Number(e.target.value))} />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              {saved && <span className="text-sm text-emerald-400">Saved.</span>}
            </div>
          </form>
        </Card>

        <Card title="Subscription">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span>Plan:</span>
            <Badge tone="blue">{titleCase(organization.plan)}</Badge>
            <span>Status:</span>
            <Badge tone={organization.subscription_status === 'active' || organization.subscription_status === 'trialing' ? 'green' : 'red'}>
              {titleCase(organization.subscription_status)}
            </Badge>
            <span>Seats: {organization.seats}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Manage the subscription under Admin → Billing.</p>
        </Card>

        <Card title="Invite Code" subtitle="Staff join your organization with this code from the onboarding screen">
          <div className="flex flex-wrap items-center gap-3">
            <code className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 font-mono text-lg tracking-widest text-brand-300">
              {organization.invite_code}
            </code>
            <Button variant="secondary" size="sm" onClick={() => void copyInvite()}>
              <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void regenerateInvite()}>
              <RefreshCw size={14} /> Regenerate
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Regenerating immediately invalidates the previous code. New members join with the Responder role; adjust
            roles under Admin → Users & Personnel.
          </p>
        </Card>
      </div>
    </div>
  );
}
