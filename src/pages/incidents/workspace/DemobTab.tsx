import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck as CheckCircle2, ClipboardCheck, FileText, PowerOff } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { Button, Card, StatCard } from '../../../components/ui';
import { fmtMoney, sumBy } from '../../../lib/utils';
import type { CostRecord, LaborPoolEntry, ResourceCheckout, ResourceRequest } from '../../../types/domain';

// Demobilization workflow (spec §11): release resources and staff, verify the
// record is complete, capture final costs, and trigger the After-Action Report.

export function DemobTab() {
  const { incident, reload } = useIncident();
  const { profile, can } = useAuth();
  const navigate = useNavigate();

  const match = { incident_id: incident.id };
  const { rows: checkouts, reload: reloadCheckouts } = useRecords<ResourceCheckout>('resource_checkouts', { match });
  const { rows: labor, reload: reloadLabor } = useRecords<LaborPoolEntry>('labor_pool_entries', { match });
  const { rows: requests, reload: reloadRequests } = useRecords<ResourceRequest>('resource_requests', { match });
  const { rows: costs } = useRecords<CostRecord>('cost_records', { match });

  const [busy, setBusy] = useState('');
  const [aarCreated, setAarCreated] = useState(false);

  const outstandingCheckouts = checkouts.filter((c) => !c.checked_in_at);
  const activeStaff = labor.filter((l) => l.status !== 'released');
  const openRequests = requests.filter((r) => ['submitted', 'in_review', 'approved', 'ordered'].includes(r.status));
  const totalCost = sumBy(costs, (c) => c.amount);

  const readyToClose = outstandingCheckouts.length === 0 && activeStaff.length === 0 && openRequests.length === 0;

  const releaseAllStaff = async () => {
    setBusy('staff');
    try {
      for (const entry of activeStaff) {
        await saveRecord('labor_pool_entries', {
          ...entry,
          status: 'released',
          released_at: new Date().toISOString()
        } as unknown as Record<string, unknown>);
      }
      await reloadLabor();
    } finally {
      setBusy('');
    }
  };

  const returnAllResources = async () => {
    setBusy('resources');
    try {
      for (const checkout of outstandingCheckouts) {
        await saveRecord('resource_checkouts', {
          ...checkout,
          checked_in_at: new Date().toISOString(),
          demobilized: true
        } as unknown as Record<string, unknown>);
      }
      await reloadCheckouts();
    } finally {
      setBusy('');
    }
  };

  const closeOpenRequests = async () => {
    setBusy('requests');
    try {
      for (const request of openRequests) {
        await saveRecord('resource_requests', {
          ...request,
          status: request.status === 'ordered' ? 'delivered' : 'demobilized'
        } as unknown as Record<string, unknown>);
      }
      await reloadRequests();
    } finally {
      setBusy('');
    }
  };

  const createAar = async () => {
    setBusy('aar');
    try {
      await saveRecord('aar_reports', {
        incident_id: incident.id,
        title: `AAR — ${incident.name}`,
        summary: '',
        objectives: [],
        status: 'draft'
      });
      logAudit('aar.created', 'incident', incident.id, {});
      setAarCreated(true);
    } finally {
      setBusy('');
    }
  };

  const beginDemob = async () => {
    await saveRecord('incidents', { ...incident, status: 'demobilizing' } as unknown as Record<string, unknown>);
    logAudit('incident.demobilizing', 'incident', incident.id, {});
    await reload();
  };

  const closeIncident = async () => {
    await saveRecord('incidents', {
      ...incident,
      status: 'closed',
      ended_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    logAudit('incident.closed', 'incident', incident.id, { total_cost: totalCost, closed_by: profile?.full_name });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Resources Outstanding" value={outstandingCheckouts.length} tone={outstandingCheckouts.length ? 'yellow' : 'green'} />
        <StatCard label="Staff Not Released" value={activeStaff.length} tone={activeStaff.length ? 'yellow' : 'green'} />
        <StatCard label="Open Requests" value={openRequests.length} tone={openRequests.length ? 'yellow' : 'green'} />
        <StatCard label="Final Cost to Date" value={fmtMoney(totalCost)} tone="blue" />
      </div>

      <Card title="Demobilization Checklist" subtitle="Release resources and personnel, verify records, capture final costs, then close.">
        <div className="space-y-3">
          <DemobStep
            done={outstandingCheckouts.length === 0}
            label={`Return checked-out resources (${outstandingCheckouts.length} outstanding)`}
            action={outstandingCheckouts.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => void returnAllResources()} disabled={busy === 'resources'}>
                Return All
              </Button>
            )}
          />
          <DemobStep
            done={activeStaff.length === 0}
            label={`Release labor pool personnel (${activeStaff.length} still active)`}
            action={activeStaff.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => void releaseAllStaff()} disabled={busy === 'staff'}>
                Release All
              </Button>
            )}
          />
          <DemobStep
            done={openRequests.length === 0}
            label={`Resolve open resource requests (${openRequests.length} open)`}
            action={openRequests.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => void closeOpenRequests()} disabled={busy === 'requests'}>
                Close Out Requests
              </Button>
            )}
          />
          <DemobStep
            done={aarCreated}
            label="Initiate After-Action Report / Improvement Plan"
            action={
              aarCreated ? (
                <Button size="sm" variant="ghost" onClick={() => navigate('/preparedness/aar')}>Open AAR</Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void createAar()} disabled={busy === 'aar'}>
                  <FileText size={14} /> Create AAR
                </Button>
              )
            }
          />
        </div>
      </Card>

      {can('close_incident') && (
        <Card title="Close Out">
          <div className="flex flex-wrap items-center gap-3">
            {incident.status === 'active' && (
              <Button variant="secondary" onClick={() => void beginDemob()}>
                <ClipboardCheck size={16} /> Begin Demobilization
              </Button>
            )}
            <Button variant={readyToClose ? 'danger' : 'secondary'} onClick={() => void closeIncident()} disabled={incident.status === 'closed'}>
              <PowerOff size={16} /> {incident.status === 'closed' ? 'Incident Closed' : 'Close Incident'}
            </Button>
            {!readyToClose && incident.status !== 'closed' && (
              <p className="text-xs text-amber-300">Checklist items remain — closing now is allowed but flagged in the audit log.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function DemobStep({ done, label, action }: { done: boolean; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3">
      <div className="flex items-center gap-3">
        <CheckCircle2 size={20} className={done ? 'text-emerald-400' : 'text-slate-600'} />
        <span className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-200'}`}>{label}</span>
      </div>
      {action}
    </div>
  );
}
