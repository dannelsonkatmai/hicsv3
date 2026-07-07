import { useState } from 'react';
import { Clock, Pencil } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { Badge, Button, Card, Field, Modal, Select, StatCard, statusTone } from '../../../components/ui';
import { fmtDateTime, sumBy, titleCase } from '../../../lib/utils';
import type { HimtAssignment, Objective, ResourceRequest, CostRecord, Incident } from '../../../types/domain';

export function OverviewTab() {
  const { incident, periods, currentPeriod, reload } = useIncident();
  const { can } = useAuth();
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodHours, setPeriodHours] = useState(12);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState(incident.status);
  const [newLevel, setNewLevel] = useState(incident.activation_level);

  const match = { incident_id: incident.id };
  const { rows: assignments } = useRecords<HimtAssignment>('himt_assignments', { match });
  const { rows: objectives } = useRecords<Objective>('objectives', { match });
  const { rows: requests } = useRecords<ResourceRequest>('resource_requests', { match });
  const { rows: costs } = useRecords<CostRecord>('cost_records', { match });

  const activeAssignments = assignments.filter((a) => !a.released_at);
  const openObjectives = objectives.filter((o) => o.status !== 'completed');
  const openRequests = requests.filter((r) => ['submitted', 'in_review', 'approved', 'ordered'].includes(r.status));
  const costToDate = sumBy(costs, (c) => c.amount);

  const rollPeriod = async () => {
    const now = new Date();
    if (currentPeriod) {
      await saveRecord('operational_periods', { ...currentPeriod, is_current: false } as unknown as Record<string, unknown>);
    }
    await saveRecord('operational_periods', {
      incident_id: incident.id,
      period_number: (currentPeriod?.period_number ?? 0) + 1,
      starts_at: now.toISOString(),
      ends_at: new Date(now.getTime() + periodHours * 3_600_000).toISOString(),
      is_current: true
    });
    logAudit('operational_period.rolled', 'incident', incident.id, { period: (currentPeriod?.period_number ?? 0) + 1 });
    setShowPeriodModal(false);
    await reload();
  };

  const updateStatus = async () => {
    await saveRecord('incidents', {
      ...incident,
      status: newStatus,
      activation_level: newLevel,
      ended_at: newStatus === 'closed' ? new Date().toISOString() : incident.ended_at
    } as unknown as Record<string, unknown>);
    logAudit('incident.status_changed', 'incident', incident.id, { status: newStatus, activation_level: newLevel });
    setShowStatusModal(false);
    await reload();
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="HIMT Positions Filled" value={activeAssignments.length} tone="blue" />
        <StatCard label="Open Objectives" value={openObjectives.length} tone={openObjectives.length ? 'yellow' : 'green'} />
        <StatCard label="Open Resource Requests" value={openRequests.length} tone={openRequests.length ? 'yellow' : 'slate'} />
        <StatCard label="Cost to Date" value={costToDate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Incident Details"
          actions={can('close_incident') && (
            <Button size="sm" variant="secondary" onClick={() => setShowStatusModal(true)}>
              <Pencil size={14} /> Update Status
            </Button>
          )}
        >
          <dl className="space-y-3 text-sm">
            {[
              ['Type', titleCase(incident.incident_type)],
              ['Scenario', incident.scenario || '—'],
              ['Command Center', incident.command_location || '—'],
              ['Started', fmtDateTime(incident.started_at)],
              ['Ended', incident.ended_at ? fmtDateTime(incident.ended_at) : '—'],
              ['Description', incident.description || '—']
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-slate-700/50 pb-2">
                <dt className="shrink-0 text-slate-400">{label}</dt>
                <dd className="text-right text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Clock size={15} /> Operational Periods</span>}
          actions={<Button size="sm" onClick={() => setShowPeriodModal(true)}>Roll Period Forward</Button>}
        >
          <div className="space-y-2">
            {[...periods].reverse().map((period) => (
              <div key={period.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3">
                <div>
                  <p className="text-sm font-medium">Operational Period {period.period_number}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(period.starts_at)} – {fmtDateTime(period.ends_at)}</p>
                </div>
                {period.is_current && <Badge tone="green">Current</Badge>}
              </div>
            ))}
            {periods.length === 0 && <p className="text-sm text-slate-500">No operational periods yet.</p>}
          </div>
        </Card>
      </div>

      <Modal open={showPeriodModal} onClose={() => setShowPeriodModal(false)} title="Roll Operational Period Forward">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Close operational period {currentPeriod?.period_number ?? '—'} and begin period {(currentPeriod?.period_number ?? 0) + 1}.
            A new IAP can then be assembled for the new period.
          </p>
          <Field label="New Period Duration">
            <Select value={String(periodHours)} onChange={(e) => setPeriodHours(Number(e.target.value))}>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowPeriodModal(false)}>Cancel</Button>
            <Button onClick={() => void rollPeriod()}>Start New Period</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Incident Status">
        <div className="space-y-4">
          <Field label="Status">
            <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as Incident['status'])}>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="demobilizing">Demobilizing</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
          <Field label="Activation Level">
            <Select value={newLevel} onChange={(e) => setNewLevel(e.target.value as Incident['activation_level'])}>
              <option value="monitoring">Monitoring</option>
              <option value="partial">Partial</option>
              <option value="full">Full</option>
            </Select>
          </Field>
          {newStatus === 'closed' && (
            <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-xs text-amber-200">
              Closing the incident records the end time. Complete demobilization and trigger the After-Action Report from
              the Demobilization tab first.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowStatusModal(false)}>Cancel</Button>
            <Button onClick={() => void updateStatus()}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
