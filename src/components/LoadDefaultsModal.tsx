import { useEffect, useMemo, useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { categoriesForField, mapDefaultsRow } from '../data/formDefaultsCatalog';
import { Button, EmptyState, Modal, Tabs } from './ui';
import type { TemplateField } from '../types/forms';
import type { FormDefaultRow } from '../types/domain';

// "Load Defaults" picker: shows the org's preloaded defaults rows that match
// a form's table field, and appends the selected ones (mapped into the
// table's row shape) — the Essential IAP retrieve-defaults workflow.

interface LoadDefaultsModalProps {
  open: boolean;
  onClose: () => void;
  templateCode: string;
  field: TemplateField | null;
  onAppend: (rows: Array<Record<string, unknown>>) => void;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function LoadDefaultsModal({ open, onClose, templateCode, field, onAppend }: LoadDefaultsModalProps) {
  const categories = useMemo(
    () => (field ? categoriesForField(templateCode, field.key) : []),
    [templateCode, field]
  );
  const [categoryKey, setCategoryKey] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCategoryKey(categories[0]?.key ?? '');
    setSelected(new Set());
  }, [categories, open]);

  const category = categories.find((c) => c.key === categoryKey) ?? categories[0] ?? null;

  const { rows, loading } = useRecords<FormDefaultRow>('form_defaults', {
    match: { category: category?.key ?? '' },
    orderBy: 'sort_order',
    ascending: true
  });
  const activeRows = rows.filter((r) => r.is_active !== false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const insertSelected = () => {
    if (!category || !field) return;
    const picked = activeRows
      .filter((r) => selected.has(r.id))
      .map((r) => mapDefaultsRow(category, templateCode, field.key, r.data));
    if (picked.length) onAppend(picked);
    setSelected(new Set());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Load Defaults — ${field?.label ?? ''}`} wide>
      {categories.length > 1 && category && (
        <Tabs
          tabs={categories.map((c) => ({ key: c.key, label: c.label }))}
          active={category.key}
          onChange={(key) => {
            setCategoryKey(key);
            setSelected(new Set());
          }}
        />
      )}

      {!category ? (
        <EmptyState title="No defaults available for this table" />
      ) : loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading defaults…</p>
      ) : activeRows.length === 0 ? (
        <EmptyState
          title={`No ${category.label.toLowerCase()} preloaded yet`}
          hint="Add rows under Form Defaults in the main navigation, then load them here."
        />
      ) : (
        <div className="space-y-4">
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.size === activeRows.length && activeRows.length > 0}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(activeRows.map((r) => r.id)) : new Set())
                      }
                      className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-600"
                      aria-label="Select all"
                    />
                  </th>
                  {category.columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left font-medium">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {activeRows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-800/70"
                    onClick={() => toggle(row.id)}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-600"
                      />
                    </td>
                    {category.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-slate-200">{formatCell(row.data[col.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={insertSelected} disabled={selected.size === 0}>
              <ListPlus size={16} /> Insert Selected ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
