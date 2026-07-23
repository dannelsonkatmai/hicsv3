import { useMemo, useState, type FormEvent } from 'react';
import { Download, ListPlus, Plus } from 'lucide-react';
import { useRecords } from '../../hooks/useRecords';
import { saveRecord, deleteRecord } from '../../lib/repo';
import { exportTablePdf } from '../../lib/pdf';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea } from '../../components/ui';
import { LoadTextDefaultsModal } from '../../components/LoadTextDefaultsModal';
import { titleCase } from '../../lib/utils';
import type { HvaEntry } from '../../types/domain';

// Hazard Vulnerability Analysis with Kaiser-style scoring:
// relative risk % = (probability / 3) × (average severity / 3) × 100,
// where severity averages human/property/business impact and the three
// mitigation categories (higher = weaker mitigation).

function relativeRisk(entry: HvaEntry): number {
  const severity =
    (entry.human_impact + entry.property_impact + entry.business_impact + entry.preparedness + entry.internal_response + entry.external_response) / 6;
  return Math.round((entry.probability / 3) * (severity / 3) * 1000) / 10;
}

const SCORE_FIELDS: Array<{ key: keyof HvaEntry; label: string; help: string }> = [
  { key: 'probability', label: 'Probability', help: '0 N/A · 1 Low · 2 Moderate · 3 High' },
  { key: 'human_impact', label: 'Human Impact', help: 'Death or injury potential' },
  { key: 'property_impact', label: 'Property Impact', help: 'Physical losses and damages' },
  { key: 'business_impact', label: 'Business Impact', help: 'Interruption of services' },
  { key: 'preparedness', label: 'Preparedness Gap', help: '1 High preparedness · 3 Poor' },
  { key: 'internal_response', label: 'Internal Response Gap', help: '1 Strong · 3 Weak' },
  { key: 'external_response', label: 'External Response Gap', help: '1 Strong · 3 Weak' }
];

export function HvaPage() {
  const { rows: entries, reload } = useRecords<HvaEntry>('hva_entries', { orderBy: 'hazard_name' });
  const [editing, setEditing] = useState<Partial<HvaEntry> | null>(null);
  const [showNotesDefaults, setShowNotesDefaults] = useState(false);

  const ranked = useMemo(() => [...entries].sort((a, b) => relativeRisk(b) - relativeRisk(a)), [entries]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await saveRecord('hva_entries', { ...editing, assessment_year: new Date().getFullYear() } as Record<string, unknown>);
    setEditing(null);
    await reload();
  };

  const exportPdf = () =>
    exportTablePdf(
      'Hazard Vulnerability Analysis',
      `${new Date().getFullYear()} assessment · Kaiser-style relative risk`,
      [
        { key: 'hazard_name', label: 'Hazard' },
        { key: 'hazard_category', label: 'Category' },
        { key: 'probability', label: 'Prob.' },
        { key: 'human_impact', label: 'Human' },
        { key: 'property_impact', label: 'Property' },
        { key: 'business_impact', label: 'Business' },
        { key: 'risk', label: 'Relative Risk %' }
      ],
      ranked.map((r) => ({ ...r, risk: relativeRisk(r) })),
      'HVA.pdf'
    );

  const setScore = (key: keyof HvaEntry, value: number) => setEditing((d) => ({ ...d, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Hazard Vulnerability Analysis"
        subtitle="Scored hazards drive planning priorities, exercise objectives, and the EOP"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportPdf} disabled={!entries.length}><Download size={16} /> Export PDF</Button>
            <Button onClick={() => setEditing({ hazard_category: 'natural', probability: 1, human_impact: 1, property_impact: 1, business_impact: 1, preparedness: 1, internal_response: 1, external_response: 1 })}>
              <Plus size={16} /> Add Hazard
            </Button>
          </div>
        }
      />

      {ranked.length === 0 ? (
        <EmptyState title="No hazards assessed yet" hint="Add hazards and score probability, impact, and mitigation to compute relative risk." />
      ) : (
        <DataTable head={['Rank', 'Hazard', 'Category', 'Probability', 'Relative Risk', '']}>
          {ranked.map((entry, index) => {
            const risk = relativeRisk(entry);
            return (
              <tr key={entry.id} className="hover:bg-slate-800/70">
                <td className="px-4 py-3 text-sm font-bold text-slate-400">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium">{entry.hazard_name}</td>
                <td className="px-4 py-3 text-sm">{titleCase(entry.hazard_category)}</td>
                <td className="px-4 py-3 text-sm">{entry.probability} / 3</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className={`h-full ${risk >= 50 ? 'bg-red-500' : risk >= 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(risk, 100)}%` }}
                      />
                    </div>
                    <Badge tone={risk >= 50 ? 'red' : risk >= 25 ? 'yellow' : 'green'}>{risk}%</Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-sm text-brand-400 hover:text-brand-300" onClick={() => setEditing(entry)}>Edit</button>
                    <button className="text-sm text-slate-500 hover:text-red-300" onClick={() => void deleteRecord('hva_entries', entry.id).then(reload)}>Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Hazard' : 'Add Hazard'} wide>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Hazard" required>
              <Input value={editing?.hazard_name ?? ''} onChange={(e) => setEditing((d) => ({ ...d, hazard_name: e.target.value }))} required placeholder="e.g., Earthquake, Cyberattack, Mass Casualty" />
            </Field>
            <Field label="Category">
              <Select value={editing?.hazard_category ?? 'natural'} onChange={(e) => setEditing((d) => ({ ...d, hazard_category: e.target.value as HvaEntry['hazard_category'] }))}>
                {['natural', 'technological', 'human', 'hazmat', 'public_health'].map((c) => (
                  <option key={c} value={c}>{titleCase(c)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {SCORE_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <Select value={String(editing?.[field.key] ?? 1)} onChange={(e) => setScore(field.key, Number(e.target.value))}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
                <p className="mt-1 text-[10px] text-slate-500">{field.help}</p>
              </Field>
            ))}
          </div>
          <Field label="Notes">
            <Textarea value={editing?.notes ?? ''} onChange={(e) => setEditing((d) => ({ ...d, notes: e.target.value }))} />
            <div className="mt-1.5">
              <Button variant="ghost" size="sm" type="button" onClick={() => setShowNotesDefaults(true)}>
                <ListPlus size={15} /> Load Defaults
              </Button>
            </div>
          </Field>
          {editing && editing.hazard_name && (
            <p className="text-sm text-slate-300">
              Computed relative risk: <span className="font-bold">{relativeRisk(editing as HvaEntry)}%</span>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save Hazard</Button>
          </div>
        </form>
      </Modal>

      <LoadTextDefaultsModal
        open={showNotesDefaults}
        onClose={() => setShowNotesDefaults(false)}
        fieldLabel="Hazard Notes"
        onAppend={(text) =>
          setEditing((d) => ({ ...d, notes: [String(d?.notes ?? ''), text].map((s) => s.trim()).filter(Boolean).join('\n') }))
        }
      />
    </div>
  );
}
