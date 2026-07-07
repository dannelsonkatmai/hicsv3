import { useState, type FormEvent } from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { findPhiIssues } from '../../../lib/noPhi';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, StatCard, Tabs, Textarea, statusTone } from '../../../components/ui';
import { fmtDateTime, sumBy, titleCase } from '../../../lib/utils';
import type { CasualtySummary, PatientTrackingSummary, ReunificationLog } from '../../../types/domain';

// Patient tracking / evacuation / casualty / reunification — AGGREGATE MODE
// ONLY (spec §11 + no-PHI rule). Counts by category, unit, destination, and
// status. There are no identifier fields, and free text is PHI-validated.

const CATEGORIES = ['Immediate (Red)', 'Delayed (Yellow)', 'Minimal (Green)', 'Expectant', 'Deceased'];
const TRACK_STATUSES = ['in_place', 'awaiting_transport', 'in_transit', 'arrived', 'discharged', 'other'];

function NoPhiBanner() {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-800 bg-red-950/50 p-4">
      <ShieldAlert className="mt-0.5 shrink-0 text-red-400" size={20} />
      <div>
        <p className="text-sm font-semibold text-red-200">Aggregate counts only — no patient identifiers</p>
        <p className="mt-0.5 text-xs text-red-300/80">
          This module stores totals by category, unit, destination, and status. Never enter names, MRNs, dates of
          birth, or any patient-identifying information. Identifiable patient tracking is out of scope by design.
        </p>
      </div>
    </div>
  );
}

