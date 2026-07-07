import { useMemo, useState, type FormEvent } from 'react';
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../../lib/repo';
import { logAudit } from '../../../lib/audit';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, StatCard, Tabs, statusTone } from '../../../components/ui';
import { sumBy, titleCase } from '../../../lib/utils';

// Live status boards (spec §3.5): beds, acuity, supplies, staffing, and the
// HICS 251 facility-systems board. All values are AGGREGATE COUNTS ONLY.
// Realtime keeps every command-post screen in sync when online; edits work
// offline and reconcile through the sync queue. "Snapshot" stamps the current
// board into the operational period for trending, the SitRep, and the IAP.

interface BoardField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

interface BoardConfig {
  key: string;
  label: string;
  table: string;
  fields: BoardField[];
  /** Optional derived values computed before save. */
  derive?: (row: Record<string, unknown>) => Record<string, unknown>;
  statusKey?: string;
}

const BOARDS: BoardConfig[] = [
  {
    key: 'beds',
    label: 'Bed Board',
    table: 'bed_status_entries',
    fields: [
      { key: 'unit_name', label: 'Unit', type: 'text' },
      { key: 'bed_type', label: 'Bed Type', type: 'select', options: ['ed', 'icu', 'med_surg', 'peds', 'ob', 'periop', 'behavioral', 'stepdown', 'other'] },
      { key: 'staffed_beds', label: 'Staffed', type: 'number' },
      { key: 'occupied_beds', label: 'Occupied', type: 'number' },
      { key: 'available_beds', label: 'Available', type: 'number' },
      { key: 'blocked_beds', label: 'Blocked', type: 'number' },
      { key: 'surge_beds_available', label: 'Surge Avail', type: 'number' },
      { key: 'divert_status', label: 'Divert', type: 'select', options: ['open', 'partial', 'divert'] }
    ],
    statusKey: 'divert_status'
  },
  {
    key: 'acuity',
    label: 'Acuity',
    table: 'acuity_entries',
    fields: [
      { key: 'area', label: 'Area', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['immediate', 'delayed', 'minimal', 'expectant', 'deceased', 'icu', 'med_surg', 'peds', 'other'] },
      { key: 'patient_count', label: 'Count', type: 'number' }
    ]
  },
  {
    key: 'supplies',
    label: 'Supplies',
    table: 'supply_status_entries',
    fields: [
      { key: 'item_name', label: 'Critical Item', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['supplies', 'medications', 'equipment', 'ppe', 'blood_products', 'other'] },
      { key: 'on_hand', label: 'On Hand', type: 'number' },
      { key: 'unit_of_measure', label: 'UoM', type: 'text' },
      { key: 'burn_rate_per_day', label: 'Burn/Day', type: 'number' }
    ],
    derive: (row) => {
      const onHand = Number(row.on_hand) || 0;
      const burn = Number(row.burn_rate_per_day) || 0;
      const days = burn > 0 ? Math.round((onHand / burn) * 10) / 10 : 999;
      return { days_on_hand: days, status: days < 3 ? 'red' : days <= 7 ? 'yellow' : 'green' };
    },
    statusKey: 'status'
  },
  {
    key: 'staffing',
    label: 'Staffing',
    table: 'staffing_status_entries',
    fields: [
      { key: 'unit_or_area', label: 'Unit / Area', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'on_hand', label: 'On Hand', type: 'number' },
      { key: 'needed', label: 'Needed', type: 'number' }
    ]
  },
  {
    key: 'systems',
    label: 'Facility Systems (251)',
    table: 'facility_system_status',
    fields: [
      { key: 'system_name', label: 'System', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['green', 'yellow', 'red', 'unknown'] },
      { key: 'comments', label: 'Comments', type: 'text' },
      { key: 'estimated_restoration', label: 'Est. Restoration', type: 'text' }
    ],
    statusKey: 'status'
  }
];

const DEFAULT_SYSTEMS = [
  'Electrical Power — Normal', 'Electrical Power — Generator', 'Water — Domestic', 'Water — Potable',
  'Medical Gases', 'HVAC', 'Steam / Boiler', 'Sewage / Sanitation', 'IT / EHR', 'Telephone / Communications',
  'Fire Alarm / Suppression', 'Elevators', 'Security / Access Control', 'Food Services', 'Structural Integrity'
];

export function BoardsTab() {
  const [board, setBoard] = useState('beds');
  const config = BOARDS.find((b) => b.key === board)!;
  return (
    <div>
      <Tabs tabs={BOARDS.map((b) => ({ key: b.key, label: b.label }))} active={board} onChange={setBoard} />
      <Board key={config.key} config={config} />
    </div>
  );
}

