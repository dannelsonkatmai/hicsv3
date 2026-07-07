import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, FileStack, Send } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { exportIapPacketPdf } from '../../../lib/pdf';
import { periodLabel } from '../../../lib/formPrefill';
import { IAP_FORM_CODES } from '../../../data/hicsForms';
import { Badge, Button, Card, EmptyState, statusTone } from '../../../components/ui';
import { fmtDateTime, titleCase } from '../../../lib/utils';
import { useResolvedTemplates } from './FormsTab';
import type { FormInstance, Iap, IapForm } from '../../../types/domain';

// IAP lifecycle: draft → in_review → approved (IC) → published → archived,
// with one-click PDF packet generation for the operational period.

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
  const { rows: instances } = useRecords<FormInstance>('form_instances', {
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

  const toggleForm = async (instance: FormInstance) => {
    if (!currentIap) return;
    const existing = attachedForms.find((f) => f.form_instance_id === instance.id);
    if (existing) {
      await deleteRecord('iap_forms', existing.id);
    } else {
      await saveRecord('iap_forms', {
        iap_id: currentIap.id,
        form_instance_id: instance.id,
        sort_order: attachedForms.length
      });
    }
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

  const generatePacket = () => {
    if (!currentIap) return;
    const forms = attachedForms
      .map((link) => {
        const instance = instances.find((i) => i.id === link.form_instance_id);
        const template = instance ? templates.find((t) => t.code === instance.template_code) : undefined;
        return instance && template ? { template, data: instance.data } : null;
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    exportIapPacketPdf({
      incidentName: incident.name,
      periodLabel: periodLabel(currentPeriod) || 'Operational Period —',
      status: currentIap.status,
      approvedByName: currentIap.approved_by_name || undefined,
      approvedAt: currentIap.approved_at,
      forms
    });
    logAudit('iap.packet_generated', 'iap', currentIap.id, { forms: forms.length });
  };

  if (!currentIap) {
    return (
      <EmptyState
        title="No IAP for this operational period"
        hint="Create the IAP shell, attach approved HICS forms, route it for Incident Commander approval, then publish and generate the PDF packet."
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

  return (
    <div className="space-y-4">
      <Card
        title={currentIap.title}
        subtitle={periodLabel(currentPeriod)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(currentIap.status)}>{titleCase(currentIap.status)}</Badge>
            <Button size="sm" variant="secondary" onClick={generatePacket}>
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
        {currentIap.approved_by_name && (
          <p className="mt-3 text-xs text-slate-400">
            Approved by {currentIap.approved_by_name} — {fmtDateTime(currentIap.approved_at)}
          </p>
        )}
      </Card>

      <Card
        title="Forms in this IAP"
        subtitle="Toggle which filled forms compose the packet. Missing a form? Start it in the Forms tab — priority IAP forms are HICS 200, 202, 203, 204, 205A, 206, 215A."
      >
        {instances.length === 0 ? (
          <EmptyState
            title="No forms filled for this incident yet"
            action={<Button variant="secondary" onClick={() => navigate(`/incidents/${incident.id}/forms`)}>Go to Forms</Button>}
          />
        ) : (
          <div className="space-y-2">
            {instances.map((instance) => (
              <label
                key={instance.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-700 bg-slate-800 p-3 hover:border-brand-600"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={attachedInstanceIds.has(instance.id)}
                    onChange={() => void toggleForm(instance)}
                    className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-100">{instance.template_code} — {instance.template_title}</p>
                    <p className="text-xs text-slate-400">v{instance.version} · {instance.prepared_by_name || 'Unknown preparer'}</p>
                  </div>
                </div>
                <Badge tone={statusTone(instance.status)}>{titleCase(instance.status)}</Badge>
              </label>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