export function PatientsTab() {
  const [tab, setTab] = useState('tracking');
  return (
    <div>
      <NoPhiBanner />
      <Tabs
        tabs={[
          { key: 'tracking', label: 'Tracking (254)' },
          { key: 'evacuation', label: 'Evacuation (255/260)' },
          { key: 'casualty', label: 'Casualty/Fatality (259)' },
          { key: 'reunification', label: 'Family Reunification' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {(tab === 'tracking' || tab === 'evacuation') && <TrackingPanel type={tab as 'tracking' | 'evacuation'} />}
      {tab === 'casualty' && <CasualtyPanel />}
      {tab === 'reunification' && <ReunificationPanel />}
    </div>
  );
}

function TrackingPanel({ type }: { type: 'tracking' | 'evacuation' }) {
  const { incident, currentPeriod } = useIncident();
  const { rows: all, reload } = useRecords<PatientTrackingSummary>('patient_tracking_summaries', {
    match: { incident_id: incident.id, tracking_type: type },
    orderBy: 'recorded_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<PatientTrackingSummary>>({ category: CATEGORIES[0], status: 'in_place', patient_count: 0 });
  const [error, setError] = useState('');

  const total = sumBy(all, (r) => r.patient_count);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const issues = findPhiIssues(draft);
    if (issues.length) {
      setError(`Blocked by the no-PHI rule: ${issues.map((i) => i.message).join('; ')}`);
      return;
    }
    await saveRecord('patient_tracking_summaries', {
      ...draft,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      tracking_type: type,
      recorded_at: new Date().toISOString()
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ category: CATEGORIES[0], status: 'in_place', patient_count: 0 });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={type === 'evacuation' ? 'Total in Evacuation Counts' : 'Total Patients Tracked'} value={total} tone="blue" />
        <StatCard label="Count Entries" value={all.length} />
      </div>
      <Card
        title={type === 'evacuation' ? 'Evacuation Counts (HICS 255/260 aggregate)' : 'Patient Tracking Counts (HICS 254 aggregate)'}
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Add Count</Button>}
      >
        {all.length === 0 ? (
          <EmptyState title="No count entries yet" />
        ) : (
          <DataTable head={['Category', 'Unit / Area', type === 'evacuation' ? 'Destination' : 'Location', 'Status', 'Count', 'Recorded']}>
            {all.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm">{row.category}</td>
                <td className="px-4 py-3 text-sm">{row.unit_or_area || '—'}</td>
                <td className="px-4 py-3 text-sm">{row.destination || '—'}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(row.status)}>{titleCase(row.status)}</Badge></td>
                <td className="px-4 py-3 text-sm font-semibold">{row.patient_count}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(row.recorded_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Aggregate Count">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Triage / Acuity Category">
              <Select value={draft.category ?? ''} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Count" required>
              <Input type="number" min={0} value={draft.patient_count ?? 0} onChange={(e) => setDraft((d) => ({ ...d, patient_count: Number(e.target.value) }))} required />
            </Field>
            <Field label="Unit / Area">
              <Input value={draft.unit_or_area ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit_or_area: e.target.value }))} />
            </Field>
            <Field label={type === 'evacuation' ? 'Destination' : 'Location / Destination'}>
              <Input value={draft.destination ?? ''} onChange={(e) => setDraft((d) => ({ ...d, destination: e.target.value }))} />
            </Field>
            <Field label="Status">
              <Select value={draft.status ?? 'in_place'} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                {TRACK_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Notes (no identifiers)">
            <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Add Count</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const CASUALTY_CATEGORIES: Array<CasualtySummary['category']> = ['treated_released', 'admitted', 'transferred', 'expired', 'morgue', 'other'];

function CasualtyPanel() {
  const { incident, currentPeriod } = useIncident();
  const { rows, reload } = useRecords<CasualtySummary>('casualty_summaries', {
    match: { incident_id: incident.id },
    orderBy: 'recorded_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<CasualtySummary>>({ category: 'treated_released', patient_count: 0 });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('casualty_summaries', {
      ...draft,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      recorded_at: new Date().toISOString()
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ category: 'treated_released', patient_count: 0 });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CASUALTY_CATEGORIES.slice(0, 4).map((cat) => (
          <StatCard
            key={cat}
            label={titleCase(cat)}
            value={sumBy(rows.filter((r) => r.category === cat), (r) => r.patient_count)}
            tone={cat === 'expired' ? 'red' : 'slate'}
          />
        ))}
      </div>
      <Card
        title="Casualty / Fatality Counts (HICS 259 aggregate)"
        actions={<Button size="sm" onClick={() => setShowNew(true)}><Plus size={14} /> Add Count</Button>}
      >
        {rows.length === 0 ? (
          <EmptyState title="No casualty counts recorded" />
        ) : (
          <DataTable head={['Category', 'Count', 'Notes', 'Recorded']}>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm">{titleCase(row.category)}</td>
                <td className="px-4 py-3 text-sm font-semibold">{row.patient_count}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{row.notes || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(row.recorded_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Add Casualty Count">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select value={draft.category ?? 'treated_released'} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                {CASUALTY_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            </Field>
            <Field label="Count" required>
              <Input type="number" min={0} value={draft.patient_count ?? 0} onChange={(e) => setDraft((d) => ({ ...d, patient_count: Number(e.target.value) }))} required />
            </Field>
          </div>
          <Field label="Notes (no identifiers)">
            <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Add Count</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ReunificationPanel() {
  const { incident } = useIncident();
  const { rows, reload } = useRecords<ReunificationLog>('reunification_log', {
    match: { incident_id: incident.id },
    orderBy: 'recorded_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<ReunificationLog>>({ inquiries_received: 0, inquiries_resolved: 0, reunifications_completed: 0, pending_cases: 0 });

  const latest = rows[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('reunification_log', { ...draft, incident_id: incident.id, recorded_at: new Date().toISOString() } as Record<string, unknown>);
    setShowNew(false);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Inquiries Received" value={latest?.inquiries_received ?? 0} />
        <StatCard label="Inquiries Resolved" value={latest?.inquiries_resolved ?? 0} tone="green" />
        <StatCard label="Reunifications" value={latest?.reunifications_completed ?? 0} tone="blue" />
        <StatCard label="Pending Cases" value={latest?.pending_cases ?? 0} tone={latest?.pending_cases ? 'yellow' : 'slate'} />
      </div>
      <Card
        title="Family Reunification / Patient Inquiry (aggregate workflow)"
        subtitle="Counts and coordination status only — no patient or family identifying data is stored here"
        actions={<Button size="sm" onClick={() => { setDraft(latest ? { ...latest, id: undefined } as Partial<ReunificationLog> : draft); setShowNew(true); }}><Plus size={14} /> Update Counts</Button>}
      >
        {rows.length === 0 ? (
          <EmptyState title="No reunification updates" />
        ) : (
          <DataTable head={['Recorded', 'Received', 'Resolved', 'Reunified', 'Pending', 'Notes']}>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(row.recorded_at)}</td>
                <td className="px-4 py-3 text-sm">{row.inquiries_received}</td>
                <td className="px-4 py-3 text-sm">{row.inquiries_resolved}</td>
                <td className="px-4 py-3 text-sm">{row.reunifications_completed}</td>
                <td className="px-4 py-3 text-sm font-semibold">{row.pending_cases}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{row.notes || '—'}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Update Reunification Counts">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([
              ['inquiries_received', 'Inquiries Received'],
              ['inquiries_resolved', 'Inquiries Resolved'],
              ['reunifications_completed', 'Reunifications Completed'],
              ['pending_cases', 'Pending Cases']
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  min={0}
                  value={Number(draft[key] ?? 0)}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                />
              </Field>
            ))}
          </div>
          <Field label="Notes (no identifiers)">
            <Textarea value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Save Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
