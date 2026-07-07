import { useState, type FormEvent } from 'react';
import { Plus, UserCheck } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, StatCard, Tabs, statusTone } from '../../../components/ui';
import { fmtDateTime, fmtMoney, sumBy, titleCase } from '../../../lib/utils';
import type { LaborPoolEntry, TemporaryPersonnel, TimeEntry } from '../../../types/domain';

// Labor pool & surge personnel (spec §3.4): check-in/assignment, credentialed
// volunteer intake with verification, and HICS 252-style time capture feeding
// labor cost analysis.

export function LaborTab() {
  const [tab, setTab] = useState('pool');
  return (
    <div>
      <Tabs
        tabs={[
          { key: 'pool', label: 'Labor Pool' },
          { key: 'volunteers', label: 'Volunteers & Temp Staff' },
          { key: 'time', label: 'Time Tracking (252)' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'pool' && <PoolPanel />}
      {tab === 'volunteers' && <VolunteersPanel />}
      {tab === 'time' && <TimePanel />}
    </div>
  );
}

function PoolPanel() {
  const { incident } = useIncident();
  const { rows: entries, reload } = useRecords<LaborPoolEntry>('labor_pool_entries', {
    match: { incident_id: incident.id },
    orderBy: 'checked_in_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<LaborPoolEntry>>({ status: 'available' });
  const [assignTarget, setAssignTarget] = useState<LaborPoolEntry | null>(null);
  const [assignment, setAssignment] = useState('');
  const [assignUnit, setAssignUnit] = useState('');

  const available = entries.filter((e) => e.status === 'available');
  const assigned = entries.filter((e) => e.status === 'assigned');

  const checkIn = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('labor_pool_entries', {
      ...draft,
      incident_id: incident.id,
      skills: (typeof draft.role_or_skill === 'string' && draft.role_or_skill) ? [draft.role_or_skill] : [],
      status: 'available',
      checked_in_at: new Date().toISOString()
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ status: 'available' });
    await reload();
  };

  const assign = async () => {
    if (!assignTarget) return;
    await saveRecord('labor_pool_entries', {
      ...assignTarget,
      status: 'assigned',
      current_assignment: assignment,
      assigned_unit: assignUnit
    } as unknown as Record<string, unknown>);
    logAudit('labor_pool.assigned', 'labor_pool_entry', assignTarget.id, { assignment });
    setAssignTarget(null);
    setAssignment('');
    setAssignUnit('');
    await reload();
  };

  const release = async (entry: LaborPoolEntry) => {
    await saveRecord('labor_pool_entries', {
      ...entry,
      status: 'released',
      released_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    await reload();
  };

  const backToPool = async (entry: LaborPoolEntry) => {
    await saveRecord('labor_pool_entries', {
      ...entry,
      status: 'available',
      current_assignment: '',
      assigned_unit: ''
    } as unknown as Record<string, unknown>);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Available Now" value={available.length} tone={available.length ? 'green' : 'slate'} />
        <StatCard label="Assigned" value={assigned.length} tone="blue" />
        <StatCard label="Total Checked In" value={entries.length} />
        <StatCard label="Released" value={entries.filter((e) => e.status === 'released').length} />
      </div>

      <Card
        title="Labor Pool"
        subtitle="Staff checked in and available for assignment; match skills to staffing gaps"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Check In Staff</Button>}
      >
        {entries.length === 0 ? (
          <EmptyState title="Labor pool is empty" hint="Check staff in as they report; assign them to units and needs from here." />
        ) : (
          <DataTable head={['Name', 'Role / Skill', 'Department', 'Status', 'Assignment', 'Checked In', '']}>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-medium">{entry.person_name}</td>
                <td className="px-4 py-3 text-sm">{entry.role_or_skill || '—'}</td>
                <td className="px-4 py-3 text-sm">{entry.department || '—'}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(entry.status)}>{titleCase(entry.status)}</Badge></td>
                <td className="px-4 py-3 text-sm">{entry.current_assignment ? `${entry.current_assignment}${entry.assigned_unit ? ` (${entry.assigned_unit})` : ''}` : '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(entry.checked_in_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {entry.status === 'available' && (
                      <Button size="sm" variant="ghost" onClick={() => setAssignTarget(entry)}><UserCheck size={14} /> Assign</Button>
                    )}
                    {entry.status === 'assigned' && (
                      <Button size="sm" variant="ghost" onClick={() => void backToPool(entry)}>Return to Pool</Button>
                    )}
                    {entry.status !== 'released' && (
                      <Button size="sm" variant="ghost" onClick={() => void release(entry)}>Release</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Check In to Labor Pool">
        <form onSubmit={checkIn} className="space-y-4">
          <Field label="Name" required>
            <Input value={draft.person_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, person_name: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Role / Primary Skill">
              <Input value={draft.role_or_skill ?? ''} onChange={(e) => setDraft((d) => ({ ...d, role_or_skill: e.target.value }))} placeholder="RN, Respiratory Tech, Runner…" />
            </Field>
            <Field label="Home Department">
              <Input value={draft.department ?? ''} onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Check In</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(assignTarget)} onClose={() => setAssignTarget(null)} title={`Assign — ${assignTarget?.person_name ?? ''}`}>
        <div className="space-y-4">
          <Field label="Assignment" required>
            <Input value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g., Surge support — vitals & transport" />
          </Field>
          <Field label="Unit / Area">
            <Input value={assignUnit} onChange={(e) => setAssignUnit(e.target.value)} placeholder="e.g., 4 West" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button onClick={() => void assign()} disabled={!assignment}>Assign</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function VolunteersPanel() {
  const { incident } = useIncident();
  const { profile } = useAuth();
  const { rows: volunteers, reload } = useRecords<TemporaryPersonnel>('temporary_personnel', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<TemporaryPersonnel>>({ personnel_category: 'volunteer', credential_status: 'pending' });

  const register = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('temporary_personnel', { ...draft, incident_id: incident.id } as Record<string, unknown>);
    logAudit('volunteer.registered', 'temporary_personnel', draft.full_name ?? '', { category: draft.personnel_category });
    setShowNew(false);
    setDraft({ personnel_category: 'volunteer', credential_status: 'pending' });
    await reload();
  };

  const setCredential = async (person: TemporaryPersonnel, status: TemporaryPersonnel['credential_status']) => {
    await saveRecord('temporary_personnel', {
      ...person,
      credential_status: status,
      verified_by: profile?.id ?? null,
      verified_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    logAudit(`volunteer.credential_${status}`, 'temporary_personnel', person.id, { name: person.full_name });
    await reload();
  };

  return (
    <Card
      title="Volunteers, Agency & Reassigned Staff (HICS 253)"
      subtitle="Disaster privileging intake: identity, license, verification status. Staff PII — protected; not patient data."
      actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Register</Button>}
    >
      {volunteers.length === 0 ? (
        <EmptyState title="No temporary personnel registered" />
      ) : (
        <DataTable head={['Name', 'Category', 'License', 'Credential Status', 'Assignment', 'Actions']}>
          {volunteers.map((person) => (
            <tr key={person.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3">
                <p className="text-sm font-medium">{person.full_name}</p>
                <p className="text-xs text-slate-500">{person.organization_name || person.phone || ''}</p>
              </td>
              <td className="px-4 py-3 text-sm">{titleCase(person.personnel_category)}</td>
              <td className="px-4 py-3 text-sm">
                {person.license_type ? `${person.license_type} ${person.license_number} (${person.license_state})` : '—'}
                {person.license_expires && <span className="block text-xs text-slate-500">Expires {person.license_expires}</span>}
              </td>
              <td className="px-4 py-3"><Badge tone={statusTone(person.credential_status)}>{titleCase(person.credential_status)}</Badge></td>
              <td className="px-4 py-3 text-sm">{person.assignment || '—'}</td>
              <td className="px-4 py-3">
                {person.credential_status === 'pending' && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="success" onClick={() => void setCredential(person, 'verified')}>Verify</Button>
                    <Button size="sm" variant="ghost" onClick={() => void setCredential(person, 'rejected')}>Reject</Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Register Temporary Personnel (HICS 253)" wide>
        <form onSubmit={register} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full Name" required>
            <Input value={draft.full_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} required />
          </Field>
          <Field label="Category">
            <Select value={draft.personnel_category ?? 'volunteer'} onChange={(e) => setDraft((d) => ({ ...d, personnel_category: e.target.value as TemporaryPersonnel['personnel_category'] }))}>
              <option value="volunteer">Volunteer</option>
              <option value="agency">Agency / Temp</option>
              <option value="temp_hire">Temporary Hire</option>
              <option value="internal_reassignment">Internal Reassignment</option>
              <option value="mutual_aid">Mutual Aid Staff</option>
            </Select>
          </Field>
          <Field label="Phone">
            <Input value={draft.phone ?? ''} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
          </Field>
          <Field label="Home Organization">
            <Input value={draft.organization_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, organization_name: e.target.value }))} />
          </Field>
          <Field label="License Type">
            <Input value={draft.license_type ?? ''} onChange={(e) => setDraft((d) => ({ ...d, license_type: e.target.value }))} placeholder="RN, MD, EMT-P…" />
          </Field>
          <Field label="License Number">
            <Input value={draft.license_number ?? ''} onChange={(e) => setDraft((d) => ({ ...d, license_number: e.target.value }))} />
          </Field>
          <Field label="License State">
            <Input value={draft.license_state ?? ''} onChange={(e) => setDraft((d) => ({ ...d, license_state: e.target.value }))} />
          </Field>
          <Field label="License Expires">
            <Input type="date" value={draft.license_expires ?? ''} onChange={(e) => setDraft((d) => ({ ...d, license_expires: e.target.value }))} />
          </Field>
          <Field label="Planned Assignment" span={2}>
            <Input value={draft.assignment ?? ''} onChange={(e) => setDraft((d) => ({ ...d, assignment: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Register</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

function TimePanel() {
  const { incident, currentPeriod } = useIncident();
  const { rows: entries, reload } = useRecords<TimeEntry>('time_entries', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<TimeEntry>>({ section: 'Operations', hours: 0, hourly_rate: 0 });

  const totalHours = sumBy(entries, (e) => e.hours);
  const totalCost = sumBy(entries, (e) => e.labor_cost);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const hours = Number(draft.hours) || 0;
    const rate = Number(draft.hourly_rate) || 0;
    const laborCost = Math.round(hours * rate * 100) / 100;
    await saveRecord('time_entries', {
      ...draft,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      work_date: draft.work_date ?? new Date().toISOString().slice(0, 10),
      labor_cost: laborCost
    } as Record<string, unknown>);
    // Labor cost flows into the incident cost analysis automatically.
    if (laborCost > 0) {
      await saveRecord('cost_records', {
        incident_id: incident.id,
        operational_period_id: currentPeriod?.id ?? null,
        cost_type: 'labor',
        description: `Labor — ${draft.person_name} (${draft.position_title || draft.section})`,
        amount: laborCost,
        incurred_on: draft.work_date ?? new Date().toISOString().slice(0, 10)
      });
    }
    setShowNew(false);
    setDraft({ section: 'Operations', hours: 0, hourly_rate: 0 });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Time Entries" value={entries.length} />
        <StatCard label="Total Hours" value={totalHours.toFixed(1)} />
        <StatCard label="Labor Cost" value={fmtMoney(totalCost)} tone="blue" />
        <StatCard label="Overtime Entries" value={entries.filter((e) => e.overtime).length} />
      </div>

      <Card
        title="Personnel Time (HICS 252)"
        subtitle="Feeds labor cost analysis and the incident cost report"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Log Time</Button>}
      >
        {entries.length === 0 ? (
          <EmptyState title="No time entries" />
        ) : (
          <DataTable head={['Name', 'Section / Position', 'Date', 'Hours', 'Rate', 'Cost', 'OT']}>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-medium">{entry.person_name}</td>
                <td className="px-4 py-3 text-sm">{entry.section}{entry.position_title ? ` · ${entry.position_title}` : ''}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{entry.work_date}</td>
                <td className="px-4 py-3 text-sm">{entry.hours}</td>
                <td className="px-4 py-3 text-sm">{fmtMoney(entry.hourly_rate)}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmtMoney(entry.labor_cost)}</td>
                <td className="px-4 py-3">{entry.overtime ? <Badge tone="yellow">OT</Badge> : <span className="text-slate-600">—</span>}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Log Personnel Time" wide>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Name" required>
            <Input value={draft.person_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, person_name: e.target.value }))} required />
          </Field>
          <Field label="Section">
            <Select value={draft.section ?? 'Operations'} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}>
              {['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Position">
            <Input value={draft.position_title ?? ''} onChange={(e) => setDraft((d) => ({ ...d, position_title: e.target.value }))} />
          </Field>
          <Field label="Date">
            <Input type="date" value={draft.work_date ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setDraft((d) => ({ ...d, work_date: e.target.value }))} />
          </Field>
          <Field label="Hours" required>
            <Input type="number" min={0} step="0.25" value={draft.hours ?? 0} onChange={(e) => setDraft((d) => ({ ...d, hours: Number(e.target.value) }))} required />
          </Field>
          <Field label="Hourly Rate ($)">
            <Input type="number" min={0} step="0.01" value={draft.hourly_rate ?? 0} onChange={(e) => setDraft((d) => ({ ...d, hourly_rate: Number(e.target.value) }))} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-3">
            <input type="checkbox" checked={draft.overtime ?? false} onChange={(e) => setDraft((d) => ({ ...d, overtime: e.target.checked }))} className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600" />
            Overtime
          </label>
          <div className="flex justify-end gap-2 md:col-span-3">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Log Time</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
