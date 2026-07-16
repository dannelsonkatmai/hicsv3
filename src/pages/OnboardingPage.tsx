import { useState, type FormEvent } from 'react';
import { Building2, KeyRound, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, Input } from '../components/ui';
import { logAudit } from '../lib/audit';

// Tenant onboarding: create a new organization (becomes org_admin) or join an
// existing one with its invite code. Both paths run through SECURITY DEFINER
// RPCs so RLS stays airtight.

export function OnboardingPage() {
  const { refreshProfile, signOut, session } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createOrg = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('setup-organization', {
        body: { org_name: orgName, facility_name: facilityName || orgName }
      });
      if (err) throw new Error(err.context?.error ?? err.message);
      if (data?.error) throw new Error(data.error);
      logAudit('organization.created', 'organization', String(data?.id ?? ''), { name: orgName });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create organization');
    } finally {
      setBusy(false);
    }
  };

  const joinOrg = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('join-organization', {
        body: { code: inviteCode.trim() }
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Welcome to Essential HICS</h1>
          <p className="mt-1 text-sm text-slate-400">
            Signed in as {session?.user.email}. Set up your organization to continue.
          </p>
        </div>

        {error && <p className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><Building2 size={16} /> Create a new organization</span>}>
            <form onSubmit={createOrg} className="space-y-4">
              <Field label="Organization / Health System Name" required>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Katmai Regional Medical Center" />
              </Field>
              <Field label="Primary Facility Name">
                <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="Main Campus" />
              </Field>
              <Button type="submit" className="w-full" disabled={busy || !orgName}>
                Create Organization
              </Button>
              <p className="text-xs text-slate-500">
                You become the Org Admin and start a 14-day trial. Facilities, units, and users are configured next in Admin.
              </p>
            </form>
          </Card>

          <Card title={<span className="flex items-center gap-2"><KeyRound size={16} /> Join an existing organization</span>}>
            <form onSubmit={joinOrg} className="space-y-4">
              <Field label="Invite Code" required>
                <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required placeholder="e.g. 4f9a2c1b8d3e" />
              </Field>
              <Button type="submit" variant="secondary" className="w-full" disabled={busy || !inviteCode}>
                Join Organization
              </Button>
              <p className="text-xs text-slate-500">
                Your Org Admin can find the invite code under Admin → Organization. You join with the Responder role.
              </p>
            </form>
          </Card>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => void signOut()} className="text-xs text-slate-500 hover:text-slate-300">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
