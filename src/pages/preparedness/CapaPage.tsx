import { useState, type FormEvent } from 'react';
import { ListPlus, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord } from '../../lib/repo';
import { Badge, Button, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, statusTone } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { fmtDate, titleCase } from '../../lib/utils';
import type { CorrectiveAction } from '../../types/domain';

export function CapaPage() {
  const { rows: capas, reload } = useRecords<CorrectiveAction>('corrective_actions', { orderBy: 'due_date', ascending: true });
  const [editing, setEditing] = useState<Partial<CorrectiveAction> | null>(null);
  const [showDescriptionDefaults, setShowDescriptionDefaults] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const open = capas.filter((c) => c.status === 'open' || c.status === 'in_progress');
  const overdue = open.filter((c) => c.due_date && c.due_date < today);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('corrective_actions', {
      ...editing,
      completed_at: editing.status === 'completed' && !editing.completed_at ? new Date().toISOString() : editing.completed_at
    } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <div>
      <PageHeader
        title="Corrective Actions (CAPA)"
        subtitle="Improvement items from AARs, exercises, and surveys — tracked to completion"
        actions={<Button onClick={() => setEditing({ priority: 'medium', status: 'open' })}><Plus size={16} /> Add Action</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={open.length} tone={open.length ? 'yellow' : 'green'} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? 'red' : 'green'} />
        <StatCard label="Completed" value={capas.filter((c) => c.status === 'completed').length} tone="green" />
        <StatCard label="Total" value={capas.length} />
      </div>

      {capas.length === 0 ? (
        <EmptyState title="No corrective actions" hint="Corrective actions from AARs appear here automatically; you can also add them directly." />
      ) : (
        <DataTable head={['Action', 'Owner', 'Priority', 'Due', 'Status', '']}>
          {capas.map((capa) => (
            <tr key={capa.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3">
                <p className="text-sm font-medium">{capa.title}</p>
                {capa.description && <p className="text-xs text-slate-500">{capa.description}</p>}
              </td>
              <td className="px-4 py-3 text-sm">{capa.owner_name || '—'}</td>
              <td className="px-4 py-3"><Badge tone={capa.priority === 'high' ? 'red' : capa.priority === 'medium' ? 'yellow' : 'slate'}>{titleCase(capa.priority)}</Badge></td>
              <td className="px-4 py-3 text-sm">
                <span className={capa.due_date && capa.due_date < today && capa.status !== 'completed' ? 'font-semibold text-red-400' : 'text-slate-400'}>
                  {fmtDate(capa.due_date)}
                </span>
              </td>
              <td className="px-4 py-3"><Badge tone={statusTone(capa.status)}>{titleCase(capa.status)}</Badge></td>
              <td className="px-4 py-3">
                <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(capa)}>Edit</button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Corrective Action' : 'Add Corrective Action'}>
        <form onSubmit={save} className="space-y-4">
          <Field label="Title" required>
            <Input value={editing?.title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <Field label="Description">
            <Textarea value={editing?.description ?? ''} onChange={(e) => setEditing((d) => ({ ...d, description: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowDescriptionDefaults(true)}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Owner">
              <Input value={editing?.owner_name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, owner_name: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <Input type="date" value={editing?.due_date ?? ''} onChange={(e) => setEditing((d) => ({ ...d, due_date: e.target.value }))} />
            </Field>
            <Field label="Priority">
              <Select value={editing?.priority ?? 'medium'} onChange={(e) => setEditing((d) => ({ ...d, priority: e.target.value as CorrectiveAction['priority'] }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={editing?.status ?? 'open'} onChange={(e) => setEditing((d) => ({ ...d, status: e.target.value as CorrectiveAction['status'] }))}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="deferred">Deferred</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <LoadTextDefaultsModal
        open={showDescriptionDefaults}
        onClose={() => setShowDescriptionDefaults(false)}
        fieldLabel="Corrective Action Description"
        onAppend={(text) =>
          setEditing((d) => ({ ...d, description: [String(d?.description ?? ''), text].map((s) => s.trim()).filter(Boolean).join('\n') }))
        }
      />
    </div>
  );
}
