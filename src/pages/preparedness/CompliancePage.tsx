import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, Download, Paperclip } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { exportTablePdf } from '../../lib/pdf';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, Textarea, statusTone } from '../../components/ui';
import { fmtDate, titleCase } from '../../lib/utils';
import type { ComplianceEvidence, ComplianceRequirement, ComplianceStatus, Exercise } from '../../types/domain';

// Compliance dashboard against the pre-loaded, element-level CMS EP Rule and
// Joint Commission EM starter library (seeded in migrations, versioned).
// Evidence attaches per element; the binder exports survey-ready.

const STATUS_OPTIONS: Array<ComplianceStatus['status']> = ['not_assessed', 'met', 'partially_met', 'not_met', 'not_applicable'];

export function CompliancePage() {
  const navigate = useNavigate();
  const { rows: requirements } = useRecords<ComplianceRequirement>('compliance_requirements', { orderBy: 'sort_order' });
  const { rows: statuses, reload: reloadStatuses } = useRecords<ComplianceStatus>('compliance_statuses', {});
  const { rows: evidence, reload: reloadEvidence } = useRecords<ComplianceEvidence>('compliance_evidence', {});
  const { rows: exercises } = useRecords<Exercise>('exercises', { orderBy: 'title' });

  const [framework, setFramework] = useState('cms');
  const [evidenceFor, setEvidenceFor] = useState<ComplianceRequirement | null>(null);
  const [evidenceDraft, setEvidenceDraft] = useState<Partial<ComplianceEvidence>>({ evidence_type: 'document' });

  const statusFor = (requirementId: string) => statuses.find((s) => s.requirement_id === requirementId);
  const evidenceCount = (requirementId: string) => evidence.filter((e) => e.requirement_id === requirementId).length;

  const filtered = requirements.filter((r) => r.framework === framework);
  const grouped = useMemo(() => {
    const map = new Map<string, ComplianceRequirement[]>();
    for (const req of filtered) {
      const key = req.category || 'General';
      map.set(key, [...(map.get(key) ?? []), req]);
    }
    return [...map.entries()];
  }, [filtered]);

  const counts = useMemo(() => {
    const met = filtered.filter((r) => statusFor(r.id)?.status === 'met').length;
    const partial = filtered.filter((r) => statusFor(r.id)?.status === 'partially_met').length;
    const notMet = filtered.filter((r) => statusFor(r.id)?.status === 'not_met').length;
    return { met, partial, notMet, total: filtered.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, statuses]);

  const setStatus = async (requirement: ComplianceRequirement, status: ComplianceStatus['status']) => {
    const existing = statusFor(requirement.id);
    await saveRecord('compliance_statuses', {
      ...(existing ?? { requirement_id: requirement.id }),
      status,
      last_reviewed: new Date().toISOString().slice(0, 10)
    } as Record<string, unknown>);
    await reloadStatuses();
  };

  const addEvidence = async (e: FormEvent) => {
    e.preventDefault();
    if (!evidenceFor) return;
    await saveRecord('compliance_evidence', {
      ...evidenceDraft,
      requirement_id: evidenceFor.id,
      evidence_date: evidenceDraft.evidence_date ?? new Date().toISOString().slice(0, 10)
    } as Record<string, unknown>);
    setEvidenceFor(null);
    setEvidenceDraft({ evidence_type: 'document' });
    await reloadEvidence();
  };

  const exportBinder = () => {
    exportTablePdf(
      `Compliance Evidence Binder — ${framework === 'cms' ? 'CMS Emergency Preparedness Rule' : 'Joint Commission EM'}`,
      `Survey-ready export · ${counts.met}/${counts.total} elements met`,
      [
        { key: 'reference_code', label: 'Standard' },
        { key: 'element_code', label: 'Element' },
        { key: 'title', label: 'Requirement' },
        { key: 'status', label: 'Status' },
        { key: 'evidence', label: 'Evidence' },
        { key: 'last_reviewed', label: 'Reviewed' }
      ],
      filtered.map((req) => {
        const status = statusFor(req.id);
        const items = evidence.filter((e) => e.requirement_id === req.id);
        return {
          reference_code: req.reference_code,
          element_code: req.element_code,
          title: req.title,
          status: titleCase(status?.status ?? 'not_assessed'),
          evidence: items.map((e) => `${e.title} (${e.evidence_type}, ${e.evidence_date ?? ''})`).join('; ') || '—',
          last_reviewed: status?.last_reviewed ?? '—'
        };
      }),
      `compliance-binder-${framework}.pdf`
    );
  };

  return (
    <div>
      <PageHeader
        title="Compliance"
        subtitle="Element-level CMS EP Rule and Joint Commission EM starter library (version 2024.1-starter) — map evidence and export the survey binder"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/preparedness/plan-builder')}>
              <BookOpenCheck size={16} /> Draft an EOP for these elements
            </Button>
            <Button variant="secondary" onClick={exportBinder}><Download size={16} /> Evidence Binder (PDF)</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Elements" value={counts.total} />
        <StatCard label="Met" value={counts.met} tone="green" />
        <StatCard label="Partially Met" value={counts.partial} tone={counts.partial ? 'yellow' : 'slate'} />
        <StatCard label="Not Met" value={counts.notMet} tone={counts.notMet ? 'red' : 'green'} />
      </div>

      <Tabs
        tabs={[
          { key: 'cms', label: 'CMS EP Rule (42 CFR 482.15)' },
          { key: 'tjc', label: 'Joint Commission EM' }
        ]}
        active={framework}
        onChange={setFramework}
      />

      {grouped.length === 0 ? (
        <EmptyState
          title="Compliance library not loaded"
          hint="The starter library is seeded by the database migrations. Apply supabase/migrations to populate it."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, reqs]) => (
            <Card key={category} title={category}>
              <div className="space-y-2">
                {reqs.map((req) => {
                  const status = statusFor(req.id);
                  const evCount = evidenceCount(req.id);
                  return (
                    <div key={req.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-100">
                          <span className="mr-2 text-xs font-semibold text-brand-400">{req.reference_code} · {req.element_code}</span>
                          {req.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{req.description}</p>
                        {status?.last_reviewed && (
                          <p className="mt-1 text-[10px] text-slate-500">Last reviewed {fmtDate(status.last_reviewed)}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => setEvidenceFor(req)} className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                          <Paperclip size={13} /> {evCount} evidence
                        </button>
                        <Select
                          className="!min-h-0 !w-auto !py-1.5 text-xs"
                          value={status?.status ?? 'not_assessed'}
                          onChange={(e) => void setStatus(req, e.target.value as ComplianceStatus['status'])}
                        >
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                        </Select>
                        <Badge tone={statusTone(status?.status ?? 'pending')}>{titleCase(status?.status ?? 'not_assessed')}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(evidenceFor)} onClose={() => setEvidenceFor(null)} title={`Evidence — ${evidenceFor?.element_code ?? ''}`}>
        <div className="mb-4 space-y-2">
          {evidence.filter((e) => e.requirement_id === evidenceFor?.id).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm">
              <p className="font-medium text-slate-100">{item.title}</p>
              <p className="text-xs text-slate-400">{titleCase(item.evidence_type)} · {fmtDate(item.evidence_date)}</p>
              {item.description && <p className="mt-1 text-xs text-slate-400">{item.description}</p>}
            </div>
          ))}
        </div>
        <form onSubmit={addEvidence} className="space-y-4 border-t border-slate-700 pt-4">
          <Field label="Evidence Title" required>
            <Input value={evidenceDraft.title ?? ''} onChange={(e) => setEvidenceDraft((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={evidenceDraft.evidence_type ?? 'document'} onChange={(e) => setEvidenceDraft((d) => ({ ...d, evidence_type: e.target.value as ComplianceEvidence['evidence_type'] }))}>
                {['document', 'exercise', 'attestation', 'training', 'other'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
              </Select>
            </Field>
            <Field label="Evidence Date">
              <Input type="date" value={evidenceDraft.evidence_date ?? ''} onChange={(e) => setEvidenceDraft((d) => ({ ...d, evidence_date: e.target.value }))} />
            </Field>
          </div>
          {evidenceDraft.evidence_type === 'exercise' && (
            <Field label="Linked Exercise">
              <Select value={evidenceDraft.exercise_id ?? ''} onChange={(e) => setEvidenceDraft((d) => ({ ...d, exercise_id: e.target.value || null }))}>
                <option value="">—</option>
                {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Description">
            <Textarea value={evidenceDraft.description ?? ''} onChange={(e) => setEvidenceDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEvidenceFor(null)}>Close</Button>
            <Button type="submit">Attach Evidence</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
