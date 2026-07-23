import { useState, type FormEvent } from 'react';
import { CalendarClock, ListPlus, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, statusTone } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { fmtDate, titleCase } from '../../lib/utils';
import type { Exercise } from '../../types/domain';

// Exercise & drill scheduler with CMS Emergency Preparedness Rule tracking:
// two exercises per year for inpatient providers — one full-scale
// community-based (or facility functional when community access is
// unavailable) plus a second exercise of choice — with real-event exemption.

export function ExercisesPage() {
  const { rows: exercises, reload } = useRecords<Exercise>('exercises', { orderBy: 'scheduled_at', ascending: false });
  const [editing, setEditing] = useState<Partial<Exercise> | null>(null);
  const [showObjectivesDefaults, setShowObjectivesDefaults] = useState(false);

  const year = String(new Date().getFullYear());
  const completedThisYear = exercises.filter((e) => e.status === 'completed' && (e.completed_at ?? '').startsWith(year));
  const fullScaleDone = completedThisYear.some(
    (e) => (e.exercise_type === 'full_scale' && e.is_community_based) || (e.exercise_type === 'functional' && e.counts_toward_cms) || e.cms_exemption_claimed
  );
  const secondDone = completedThisYear.filter((e) => e.counts_toward_cms).length >= 2;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('exercises', {
      ...editing,
      completed_at: editing.status === 'completed' && !editing.completed_at ? new Date().toISOString() : editing.completed_at
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <div>
      <PageHeader
        title="Exercises & Drills"
        subtitle="Tabletops, functional and full-scale exercises, and drills — with CMS two-per-year tracking"
        actions={<Button onClick={() => setEditing({ exercise_type: 'drill', status: 'planned', counts_toward_cms: true })}><Plus size={16} /> Schedule</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`CMS Exercise 1 · ${year}`}
          value={fullScaleDone ? 'Complete' : 'Due'}
          tone={fullScaleDone ? 'green' : 'yellow'}
          hint="Full-scale community-based (or facility functional / real-event exemption)"
        />
        <StatCard
          label={`CMS Exercise 2 · ${year}`}
          value={secondDone ? 'Complete' : 'Due'}
          tone={secondDone ? 'green' : 'yellow'}
          hint="Exercise of choice (full-scale, functional, drill, or facilitated tabletop)"
        />
        <StatCard label="Planned" value={exercises.filter((e) => e.status === 'planned').length} tone="blue" />
        <StatCard label={`Completed · ${year}`} value={completedThisYear.length} />
      </div>

      {exercises.length === 0 ? (
        <EmptyState title="Nothing scheduled" hint="Plan exercises and drills; completed records become compliance evidence and can trigger AARs." />
      ) : (
        <DataTable head={['Exercise', 'Type', 'Scheduled', 'Status', 'CMS', '']}>
          {exercises.map((exercise) => (
            <tr key={exercise.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3">
                <p className="text-sm font-medium">{exercise.title}</p>
                {exercise.drill_category && <p className="text-xs text-slate-500">{titleCase(exercise.drill_category)}</p>}
              </td>
              <td className="px-4 py-3 text-sm">
                {titleCase(exercise.exercise_type)}
                {exercise.is_community_based && <span className="block text-xs text-brand-400">Community-based</span>}
              </td>
              <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(exercise.scheduled_at)}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(exercise.status)}>{titleCase(exercise.status)}</Badge></td>
              <td className="px-4 py-3">
                {exercise.cms_exemption_claimed ? (
                  <Badge tone="purple">Real-event exemption</Badge>
                ) : exercise.counts_toward_cms ? (
                  <Badge tone="blue">Counts</Badge>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(exercise)}>Edit</button>
                  <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('exercises', exercise.id).then(reload)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Exercise' : 'Schedule Exercise'} wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title" required span={2}>
            <Input value={editing?.title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <Field label="Type">
            <Select value={editing?.exercise_type ?? 'drill'} onChange={(e) => setEditing((d) => ({ ...d, exercise_type: e.target.value as Exercise['exercise_type'] }))}>
              <option value="tabletop">Tabletop</option>
              <option value="functional">Functional</option>
              <option value="full_scale">Full-Scale</option>
              <option value="drill">Drill</option>
              <option value="real_event">Real Event</option>
            </Select>
          </Field>
          <Field label="Drill Category">
            <Select value={editing?.drill_category ?? ''} onChange={(e) => setEditing((d) => ({ ...d, drill_category: e.target.value }))}>
              <option value="">—</option>
              {['fire', 'evacuation', 'active_threat', 'decon', 'utility_failure', 'mass_casualty', 'severe_weather', 'other'].map((c) => (
                <option key={c} value={c}>{titleCase(c)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Scheduled Date/Time">
            <Input type="datetime-local" value={editing?.scheduled_at?.slice(0, 16) ?? ''} onChange={(e) => setEditing((d) => ({ ...d, scheduled_at: e.target.value }))} />
          </Field>
          <Field label="Status">
            <Select value={editing?.status ?? 'planned'} onChange={(e) => setEditing((d) => ({ ...d, status: e.target.value as Exercise['status'] }))}>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Scenario" span={2}>
            <Textarea value={editing?.scenario ?? ''} onChange={(e) => setEditing((d) => ({ ...d, scenario: e.target.value }))} />
          </Field>
          <Field label="Objectives" span={2}>
            <Textarea value={editing?.objectives ?? ''} onChange={(e) => setEditing((d) => ({ ...d, objectives: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowObjectivesDefaults(true)}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <div className="space-y-2 md:col-span-2">
            {([
              ['is_community_based', 'Community-based exercise (with jurisdictional partners)'],
              ['counts_toward_cms', 'Counts toward the CMS two-exercises-per-year requirement'],
              ['cms_exemption_claimed', 'Real-event exemption claimed (actual emergency plan activation)']
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(editing?.[key])}
                  onChange={(e) => setEditing((d) => ({ ...d, [key]: e.target.checked }))}
                  className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <LoadTextDefaultsModal
        open={showObjectivesDefaults}
        onClose={() => setShowObjectivesDefaults(false)}
        categoryKey="objectives"
        templateCode="HICS 202"
        fieldKey="objectives"
        fieldLabel="Exercise Objectives"
        onAppend={(text) => {
          setEditing((d) => ({
            ...d,
            objectives: [d?.objectives ?? '', text].map((s) => s.trim()).filter(Boolean).join('\n')
          }));
        }}
      />
    </div>
  );
}
