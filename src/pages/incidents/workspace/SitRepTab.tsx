import { useState, type FormEvent } from 'react';
import { Download, Plus, Send } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, listRecords } from '../../../lib/repo';
import { exportTablePdf } from '../../../lib/pdf';
import { periodLabel } from '../../../lib/formPrefill';
import { Badge, Button, Card, EmptyState, Field, Modal, Textarea, statusTone } from '../../../components/ui';
import { fmtDateTime, sumBy, titleCase } from '../../../lib/utils';
import type { SitRep } from '../../../types/domain';

// SitRep builder: pulls the live board metrics into a point-in-time report
// per operational period, exportable to PDF.

export function SitRepTab() {
  const { incident, currentPeriod } = useIncident();
  const { profile } = useAuth();
  const { rows: sitreps, reload } = useRecords<SitRep>('sitreps', {
    match: { incident_id: incident.id },
    orderBy: 'sitrep_number',
    ascending: false
  });

  const [editing, setEditing] = useState<Partial<SitRep> | null>(null);
  const [busy, setBusy] = useState(false);

  const openNew = async () => {
    setBusy(true);
    try {
      // Auto-capture current board metrics into the SitRep.
      const [beds, acuity, supplies, staffing, systems] = await Promise.all([
        listRecords<Record<string, unknown>>('bed_status_entries', { match: { incident_id: incident.id } }),
        listRecords<Record<string, unknown>>('acuity_entries', { match: { incident_id: incident.id } }),
        listRecords<Record<string, unknown>>('supply_status_entries', { match: { incident_id: incident.id } }),
        listRecords<Record<string, unknown>>('staffing_status_entries', { match: { incident_id: incident.id } }),
        listRecords<Record<string, unknown>>('facility_system_status', { match: { incident_id: incident.id } })
      ]);
      const current = (rows: Record<string, unknown>[]) => rows.filter((r) => !r.is_snapshot);
      const metrics = {
        staffed_beds: sumBy(current(beds), (r) => r.staffed_beds as number),
        occupied_beds: sumBy(current(beds), (r) => r.occupied_beds as number),
        available_beds: sumBy(current(beds), (r) => r.available_beds as number),
        surge_beds: sumBy(current(beds), (r) => r.surge_beds_available as number),
        patients_tracked: sumBy(current(acuity), (r) => r.patient_count as number),
        supplies_red: current(supplies).filter((r) => r.status === 'red').length,
        staffing_gap: sumBy(current(staffing), (r) => r.needed as number) - sumBy(current(staffing), (r) => r.on_hand as number),
        systems_down: current(systems).filter((r) => r.status === 'red').length
      };
      setEditing({
        sitrep_number: (sitreps[0]?.sitrep_number ?? 0) + 1,
        summary: '',
        current_situation: '',
        actions_taken: '',
        resource_needs: '',
        next_steps: '',
        metrics,
        status: 'draft'
      });
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent, publish = false) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('sitreps', {
      ...editing,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      reported_at: new Date().toISOString(),
      prepared_by_name: profile?.full_name ?? '',
      status: publish ? 'published' : editing.status ?? 'draft'
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  const exportPdf = (sitrep: SitRep) => {
    const m = sitrep.metrics as Record<string, number>;
    exportTablePdf(
      `SitRep #${sitrep.sitrep_number} — ${incident.name}`,
      periodLabel(currentPeriod) || 'Situation Report',
      [
        { key: 'field', label: 'Field' },
        { key: 'value', label: 'Value' }
      ],
      [
        { field: 'Summary', value: sitrep.summary },
        { field: 'Current Situation', value: sitrep.current_situation },
        { field: 'Actions Taken', value: sitrep.actions_taken },
        { field: 'Resource Needs', value: sitrep.resource_needs },
        { field: 'Next Steps', value: sitrep.next_steps },
        { field: 'Staffed Beds', value: m?.staffed_beds ?? '—' },
        { field: 'Occupied Beds', value: m?.occupied_beds ?? '—' },
        { field: 'Available Beds', value: m?.available_beds ?? '—' },
        { field: 'Surge Capacity', value: m?.surge_beds ?? '—' },
        { field: 'Patients Tracked (aggregate)', value: m?.patients_tracked ?? '—' },
        { field: 'Critical Supplies Red', value: m?.supplies_red ?? '—' },
        { field: 'Staffing Gap', value: m?.staffing_gap ?? '—' },
        { field: 'Facility Systems Down', value: m?.systems_down ?? '—' },
        { field: 'Prepared By', value: sitrep.prepared_by_name }
      ],
      `SitRep-${sitrep.sitrep_number}.pdf`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => void openNew()} disabled={busy}>
          <Plus size={16} /> {busy ? 'Capturing metrics…' : 'New SitRep'}
        </Button>
      </div>

      {sitreps.length === 0 ? (
        <EmptyState
          title="No situation reports yet"
          hint="A new SitRep automatically captures the current status-board metrics as a point-in-time snapshot."
        />
      ) : (
        sitreps.map((sitrep) => (
          <Card
            key={sitrep.id}
            title={`SitRep #${sitrep.sitrep_number}`}
            subtitle={`${fmtDateTime(sitrep.reported_at)} · ${sitrep.prepared_by_name || 'Unknown'}`}
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(sitrep.status)}>{titleCase(sitrep.status)}</Badge>
                <Button size="sm" variant="secondary" onClick={() => exportPdf(sitrep)}><Download size={14} /> PDF</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(sitrep)}>Edit</Button>
              </div>
            }
          >
            <p className="text-sm text-slate-300">{sitrep.summary || 'No summary.'}</p>
            {sitrep.metrics && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 md:grid-cols-4">
                {Object.entries(sitrep.metrics as Record<string, number>).map(([key, value]) => (
                  <div key={key} className="rounded bg-slate-800 px-2 py-1.5">
                    <span className="block text-slate-500">{titleCase(key)}</span>
                    <span className="font-semibold text-slate-200">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`SitRep #${editing?.sitrep_number ?? ''}`} wide>
        <form onSubmit={(e) => void save(e)} className="space-y-4">
          <Field label="Summary" span={3}>
            <Textarea value={editing?.summary ?? ''} onChange={(e) => setEditing((s) => ({ ...s, summary: e.target.value }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Current Situation">
              <Textarea value={editing?.current_situation ?? ''} onChange={(e) => setEditing((s) => ({ ...s, current_situation: e.target.value }))} />
            </Field>
            <Field label="Actions Taken">
              <Textarea value={editing?.actions_taken ?? ''} onChange={(e) => setEditing((s) => ({ ...s, actions_taken: e.target.value }))} />
            </Field>
            <Field label="Resource Needs">
              <Textarea value={editing?.resource_needs ?? ''} onChange={(e) => setEditing((s) => ({ ...s, resource_needs: e.target.value }))} />
            </Field>
            <Field label="Next Steps">
              <Textarea value={editing?.next_steps ?? ''} onChange={(e) => setEditing((s) => ({ ...s, next_steps: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="secondary">Save Draft</Button>
            <Button type="button" onClick={(e) => void save(e as unknown as FormEvent, true)}>
              <Send size={15} /> Publish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
