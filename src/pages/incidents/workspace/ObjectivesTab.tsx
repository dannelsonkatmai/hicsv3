import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../../lib/repo';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, statusTone } from '../../../components/ui';
import { titleCase } from '../../../lib/utils';
import type { IncidentTask, Objective } from '../../../types/domain';

const SECTIONS = ['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'];

export function ObjectivesTab() {
  const { incident, currentPeriod } = useIncident();
  const { rows: objectives, reload } = useRecords<Objective>('objectives', {
    match: { incident_id: incident.id },
    orderBy: 'priority',
    ascending: true
  });
  const { rows: tasks, reload: reloadTasks } = useRecords<IncidentTask>('incident_tasks', {
    match: { incident_id: incident.id },
    orderBy: 'created_at',
    ascending: true
  });

  const [showObjective, setShowObjective] = useState(false);
  const [objDescription, setObjDescription] = useState('');
  const [objSection, setObjSection] = useState('Operations');
  const [showTask, setShowTask] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSection, setTaskSection] = useState('Operations');

  const addObjective = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('objectives', {
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      description: objDescription,
      priority: objectives.length + 1,
      status: 'open',
      owner_section: objSection
    });
    setObjDescription('');
    setShowObjective(false);
    await reload();
  };

  const cycleStatus = async (objective: Objective) => {
    const order: Objective['status'][] = ['open', 'in_progress', 'completed', 'carried_over'];
    const next = order[(order.indexOf(objective.status) + 1) % order.length];
    await saveRecord('objectives', { ...objective, status: next } as unknown as Record<string, unknown>);
    await reload();
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!showTask) return;
    await saveRecord('incident_tasks', {
      incident_id: incident.id,
      objective_id: showTask,
      title: taskTitle,
      assigned_section: taskSection,
      status: 'open'
    });
    setTaskTitle('');
    setShowTask(null);
    await reloadTasks();
  };

  const cycleTask = async (task: IncidentTask) => {
    const order: IncidentTask['status'][] = ['open', 'in_progress', 'blocked', 'done'];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    await saveRecord('incident_tasks', { ...task, status: next } as unknown as Record<string, unknown>);
    await reloadTasks();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowObjective(true)}><Plus size={16} /> Add Objective</Button>
      </div>

      {objectives.length === 0 ? (
        <EmptyState
          title="No incident objectives yet"
          hint="Objectives set per operational period drive the IAP (HICS 202) and section task assignments."
          action={<Button onClick={() => setShowObjective(true)}>Add First Objective</Button>}
        />
      ) : (
        <div className="space-y-3">
          {objectives.map((objective) => {
            const objectiveTasks = tasks.filter((t) => t.objective_id === objective.id);
            return (
              <Card key={objective.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600/30 text-sm font-bold text-brand-300">
                      {objective.priority}
                    </span>
                    <div>
                      <p className="font-medium text-slate-100">{objective.description}</p>
                      <p className="text-xs text-slate-400">Owner: {objective.owner_section || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => void cycleStatus(objective)} title="Click to advance status">
                      <Badge tone={statusTone(objective.status)}>{titleCase(objective.status)}</Badge>
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowTask(objective.id); setTaskSection(objective.owner_section || 'Operations'); }}>
                      <Plus size={14} /> Task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteRecord('objectives', objective.id).then(reload)}>
                      Remove
                    </Button>
                  </div>
                </div>
                {objectiveTasks.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-slate-700/60 pt-3">
                    {objectiveTasks.map((task) => (
                      <li key={task.id} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-sm">
                        <span className="text-slate-200">{task.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{task.assigned_section}</span>
                          <button onClick={() => void cycleTask(task)} title="Click to advance status">
                            <Badge tone={statusTone(task.status)}>{titleCase(task.status)}</Badge>
                          </button>
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

      <Modal open={showObjective} onClose={() => setShowObjective(false)} title="Add Incident Objective">
        <form onSubmit={addObjective} className="space-y-4">
          <Field label="Objective" required>
            <Textarea value={objDescription} onChange={(e) => setObjDescription(e.target.value)} required placeholder="e.g., Establish surge capacity of 20 additional med-surg beds within 4 hours" />
          </Field>
          <Field label="Owning Section">
            <Select value={objSection} onChange={(e) => setObjSection(e.target.value)}>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowObjective(false)}>Cancel</Button>
            <Button type="submit">Add Objective</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(showTask)} onClose={() => setShowTask(null)} title="Add Task">
        <form onSubmit={addTask} className="space-y-4">
          <Field label="Task" required>
            <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required placeholder="e.g., Open overflow unit on 4 West" />
          </Field>
          <Field label="Assigned Section">
            <Select value={taskSection} onChange={(e) => setTaskSection(e.target.value)}>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowTask(null)}>Cancel</Button>
            <Button type="submit">Add Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
