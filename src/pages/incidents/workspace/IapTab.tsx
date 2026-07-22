import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, Download, FileStack, Plus, Send, Wand2, X } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { exportFormPdf, exportIapPacketPdf } from '../../../lib/pdf';
import { periodLabel } from '../../../lib/formPrefill';
import { IAP_FORM_CODES } from '../../../data/hicsForms';
import { Badge, Button, Card, EmptyState, statusTone } from '../../../components/ui';
import { fmtDateTime, titleCase } from '../../../lib/utils';
import { useResolvedTemplates } from './FormsTab';
import type { FormInstance, Iap, IapForm } from '../../../types/domain';

// IAP lifecycle: draft → in_review → approved (IC) → published → archived.
// Two ways through it: the step-by-step flow, or Approve & Assemble — one
// click that approves every attached form, IC-approves the IAP, and produces
// the ordered PDF packet (the Essential IAP assembly workflow).

export function IapTab() {
  const { incident, currentPeriod } = useIncident();
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const templates = useResolvedTemplates();

  const { rows: iaps, reload: reloadIaps } = useRecords<Iap>('iaps', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: false
  });
  const { rows: iapForms, reload: reloadIapForms } = useRecords<IapForm>('iap_forms', {});
  const { rows: instances, reload: reloadInstances } = useRecords<FormInstance>('form_instances', {
    match: { incident_id: incident.id },
    orderBy: 'template_code',
    ascending: true
  });

  const [busy, setBusy] = useState(false);

  const currentIap = useMemo(
    () => iaps.find((i) => i.operational_period_id === currentPeriod?.id) ?? iaps.find((i) => i.status !== 'archived') ?? null,
    [iaps, currentPeriod]
  );
  const attachedForms = useMemo(
    () => (currentIap ? iapForms.filter((f) => f.iap_id === currentIap.id).sort((a, b) => a.sort_order - b.sort_order) : []),
    [iapForms, currentIap]
  );
  const attachedInstanceIds = new Set(attachedForms.map((f) => f.form_instance_id));
  const availableInstances = instances.filter((i) => !attachedInstanceIds.has(i.id));

  const instanceFor = (link: IapForm) => instances.find((i) => i.id === link.form_instance_id);
  const templateFor = (instance: FormInstance | undefined) =>
    instance ? templates.find((t) => t.code === instance.template_code) : undefined;

  const createIap = async () => {
    setBusy(true);
    try {
      const iap = await saveRecord('iaps', {
        incident_id: incident.id,
        operational_period_id: currentPeriod?.id ?? null,
        title: `IAP — ${incident.name} — OP ${currentPeriod?.period_number ?? 1}`,
        status: 'draft'
      });
      // Auto-attach any already-filled priority IAP forms for this period.
      let order = 0;
      for (const code of IAP_FORM_CODES) {
        const instance = instances.find(
          (i) => i.template_code === code && (!currentPeriod || i.operational_period_id === currentPeriod.id)
        );
        if (instance) {
          await saveRecord('iap_forms', { iap_id: iap.id, form_instance_id: instance.id, sort_order: order++ });
        }
      }
      logAudit('iap.created', 'iap', String(iap.id), { incident_id: incident.id });
      await Promise.all([reloadIaps(), reloadIapForms()]);
    } finally {
      setBusy(false);
    }
  };

  const attachForm = async (instance: FormInstance) => {
    if (!currentIap) return;
    await saveRecord('iap_forms', {
      iap_id: currentIap.id,
      form_instance_id: instance.id,
      sort_order: attachedForms.length
    });
    await reloadIapForms();
  };

  const detachForm = async (link: IapForm) => {
    await deleteRecord('iap_forms', link.id);
    await reloadIapForms();
  };

  const moveForm = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= attachedForms.length) return;
    const next = [...attachedForms];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await Promise.all(
      next.map((link, i) =>
        link.sort_order === i
          ? Promise.resolve()
          : saveRecord('iap_forms', { ...link, sort_order: i } as unknown as Record<string, unknown>).then(() => undefined)
      )
    );
    await reloadIapForms();
  };

  const setStatus = async (status: Iap['status']) => {
    if (!currentIap) return;
    await saveRecord('iaps', {
      ...currentIap,
      status,
      approved_by: status === 'approved' ? profile?.id ?? null : currentIap.approved_by,
      approved_by_name: status === 'approved' ? profile?.full_name ?? '' : currentIap.approved_by_name,
      approved_at: status === 'approved' ? new Date().toISOString() : currentIap.approved_at,
      published_at: status === 'published' ? new Date().toISOString() : currentIap.published_at
    } as unknown as Record<string, unknown>);
    logAudit(`iap.${status}`, 'iap', currentIap.id, { incident_id: incident.id });
    await reloadIaps();
  };

  const buildPacketForms = (byId: Map<string, FormInstance>) =>
    attachedForms
      .map((link) => {
        const instance = byId.get(link.form_instance_id) ?? instanceFor(link);
        const template = templateFor(instance);
        return instance && template ? { template, data: instance.data } : null;
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

  const generatePacket = (iap: Iap = currentIap!, byId: Map<string, FormInstance> = new Map()) => {
    const forms = buildPacketForms(byId);
    exportIapPacketPdf({
      incidentName: incident.name,
      periodLabel: periodLabel(currentPeriod) || 'Operational Period —',
      status: iap.status,
      approvedByName: iap.approved_by_name || undefined,
      approvedAt: iap.approved_at,
      forms
    });
    logAudit('iap.packet_generated', 'iap', iap.id, { forms: forms.length });
  };

  /**
   * One-click assembly: approve every attached form that isn't yet approved,
   * move the IAP itself to IC-approved, then generate the ordered PDF packet.
   */
  const approveAndAssemble = async () => {
    if (!currentIap || !attachedForms.length) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const approved = new Map<string, FormInstance>();
      for (const link of attachedForms) {
        const instance = instanceFor(link);
        if (!instance) continue;
        if (instance.status !== 'approved' && instance.status !== 'final') {
          const updated = {
            ...instance,
            status: 'approved',
            approved_by: profile?.id ?? null,
            approved_at: now
          } as FormInstance;
          await saveRecord('form_instances', updated as unknown as Record<string, unknown>);
          logAudit('form.approved', 'form_instance', instance.id, {
            template: instance.template_code,
            via: 'iap_auto_assemble'
          });
          approved.set(instance.id, updated);
        }
      }

      let iap = currentIap;
      if (iap.status === 'draft' || iap.status === 'in_review') {
        iap = {
          ...iap,
          status: 'approved',
          approved_by: profile?.id ?? null,
          approved_by_name: profile?.full_name ?? '',
          approved_at: now
        };
        await saveRecord('iaps', iap as unknown as Record<string, unknown>);
        logAudit('iap.approved', 'iap', iap.id, { incident_id: incident.id, via: 'auto_assemble' });
      }

      generatePacket(iap, approved);
      await Promise.all([reloadIaps(), reloadInstances()]);
    } finally {
      setBusy(false);
    }
  };

  if (!currentIap) {
    return (
      <EmptyState
        title="No IAP for this operational period"
        hint="Create the IAP shell — filled priority forms attach automatically. Then approve step by step, or use Approve & Assemble for one-click approval and PDF packet."
        action={<Button onClick={() => void createIap()} disabled={busy}><FileStack size={16} /> Create IAP</Button>}
      />
    );
  }

  const statusFlow: Array<{ status: Iap['status']; label: string; needsApprovePermission?: boolean }> = [
    { status: 'in_review', label: 'Send for Review' },
    { status: 'approved', label: 'IC Approve', needsApprovePermission: true },
    { status: 'published', label: 'Publish / Distribute' },
    { status: 'archived', label: 'Archive' }
  ];
  const currentIndex = ['draft', 'in_review', 'approved', 'published', 'archived'].indexOf(currentIap.status);
  const pendingApprovalCount = attachedForms.filter((link) => {
    const instance = instanceFor(link);
    return instance && instance.status !== 'approved' && instance.status !== 'final';
  }).length;

  return (
    <div className="space-y-4">
      <Card
        title={currentIap.title}
        subtitle={periodLabel(currentPeriod)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(currentIap.status)}>{titleCase(currentIap.status)}</Badge>
            {can('approve_iap') && currentIap.status !== 'archived' && (
              <Button
                size="sm"
                variant="success"
                disabled={busy || attachedForms.length === 0}
                onClick={() => void approveAndAssemble()}
                title="Approve all attached forms, IC-approve the IAP, and generate the PDF packet"
              >
                <Wand2 size={15} /> {busy ? 'Assembling…' : 'Approve & Assemble (PDF)'}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => generatePacket()}>
              <Download size={15} /> Generate IAP Packet (PDF)
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {statusFlow.map((step, i) => {
            const stepIndex = i + 1;
            const isNext = stepIndex === currentIndex + 1;
            const done = stepIndex <= currentIndex;
            const blocked = step.needsApprovePermission && !can('approve_iap');
            return (
              <Button
                key={step.status}
                size="sm"
                variant={done ? 'ghost' : isNext ? (step.status === 'approved' ? 'success' : 'primary') : 'secondary'}
                disabled={!isNext || blocked}
                onClick={() => void setStatus(step.status)}
              >
                {done ? <CheckCircle2 size={14} /> : step.status === 'published' ? <Send size={14} /> : null}
                {step.label}
              </Button>
            );
          })}
        </div>
        {pendingApprovalCount > 0 && (
          <p className="mt-3 text-xs text-amber-300/90">
            {pendingApprovalCount} attached form{pendingApprovalCount > 1 ? 's' : ''} not yet approved — Approve &
            Assemble will approve them for you.
          </p>
        )}
        {currentIap.approved_by_name && (
          <p className="mt-3 text-xs text-slate-400">
            Approved by {currentIap.approved_by_name} — {fmtDateTime(currentIap.approved_at)}
          </p>
        )}
      </Card>

      <Card
        title={`Packet contents (${attachedForms.length})`}
        subtitle="Forms appear in the PDF packet in this order. Reorder with the arrows."
      >
        {attachedForms.length === 0 ? (
          <EmptyState
            title="No forms attached yet"
            hint="Attach filled forms from the list below — priority IAP forms are HICS 200, 202, 203, 204, 205A, 206, 215A."
          />
        ) : (
          <div className="space-y-2">
            {attachedForms.map((link, index) => {
              const instance = instanceFor(link);
              if (!instance) return null;
              const template = templateFor(instance);
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <button
                        onClick={() => void moveForm(index, -1)}
                        disabled={index === 0}
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30"
                        aria-label="Move up"
                        type="button"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => void moveForm(index, 1)}
                        disabled={index === attachedForms.length - 1}
                        className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100 disabled:opacity-30"
                        aria-label="Move down"
                        type="button"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        {index + 1}. {instance.template_code} — {instance.template_title}
                      </p>
                      <p className="text-xs text-slate-400">v{instance.version} · {instance.prepared_by_name || 'Unknown preparer'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(instance.status)}>{titleCase(instance.status)}</Badge>
                    {template && (
                      <button
                        onClick={() =>
                          exportFormPdf(template, instance.data, {
                            incidentName: incident.name,
                            periodLabel: periodLabel(currentPeriod)
                          })
                        }
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100"
                        title="Export this form as PDF"
                        type="button"
                      >
                        <Download size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => void detachForm(link)}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-900/40 hover:text-red-300"
                      title="Remove from packet"
                      type="button"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Available forms"
        subtitle="Filled forms for this incident not yet in the packet. Missing one? Start it in the Forms tab."
      >
        {availableInstances.length === 0 ? (
          <EmptyState
            title={instances.length === 0 ? 'No forms filled for this incident yet' : 'All filled forms are attached'}
            action={
              <Button variant="secondary" onClick={() => navigate(`/incidents/${incident.id}/forms`)}>
                Go to Forms
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {availableInstances.map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{instance.template_code} — {instance.template_title}</p>
                  <p className="text-xs text-slate-400">v{instance.version} · {instance.prepared_by_name || 'Unknown preparer'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(instance.status)}>{titleCase(instance.status)}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => void attachForm(instance)}>
                    <Plus size={14} /> Attach
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