function Board({ config }: { config: BoardConfig }) {
  const { incident, currentPeriod } = useIncident();
  const { rows: allRows, reload } = useRecords<Record<string, unknown>>(
    config.table,
    { match: { incident_id: incident.id }, orderBy: 'created_at', ascending: true },
    { realtime: true }
  );
  const rows = useMemo(() => allRows.filter((r) => !r.is_snapshot), [allRows]);

  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [snapshotting, setSnapshotting] = useState(false);

  const openEditor = (row: Record<string, unknown> | null) => {
    setEditing(row ?? {});
    setDraft(row ? { ...row } : {});
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const derived = config.derive ? config.derive(draft) : {};
    await saveRecord(config.table, {
      ...draft,
      ...derived,
      incident_id: incident.id,
      is_snapshot: false,
      recorded_at: new Date().toISOString()
    });
    setEditing(null);
    await reload();
  };

  const snapshot = async () => {
    setSnapshotting(true);
    try {
      for (const row of rows) {
        const copy = { ...row };
        delete copy.id;
        await saveRecord(config.table, {
          ...copy,
          is_snapshot: true,
          operational_period_id: currentPeriod?.id ?? null,
          recorded_at: new Date().toISOString()
        });
      }
      logAudit('board.snapshot', config.table, incident.id, { rows: rows.length, period: currentPeriod?.period_number });
    } finally {
      setSnapshotting(false);
    }
  };

  const seedSystems = async () => {
    for (const name of DEFAULT_SYSTEMS) {
      await saveRecord(config.table, {
        incident_id: incident.id,
        system_name: name,
        status: 'green',
        is_snapshot: false,
        recorded_at: new Date().toISOString()
      });
    }
    await reload();
  };

  return (
    <div className="space-y-4">
      <BoardSummary configKey={config.key} rows={rows} />

      <Card
        title={config.label}
        subtitle={`Aggregate counts only · updates live across the command post · ${rows.length} rows`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void snapshot()} disabled={snapshotting || rows.length === 0}>
              <Camera size={14} /> {snapshotting ? 'Snapshotting…' : `Snapshot to OP ${currentPeriod?.period_number ?? '—'}`}
            </Button>
            <Button size="sm" onClick={() => openEditor(null)}><Plus size={14} /> Add Row</Button>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title={`No ${config.label.toLowerCase()} entries yet`}
            action={
              config.key === 'systems' ? (
                <Button variant="secondary" onClick={() => void seedSystems()}>Load Standard System List</Button>
              ) : (
                <Button onClick={() => openEditor(null)}>Add First Row</Button>
              )
            }
          />
        ) : (
          <DataTable head={[...config.fields.map((f) => f.label), '']}>
            {rows.map((row) => (
              <tr key={String(row.id)} className="hover:bg-slate-800/70">
                {config.fields.map((field) => (
                  <td key={field.key} className="px-4 py-3 text-sm">
                    {field.key === config.statusKey ? (
                      <Badge tone={statusTone(String(row[field.key] ?? ''))}>{titleCase(String(row[field.key] ?? '—'))}</Badge>
                    ) : (
                      <span className={field.type === 'number' ? 'font-semibold' : ''}>{String(row[field.key] ?? '—')}</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEditor(row)} className="rounded p-1.5 text-slate-400 hover:bg-slate-700" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void deleteRecord(config.table, String(row.id)).then(reload)}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-900/40 hover:text-red-300"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={`${config.label} — ${draft.id ? 'Edit' : 'Add'} Row`}>
        <form onSubmit={save} className="space-y-4">
          {config.fields.map((field) => (
            <Field key={field.key} label={field.label}>
              {field.type === 'select' ? (
                <Select
                  value={String(draft[field.key] ?? '')}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{titleCase(opt)}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={draft[field.key] === undefined || draft[field.key] === null ? '' : String(draft[field.key])}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BoardSummary({ configKey, rows }: { configKey: string; rows: Record<string, unknown>[] }) {
  if (configKey === 'beds') {
    const staffed = sumBy(rows, (r) => r.staffed_beds as number);
    const occupied = sumBy(rows, (r) => r.occupied_beds as number);
    const available = sumBy(rows, (r) => r.available_beds as number);
    const surge = sumBy(rows, (r) => r.surge_beds_available as number);
    const census = staffed > 0 ? Math.round((occupied / staffed) * 100) : 0;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staffed Beds" value={staffed} />
        <StatCard label="Occupied / Census" value={`${occupied} (${census}%)`} tone={census > 90 ? 'red' : census > 75 ? 'yellow' : 'green'} />
        <StatCard label="Available Now" value={available} tone="blue" />
        <StatCard label="Surge Capacity" value={surge} />
      </div>
    );
  }
  if (configKey === 'acuity') {
    const total = sumBy(rows, (r) => r.patient_count as number);
    const immediate = sumBy(rows.filter((r) => r.category === 'immediate'), (r) => r.patient_count as number);
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Patients Tracked" value={total} />
        <StatCard label="Immediate (Red)" value={immediate} tone={immediate > 0 ? 'red' : 'slate'} />
      </div>
    );
  }
  if (configKey === 'supplies') {
    const red = rows.filter((r) => r.status === 'red').length;
    const yellow = rows.filter((r) => r.status === 'yellow').length;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Critical Items Tracked" value={rows.length} />
        <StatCard label="Red (< 3 days)" value={red} tone={red ? 'red' : 'green'} />
        <StatCard label="Yellow (3–7 days)" value={yellow} tone={yellow ? 'yellow' : 'slate'} />
      </div>
    );
  }
  if (configKey === 'staffing') {
    const needed = sumBy(rows, (r) => r.needed as number);
    const onHand = sumBy(rows, (r) => r.on_hand as number);
    const gap = needed - onHand;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff On Hand" value={onHand} />
        <StatCard label="Staff Needed" value={needed} />
        <StatCard label="Gap" value={gap > 0 ? gap : 0} tone={gap > 0 ? 'red' : 'green'} />
      </div>
    );
  }
  if (configKey === 'systems') {
    const red = rows.filter((r) => r.status === 'red').length;
    const yellow = rows.filter((r) => r.status === 'yellow').length;
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Systems Tracked" value={rows.length} />
        <StatCard label="Impaired (Yellow)" value={yellow} tone={yellow ? 'yellow' : 'slate'} />
        <StatCard label="Down (Red)" value={red} tone={red ? 'red' : 'green'} />
      </div>
    );
  }
  return null;
}
