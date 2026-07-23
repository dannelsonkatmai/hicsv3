import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Upload } from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { saveRecord, deleteRecord } from '../lib/repo';
import { DEFAULTS_CATEGORIES, getDefaultsCategory } from '../data/formDefaultsCatalog';
import { Button, Card, EmptyState, PageHeader, Spinner, Tabs } from '../components/ui';
import { ImportDefaultsModal } from '../components/ImportDefaultsModal';
import { cn } from '../lib/utils';
import type { TemplateColumn } from '../types/forms';
import type { FormDefaultRow } from '../types/domain';

// Defaults library: org-level rows preloaded once and pulled into HICS form
// tables while filling them (via the Load Defaults button on matching tables).

interface DraftRow {
  id?: string;
  data: Record<string, unknown>;
}

function blankRow(columns: TemplateColumn[]): DraftRow {
  const data: Record<string, unknown> = {};
  columns.forEach((c) => (data[c.key] = c.type === 'checkbox' ? false : ''));
  return { data };
}

function isBlank(row: DraftRow): boolean {
  return Object.values(row.data).every((v) => v === '' || v === false || v === null || v === undefined);
}

export function DefaultsPage() {
  const [categoryKey, setCategoryKey] = useState(DEFAULTS_CATEGORIES[0].key);
  const category = getDefaultsCategory(categoryKey) ?? DEFAULTS_CATEGORIES[0];

  const { rows, loading, reload } = useRecords<FormDefaultRow>('form_defaults', {
    match: { category: categoryKey },
    orderBy: 'sort_order',
    ascending: true
  });

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    setDrafts(rows.filter((r) => r.is_active !== false).map((r) => ({ id: r.id, data: { ...r.data } })));
    setRemovedIds([]);
    setDirty(false);
  }, [rows]);

  const updateCell = (index: number, key: string, value: unknown) => {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, data: { ...row.data, [key]: value } } : row)));
    setDirty(true);
  };

  const addRow = () => {
    setDrafts((prev) => [...prev, blankRow(category.columns)]);
    setDirty(true);
  };

  const removeRow = (index: number) => {
    const row = drafts[index];
    if (row.id) setRemovedIds((prev) => [...prev, row.id!]);
    setDrafts((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const kept = drafts.filter((row) => !isBlank(row));
      // Rows the user emptied out count as deletions, same as removed rows.
      const clearedIds = drafts.filter((row) => isBlank(row) && row.id).map((row) => row.id as string);
      for (const [index, row] of kept.entries()) {
        await saveRecord('form_defaults', {
          ...(row.id ? { id: row.id } : {}),
          category: categoryKey,
          data: row.data,
          sort_order: index,
          is_active: true
        });
      }
      for (const id of [...removedIds, ...clearedIds]) {
        await deleteRecord('form_defaults', id);
      }
      await reload();
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  };

  const handleImport = (importedRows: Record<string, unknown>[]) => {
    setDrafts((prev) => [...prev, ...importedRows.map((data) => ({ data }))]);
    setDirty(true);
  };

  const switchCategory = (key: string) => {
    if (key === categoryKey) return;
    if (dirty && !window.confirm('Discard unsaved changes on this tab?')) return;
    setCategoryKey(key);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Form Defaults"
        subtitle="Preload data once — contacts, standing objectives, aid stations — then pull it into HICS forms with the Load Defaults button on matching tables."
        actions={
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-xs text-slate-500">Saved {savedAt}</span>}
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Import CSV / XLSX
            </Button>
            <Button onClick={() => void save()} disabled={saving || !dirty}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <Tabs
        tabs={DEFAULTS_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
        active={categoryKey}
        onChange={switchCategory}
      />

      <Card title={category.label} subtitle={category.description}>
        {loading ? (
          <Spinner label="Loading defaults…" />
        ) : drafts.length === 0 ? (
          <EmptyState
            title={`No ${category.label.toLowerCase()} preloaded yet`}
            hint="Rows added here become available on the matching HICS form tables during an incident."
            action={<Button variant="secondary" onClick={addRow}><Plus size={15} /> Add Row</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  {category.columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-2 py-2 text-left font-medium',
                        col.width === 'narrow' ? 'w-24' : col.width === 'wide' ? 'min-w-[220px]' : 'min-w-[140px]'
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {drafts.map((row, rowIndex) => (
                  <tr key={row.id ?? `new-${rowIndex}`}>
                    {category.columns.map((col) => (
                      <td key={col.key} className="px-1 py-1">
                        <DefaultsCell
                          col={col}
                          value={row.data[col.key]}
                          onChange={(v) => updateCell(rowIndex, col.key, v)}
                        />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-center">
                      <button
                        onClick={() => removeRow(rowIndex)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-900/40 hover:text-red-300"
                        aria-label="Remove row"
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-700 p-2">
              <Button variant="ghost" size="sm" onClick={addRow} type="button">
                <Plus size={15} /> Add Row
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ImportDefaultsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        category={category}
        onImport={handleImport}
      />

      <Card title="Where these defaults appear">
        <ul className="space-y-1 text-sm text-slate-300">
          {category.targets.map((t) => (
            <li key={`${t.template}-${t.field}`}>
              <span className="font-medium text-slate-100">{t.template}</span>
              <span className="text-slate-400"> — Load Defaults on its table while filling the form.</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function DefaultsCell({ col, value, onChange }: {
  col: TemplateColumn;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const base =
    'w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none';
  switch (col.type) {
    case 'checkbox':
      return (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-600"
          />
        </div>
      );
    case 'select':
      return (
        <select className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(col.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case 'number':
      return (
        <input
          type="number"
          className={base}
          value={value === undefined || value === null || value === '' ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    default:
      return <input className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}
