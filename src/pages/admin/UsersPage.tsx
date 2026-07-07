import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { logAudit } from '../../lib/audit';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, statusTone } from '../../components/ui';
import { titleCase } from '../../lib/utils';
import type { Personnel, PlatformRole, Profile } from '../../types/domain';

const ROLES: PlatformRole[] = ['org_admin', 'facility_admin', 'program_manager', 'responder', 'viewer', 'auditor'];

export function UsersPage() {
  const [tab, setTab] = useState('users');
  return (
    <div>
      <PageHeader title="Users & Personnel" subtitle="Login accounts with platform roles, plus the wider staff/contact directory" />
      <Tabs
        tabs={[
          { key: 'users', label: 'User Accounts' },
          { key: 'personnel', label: 'Personnel Directory' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'users' ? <UsersPanel /> : <PersonnelPanel />}
    </div>
  );
}

function UsersPanel() {
  const { profile: me, organization } = useAuth();
  const { rows: profiles, reload } = useRecords<Profile>('profiles', { orderBy: 'full_name' });

  const setRole = async (profile: Profile, role: PlatformRole) => {
    await saveRecord('profiles', { ...profile, platform_role: role } as unknown as Record<string, unknown>);
    logAudit('user.role_changed', 'profile', profile.id, { role, user: profile.email });
    await reload();
  };

  const toggleActive = async (profile: Profile) => {
    await saveRecord('profiles', { ...profile, is_active: !profile.is_active } as unknown as Record<string, unknown>);
    await reload();
  };

  return (
    <Card
      title="User Accounts"
      subtitle={`Invite staff with the org invite code (Admin → Organization): ${organization?.invite_code ?? ''}`}
    >
      {profiles.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <DataTable head={['Name', 'Email', 'Platform Role', 'Status', '']}>
          {profiles.map((profile) => (
            <tr key={profile.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">
                {profile.full_name || '—'}
                {profile.id === me?.id && <span className="ml-2 text-xs text-brand-400">(you)</span>}
              </td>
              <td className="px-4 py-3 text-sm text-slate-400">{profile.email}</td>
              <td className="px-4 py-3">
                <Select
                  className="!min-h-0 !w-auto !py-1.5 text-sm"
                  value={profile.platform_role}
                  disabled={profile.id === me?.id}
                  onChange={(e) => void setRole(profile, e.target.value as PlatformRole)}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                </Select>
              </td>
              <td className="px-4 py-3"><Badge tone={profile.is_active ? 'green' : 'red'}>{profile.is_active ? 'Active' : 'Disabled'}</Badge></td>
              <td className="px-4 py-3">
                {profile.id !== me?.id && (
                  <Button size="sm" variant="ghost" onClick={() => void toggleActive(profile)}>
                    {profile.is_active ? 'Disable' : 'Enable'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </Card>
  );
}

function PersonnelPanel() {
  const { rows: personnel, reload } = useRecords<Personnel>('personnel', { orderBy: 'full_name' });
  const [editing, setEditing] = useState<Partial<Personnel> | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('personnel', {
      ...editing,
      skills: typeof editing.skills === 'string' ? String(editing.skills).split(',').map((s) => s.trim()).filter(Boolean) : editing.skills ?? []
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <Card
      title="Personnel & Contact Directory"
      subtitle="Staff and external contacts — callback info, credentials, and skills for HIMT assignment and labor-pool matching. Not every contact needs a login."
      actions={<Button size="sm" onClick={() => setEditing({ personnel_type: 'staff', is_active: true })}><Plus size={14} /> Add</Button>}
    >
      {personnel.length === 0 ? (
        <EmptyState title="Directory is empty" hint="Add staff and external contacts to power HIMT assignment, callbacks, and notifications." />
      ) : (
        <DataTable head={['Name', 'Type', 'Title / Dept', 'Contact', 'Skills', '']}>
          {personnel.map((person) => (
            <tr key={person.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">{person.full_name}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(person.personnel_type)}>{titleCase(person.personnel_type)}</Badge></td>
              <td className="px-4 py-3 text-sm">{[person.job_title, person.department].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{[person.phone, person.email].filter(Boolean).join(' · ') || '—'}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{person.skills?.join(', ') || '—'}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(person)}>Edit</button>
                  <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('personnel', person.id).then(reload)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Personnel' : 'Add Personnel'} wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full Name" required>
            <Input value={editing?.full_name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, full_name: e.target.value }))} required />
          </Field>
          <Field label="Type">
            <Select value={editing?.personnel_type ?? 'staff'} onChange={(e) => setEditing((d) => ({ ...d, personnel_type: e.target.value as Personnel['personnel_type'] }))}>
              {['staff', 'external_contact', 'agency', 'volunteer', 'vendor_contact', 'mutual_aid'].map((t) => (
                <option key={t} value={t}>{titleCase(t)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Job Title">
            <Input value={editing?.job_title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, job_title: e.target.value }))} />
          </Field>
          <Field label="Department">
            <Input value={editing?.department ?? ''} onChange={(e) => setEditing((d) => ({ ...d, department: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={editing?.phone ?? ''} onChange={(e) => setEditing((d) => ({ ...d, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={editing?.email ?? ''} onChange={(e) => setEditing((d) => ({ ...d, email: e.target.value }))} />
          </Field>
          <Field label="Pager">
            <Input value={editing?.pager ?? ''} onChange={(e) => setEditing((d) => ({ ...d, pager: e.target.value }))} />
          </Field>
          <Field label="Skills (comma-separated)">
            <Input
              value={Array.isArray(editing?.skills) ? editing?.skills.join(', ') : String(editing?.skills ?? '')}
              onChange={(e) => setEditing((d) => ({ ...d, skills: e.target.value as unknown as string[] }))}
              placeholder="RN, ACLS, Spanish"
            />
          </Field>
          <Field label="Callback Notes" span={2}>
            <Input value={editing?.callback_notes ?? ''} onChange={(e) => setEditing((d) => ({ ...d, callback_notes: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
