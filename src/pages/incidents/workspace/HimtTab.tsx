import { useMemo, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { STANDARD_HIMT_POSITIONS, SECTION_LABELS, SECTION_ORDER } from '../../../data/himtPositions';
import { Button, Card, Field, Input, Modal, Select } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import type { HimtAssignment, HimtPosition, Personnel } from '../../../types/domain';
import type { HicsSection } from '../../../types/domain';

// Org chart builder: assign people to HICS positions per incident. Standard
// positions come from the seeded catalog (bundled fallback keeps it working
// offline before first sync).

export function HimtTab() {
  const { incident } = useIncident();
  const { rows: catalogRows } = useRecords<HimtPosition>('himt_positions', { orderBy: 'sort_order' });
  const { rows: assignments, reload } = useRecords<HimtAssignment>('himt_assignments', {
    match: { incident_id: incident.id }
  });
  const { rows: personnel } = useRecords<Personnel>('personnel', { orderBy: 'full_name' });

  const positions = useMemo(() => {
    if (catalogRows.length) return catalogRows;
    return STANDARD_HIMT_POSITIONS.map((p, i) => ({
      id: `std-${i}`,
      tenant_id: null,
      code: p.code,
      title: p.title,
      section: p.section,
      parent_code: p.parentCode,
      sort_order: p.sortOrder
    }));
  }, [catalogRows]);

  const [assigning, setAssigning] = useState<HimtPosition | null>(null);
  const [assigneeName, setAssigneeName] = useState('');
  const [personnelId, setPersonnelId] = useState('');
  const [contact, setContact] = useState('');

  const activeFor = (code: string) => assignments.find((a) => a.position_code === code && !a.released_at);

  const openAssign = (position: HimtPosition) => {
    setAssigning(position);
    setAssigneeName('');
    setPersonnelId('');
    setContact('');
  };

  const assign = async () => {
    if (!assigning) return;
    const person = personnel.find((p) => p.id === personnelId);
    await saveRecord('himt_assignments', {
      incident_id: incident.id,
      position_code: assigning.code,
      position_title: assigning.title,
      section: assigning.section,
      personnel_id: personnelId || null,
      assignee_name: person?.full_name ?? assigneeName,
      contact_info: contact || person?.phone || '',
      assigned_at: new Date().toISOString()
    });
    logAudit('himt.assigned', 'himt_assignment', assigning.code, {
      incident_id: incident.id,
      position: assigning.title,
      assignee: person?.full_name ?? assigneeName
    });
    setAssigning(null);
    await reload();
  };

  const release = async (assignment: HimtAssignment) => {
    await saveRecord('himt_assignments', {
      ...assignment,
      released_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    logAudit('himt.released', 'himt_assignment', assignment.id, { position: assignment.position_title });
    await reload();
  };

  const sectionColors: Record<HicsSection, string> = {
    command: 'border-slate-500',
    operations: 'border-red-700',
    planning: 'border-blue-700',
    logistics: 'border-amber-700',
    finance: 'border-emerald-700'
  };

  return (
    <div className="space-y-4">
      {SECTION_ORDER.map((section) => {
        const sectionPositions = positions.filter((p) => p.section === section);
        if (!sectionPositions.length) return null;
        return (
          <Card key={section} title={`${SECTION_LABELS[section]} ${section === 'command' ? 'Staff' : 'Section'}`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sectionPositions.map((position) => {
                const assignment = activeFor(position.code);
                return (
                  <div
                    key={position.code}
                    className={cn('rounded-lg border-l-4 bg-slate-800 p-3', sectionColors[position.section as HicsSection] ?? 'border-slate-600')}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{position.title}</p>
                    {assignment ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{assignment.assignee_name}</p>
                          {assignment.contact_info && <p className="text-xs text-slate-400">{assignment.contact_info}</p>}
                        </div>
                        <button
                          onClick={() => void release(assignment)}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-900/40 hover:text-red-300"
                          title="Release from position"
                        >
                          <UserMinus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openAssign(position)}
                        className="mt-1 flex min-h-touch items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300"
                      >
                        <UserPlus size={15} /> Assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Modal open={Boolean(assigning)} onClose={() => setAssigning(null)} title={`Assign — ${assigning?.title ?? ''}`}>
        <div className="space-y-4">
          <Field label="From Personnel Directory">
            <Select value={personnelId} onChange={(e) => setPersonnelId(e.target.value)}>
              <option value="">— Enter name manually —</option>
              {personnel.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}{p.job_title ? ` — ${p.job_title}` : ''}</option>
              ))}
            </Select>
          </Field>
          {!personnelId && (
            <Field label="Name" required>
              <Input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder="Full name" />
            </Field>
          )}
          <Field label="Contact (phone / radio)">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g., x4412 / Radio Ch 2" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssigning(null)}>Cancel</Button>
            <Button onClick={() => void assign()} disabled={!personnelId && !assigneeName}>Assign Position</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
