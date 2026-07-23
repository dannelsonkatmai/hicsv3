import { useState, type FormEvent } from 'react';
import { Download, ListPlus, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { exportTablePdf } from '../../lib/pdf';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { fmtDate, titleCase } from '../../lib/utils';
import type { AarReport, CorrectiveAction, Exercise, Incident } from '../../types/domain';

export function AarPage() {
  const { rows: reports, reload } = useRecords<AarReport>('aar_reports', { orderBy: 'created_at', ascending: false });
  const { rows: exercises } = useRecords<Exercise>('exercises', { orderBy: 'title' });
  const { rows: incidents } = useRecords<Incident>('incidents', { orderBy: 'started_at', ascending: false });
  const { rows: capas, reload: reloadCapas } = useRecords<CorrectiveAction>('corrective_actions', {});

  const [editing, setEditing] = useState<Partial<AarReport> | null>(null);
  const [capaFor, setCapaFor] = useState<AarReport | null>(null);
  const [capaDraft, setCapaDraft] = useState<Partial<CorrectiveAction>>({ priority: 'medium', status: 'open' });
  const [reportDefaultsField, setReportDefaultsField] = useState<{ field: keyof AarReport; label: string } | null>(null);
  const [capaDefaultsField, setCapaDefaultsField] = useState(false);

  const appendReportText = (field: keyof AarReport, text: string) =>
    setEditing((d) => ({ ...d, [field]: [String(d?.[field] ?? ''), text].map((s) => s.trim()).filter(Boolean).join('\n') }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('aar_reports', {
      ...editing,
      completed_at: editing.status === 'final' && !editing.completed_at ? new Date().toISOString() : editing.completed_at
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  const addCapa = async (e: FormEvent) => {
    e.preventDefault();
    if (!capaFor) return;
    await saveRecord('corrective_actions', { ...capaDraft, aar_report_id: capaFor.id } as Record<string, unknown>);
    setCapaFor(null);
    setCapaDraft({ priority: 'medium', status: 'open' });
    await reloadCapas();
  };

  const exportPdf = (report: AarReport) =>
    exportTablePdf(
      report.title,
      'After-Action Report / Improvement Plan',
      [
        { key: 'field', label: 'Section' },
        { key: 'value', label: 'Content' }
      ],
      [
        { field: 'Summary', value: report.summary },
        { field: 'Strengths', value: report.strengths },
        { field: 'Areas for Improvement', value: report.areas_for_improvement },
        { field: 'Status', value: titleCase(report.status) },
        ...capas
          .filter((c) => c.aar_report_id === report.id)
          .map((c, i) => ({ field: `Corrective Action ${i + 1}`, value: `${c.title} — ${c.owner_name || 'unassigned'} — due ${c.due_date ?? 'TBD'} — ${titleCase(c.status)}` }))
      ],
      `AAR-${report.title.replace(/\s+/g, '-')}.pdf`
    );

  return (
    <div>
      <PageHeader
        title="After-Action Reports & Improvement Plans"
        subtitle="Findings from exercises and real events, with tracked corrective actions"
        actions={<Button onClick={() => setEditing({ status: 'draft' })}><Plus size={16} /> New AAR</Button>}
      />

      {reports.length === 0 ? (
        <EmptyState title="No AARs yet" hint="AARs are typically created from the incident Demobilization tab or after completing an exercise." />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const linkedCapas = capas.filter((c) => c.aar_report_id === report.id);
            return (
              <Card
                key={report.id}
                title={report.title}
                subtitle={report.completed_at ? `Finalized ${fmtDate(report.completed_at)}` : 'In progress'}
                actions={
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(report.status)}>{titleCase(report.status)}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => exportPdf(report)}><Download size={14} /> PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(report)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCapaFor(report)}><Plus size={14} /> Corrective Action</Button>
                  </div>
                }
              >
                {report.summary && <p className="text-sm text-slate-300">{report.summary}</p>}
                {linkedCapas.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
                    {linkedCapas.map((capa) => (
                      <li key={capa.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-sm">
                        <span>{capa.title}</span>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{capa.owner_name || 'Unassigned'} · due {fmtDate(capa.due_date)}</span>
                          <Badge tone={statusTone(capa.status)}>{titleCase(capa.status)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit AAR' : 'New AAR'} wide>
        <form onSubmit={save} className="space-y-4">
          <Field label="Title" required>
            <Input value={editing?.title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Linked Exercise">
              <Select value={editing?.exercise_id ?? ''} onChange={(e) => setEditing((d) => ({ ...d, exercise_id: e.target.value || null }))}>
                <option value="">—</option>
                {exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </Select>
            </Field>
            <Field label="Linked Incident">
              <Select value={editing?.incident_id ?? ''} onChange={(e) => setEditing((d) => ({ ...d, incident_id: e.target.value || null }))}>
                <option value="">—</option>
                {incidents.map((inc) => <option key={inc.id} value={inc.id}>{inc.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Summary">
            <Textarea value={editing?.summary ?? ''} onChange={(e) => setEditing((d) => ({ ...d, summary: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setReportDefaultsField({ field: 'summary', label: 'Summary' })}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <Field label="Strengths">
            <Textarea value={editing?.strengths ?? ''} onChange={(e) => setEditing((d) => ({ ...d, strengths: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setReportDefaultsField({ field: 'strengths', label: 'Strengths' })}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <Field label="Areas for Improvement">
            <Textarea value={editing?.areas_for_improvement ?? ''} onChange={(e) => setEditing((d) => ({ ...d, areas_for_improvement: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setReportDefaultsField({ field: 'areas_for_improvement', label: 'Areas for Improvement' })}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <Field label="Status">
            <Select value={editing?.status ?? 'draft'} onChange={(e) => setEditing((d) => ({ ...d, status: e.target.value as AarReport['status'] }))}>
              <option value="draft">Draft</option>
              <option value="in_review">In Review</option>
              <option value="final">Final</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(capaFor)} onClose={() => setCapaFor(null)} title={`Corrective Action — ${capaFor?.title ?? ''}`}>
        <form onSubmit={addCapa} className="space-y-4">
          <Field label="Title" required>
            <Input value={capaDraft.title ?? ''} onChange={(e) => setCapaDraft((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <Field label="Description">
            <Textarea value={capaDraft.description ?? ''} onChange={(e) => setCapaDraft((d) => ({ ...d, description: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setCapaDefaultsField(true)}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Owner">
              <Input value={capaDraft.owner_name ?? ''} onChange={(e) => setCapaDraft((d) => ({ ...d, owner_name: e.target.value }))} />
            </Field>
            <Field label="Priority">
              <Select value={capaDraft.priority ?? 'medium'} onChange={(e) => setCapaDraft((d) => ({ ...d, priority: e.target.value as CorrectiveAction['priority'] }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
            <Field label="Due Date">
              <Input type="date" value={capaDraft.due_date ?? ''} onChange={(e) => setCapaDraft((d) => ({ ...d, due_date: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCapaFor(null)}>Cancel</Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      <LoadTextDefaultsModal
        open={reportDefaultsField !== null}
        onClose={() => setReportDefaultsField(null)}
        fieldLabel={reportDefaultsField?.label ?? ''}
        onAppend={(text) => {
          if (reportDefaultsField) appendReportText(reportDefaultsField.field, text);
        }}
      />

      <LoadTextDefaultsModal
        open={capaDefaultsField}
        onClose={() => setCapaDefaultsField(false)}
        fieldLabel="Corrective Action Description"
        onAppend={(text) =>
          setCapaDraft((d) => ({ ...d, description: [String(d.description ?? ''), text].map((s) => s.trim()).filter(Boolean).join('\n') }))
        }
      />
    </div>
  );
}
