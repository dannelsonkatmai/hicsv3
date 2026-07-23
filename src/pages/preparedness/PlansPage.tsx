import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, ListPlus, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { fmtDate, titleCase } from '../../lib/utils';
import type { PlanDocument } from '../../types/domain';

export function PlansPage() {
  const navigate = useNavigate();
  const { rows: docs, reload } = useRecords<PlanDocument>('plan_documents', { orderBy: 'title' });
  const [editing, setEditing] = useState<Partial<PlanDocument> | null>(null);
  const [showContentDefaults, setShowContentDefaults] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = docs.filter((d) => d.next_review_date && d.next_review_date < today && d.status !== 'archived');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('plan_documents', editing as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  return (
    <div>
      <PageHeader
        title="EOP & Plan Library"
        subtitle="Emergency Operations Plan, annexes, and policies — versioned with review cycles"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/preparedness/plan-builder')}>
              <BookOpenCheck size={16} /> Plan Builder
            </Button>
            <Button onClick={() => setEditing({ doc_type: 'eop', version: '1.0', status: 'active' })}><Plus size={16} /> Add Document</Button>
          </>
        }
      />

      {overdue.length > 0 && (
        <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
          {overdue.length} document{overdue.length > 1 ? 's are' : ' is'} past the scheduled review date.
        </p>
      )}

      {docs.length === 0 ? (
        <EmptyState
          title="No plan documents"
          hint="Track the EOP, hazard annexes, and supporting policies with versions and review cycles — or draft a compliant EOP step by step."
          action={
            <Button variant="secondary" onClick={() => navigate('/preparedness/plan-builder')}>
              <BookOpenCheck size={16} /> Build an EOP step by step
            </Button>
          }
        />
      ) : (
        <DataTable head={['Title', 'Type', 'Version', 'Status', 'Effective', 'Next Review', '']}>
          {docs.map((doc) => (
            <tr key={doc.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm font-medium">{doc.title}</td>
              <td className="px-4 py-3 text-sm">{doc.doc_type.toUpperCase()}</td>
              <td className="px-4 py-3 text-sm">v{doc.version}</td>
              <td className="px-4 py-3"><Badge tone={statusTone(doc.status)}>{titleCase(doc.status)}</Badge></td>
              <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(doc.effective_date)}</td>
              <td className="px-4 py-3 text-sm">
                <span className={doc.next_review_date && doc.next_review_date < today ? 'font-semibold text-red-400' : 'text-slate-400'}>
                  {fmtDate(doc.next_review_date)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(doc)}>Edit</button>
                  <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('plan_documents', doc.id).then(reload)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Document' : 'Add Document'} wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title" required span={2}>
            <Input value={editing?.title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))} required />
          </Field>
          <Field label="Type">
            <Select value={editing?.doc_type ?? 'eop'} onChange={(e) => setEditing((d) => ({ ...d, doc_type: e.target.value as PlanDocument['doc_type'] }))}>
              <option value="eop">EOP</option>
              <option value="annex">Annex</option>
              <option value="policy">Policy</option>
              <option value="irg">IRG</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Version">
            <Input value={editing?.version ?? '1.0'} onChange={(e) => setEditing((d) => ({ ...d, version: e.target.value }))} />
          </Field>
          <Field label="Status">
            <Select value={editing?.status ?? 'active'} onChange={(e) => setEditing((d) => ({ ...d, status: e.target.value as PlanDocument['status'] }))}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="under_review">Under Review</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field label="Owner">
            <Input value={editing?.owner_name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, owner_name: e.target.value }))} />
          </Field>
          <Field label="Effective Date">
            <Input type="date" value={editing?.effective_date ?? ''} onChange={(e) => setEditing((d) => ({ ...d, effective_date: e.target.value }))} />
          </Field>
          <Field label="Next Review Date">
            <Input type="date" value={editing?.next_review_date ?? ''} onChange={(e) => setEditing((d) => ({ ...d, next_review_date: e.target.value }))} />
          </Field>
          <Field label="Summary / Content Notes" span={2}>
            <Textarea value={editing?.content ?? ''} onChange={(e) => setEditing((d) => ({ ...d, content: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowContentDefaults(true)}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <LoadTextDefaultsModal
        open={showContentDefaults}
        onClose={() => setShowContentDefaults(false)}
        fieldLabel="Summary / Content Notes"
        onAppend={(text) =>
          setEditing((d) => ({ ...d, content: [String(d?.content ?? ''), text].map((s) => s.trim()).filter(Boolean).join('\n') }))
        }
      />
    </div>
  );
}
