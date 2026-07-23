import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, ListPlus, Plus, Trash2 } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { exportTablePdf } from '../../lib/pdf';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { fmtDate, titleCase } from '../../lib/utils';
import type { AarObjective, AarReport, CorrectiveAction, Exercise, Incident } from '../../types/domain';

const emptyObjective = (): AarObjective => ({ description: '', strengths: '', areas_for_improvement: '' });

/** Split a free-text list (newline- or bullet-separated) into individual objectives. */
function parseObjectives(raw: string): AarObjective[] {
  return raw
    .split(/\n|•|·|\*\s/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((description) => ({ description, strengths: '', areas_for_improvement: '' }));
}

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

  const editingObjectives = useMemo<AarObjective[]>(() => {
    const raw = editing?.objectives;
    if (Array.isArray(raw) && raw.length > 0) return raw as AarObjective[];
    return [];
  }, [editing?.objectives]);

  const setObjective = (index: number, patch: Partial<AarObjective>) =>
    setEditing((d) => {
      const list = Array.isArray(d?.objectives) ? [...(d!.objectives as AarObjective[])] : [];
      list[index] = { ...list[index], ...patch };
      return { ...d, objectives: list };
    });

  const addObjective = () =>
    setEditing((d) => ({ ...d, objectives: [...(Array.isArray(d?.objectives) ? (d!.objectives as AarObjective[]) : []), emptyObjective()] }));

  const removeObjective = (index: number) =>
    setEditing((d) => {
      const list = Array.isArray(d?.objectives) ? [...(d!.objectives as AarObjective[])] : [];
      list.splice(index, 1);
      return { ...d, objectives: list };
    });

  const linkedExercise = exercises.find((ex) => ex.id === editing?.exercise_id) ?? null;

  /** Auto-seed objectives from the linked exercise when none exist yet (on open or exercise change). */
  useEffect(() => {
    if (!linkedExercise?.objectives) return;
    setEditing((d) => {
      const existing = Array.isArray(d?.objectives) ? (d!.objectives as AarObjective[]) : [];
      if (existing.length > 0) return d;
      const parsed = parseObjectives(linkedExercise.objectives);
      if (parsed.length === 0) return d;
      return { ...d, objectives: parsed };
    });
  }, [linkedExercise?.id, linkedExercise?.objectives]);

  /** Seed the objectives list from the linked exercise's objective text. */
  const importExerciseObjectives = () => {
    if (!linkedExercise?.objectives) return;
    const parsed = parseObjectives(linkedExercise.objectives);
    if (parsed.length === 0) return;
    setEditing((d) => ({ ...d, objectives: parsed }));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const wasAutoCreated = editing.status === 'auto_created';
    const nextStatus = wasAutoCreated ? 'draft' : editing.status;
    await saveRecord('aar_reports', {
      ...editing,
      status: nextStatus,
      completed_at: nextStatus === 'final' && !editing.completed_at ? new Date().toISOString() : editing.completed_at
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

  const exportPdf = (report: AarReport) => {
    const objectives = Array.isArray(report.objectives) ? (report.objectives as AarObjective[]) : [];
    const rows: Array<{ field: string; value: string }> = [
      { field: 'Summary', value: report.summary },
      { field: 'Status', value: titleCase(report.status) }
    ];
    if (objectives.length > 0) {
      objectives.forEach((obj, i) => {
        rows.push({ field: `Objective ${i + 1}`, value: obj.description || '—' });
        rows.push({ field: `  Strengths`, value: obj.strengths });
        rows.push({ field: `  Areas for Improvement`, value: obj.areas_for_improvement });
      });
    } else {
      rows.push({ field: 'Strengths', value: report.strengths });
      rows.push({ field: 'Areas for Improvement', value: report.areas_for_improvement });
    }
    capas
      .filter((c) => c.aar_report_id === report.id)
      .forEach((c, i) => rows.push({ field: `Corrective Action ${i + 1}`, value: `${c.title} — ${c.owner_name || 'unassigned'} — due ${c.due_date ?? 'TBD'} — ${titleCase(c.status)}` }));

    exportTablePdf(
      report.title,
      'After-Action Report / Improvement Plan (HSEEP)',
      [
        { key: 'field', label: 'Section' },
        { key: 'value', label: 'Content' }
      ],
      rows,
      `AAR-${report.title.replace(/\s+/g, '-')}.pdf`
    );
  };

  return (
    <div>
      <PageHeader
        title="After-Action Reports & Improvement Plans"
        subtitle="HSEEP-aligned findings by objective, with tracked corrective actions"
        actions={<Button onClick={() => setEditing({ status: 'draft', objectives: [] })}><Plus size={16} /> New AAR</Button>}
      />

      {reports.length === 0 ? (
        <EmptyState title="No AARs yet" hint="AARs are created automatically when you schedule an exercise, or from the incident Demobilization tab." />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const linkedCapas = capas.filter((c) => c.aar_report_id === report.id);
            const objectives = Array.isArray(report.objectives) ? (report.objectives as AarObjective[]) : [];
            const isAuto = report.status === 'auto_created';
            return (
              <Card
                key={report.id}
                title={report.title}
                subtitle={report.completed_at ? `Finalized ${fmtDate(report.completed_at)}` : isAuto ? 'Automatically created — not yet edited' : 'In progress'}
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
                {objectives.length > 0 && (
                  <div className="mt-3 space-y-3 border-t border-slate-700/60 pt-3">
                    {objectives.map((obj, i) => (
                      <div key={i} className="rounded-lg bg-slate-800/60 p-3">
                        <p className="text-sm font-semibold text-slate-100">Objective {i + 1}: {obj.description || '—'}</p>
                        {obj.strengths && <p className="mt-1.5 text-xs text-emerald-300/90"><span className="font-semibold">Strengths:</span> {obj.strengths}</p>}
                        {obj.areas_for_improvement && <p className="mt-1 text-xs text-amber-300/90"><span className="font-semibold">Areas for Improvement:</span> {obj.areas_for_improvement}</p>}
                      </div>
                    ))}
                  </div>
                )}
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

          {/* HSEEP: strengths and areas for improvement captured per objective */}
          <div className="rounded-lg border border-slate-700/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Objectives &amp; Findings</h4>
                <p className="text-xs text-slate-400">Per HSEEP guidance, each objective lists its own strengths and areas for improvement.</p>
              </div>
              <div className="flex gap-2">
                {linkedExercise?.objectives && (
                  <Button variant="ghost" size="sm" type="button" onClick={importExerciseObjectives}>
                    <ListPlus size={15} /> Import from Exercise
                  </Button>
                )}
                <Button variant="secondary" size="sm" type="button" onClick={addObjective}><Plus size={15} /> Add Objective</Button>
              </div>
            </div>

            {editingObjectives.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No objectives yet. Add one or import them from the linked exercise.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {editingObjectives.map((obj, i) => (
                  <div key={i} className="rounded-md bg-slate-800/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-400">Objective {i + 1}</span>
                      <button type="button" onClick={() => removeObjective(i)} className="text-slate-500 hover:text-red-300" aria-label="Remove objective">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <Field label="Objective description">
                      <Input value={obj.description} onChange={(e) => setObjective(i, { description: e.target.value })} />
                    </Field>
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label="Strengths">
                        <Textarea value={obj.strengths} onChange={(e) => setObjective(i, { strengths: e.target.value })} rows={3} />
                      </Field>
                      <Field label="Areas for Improvement">
                        <Textarea value={obj.areas_for_improvement} onChange={(e) => setObjective(i, { areas_for_improvement: e.target.value })} rows={3} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Status">
            <Select value={editing?.status ?? 'draft'} onChange={(e) => setEditing((d) => ({ ...d, status: e.target.value as AarReport['status'] }))}>
              <option value="auto_created">Automatically Created</option>
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
