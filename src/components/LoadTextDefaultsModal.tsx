import { useEffect, useMemo, useState } from 'react';
import { ListPlus } from 'lucide-react';
import { useRecords } from '../hooks/useRecords';
import { getDefaultsCategory, mapDefaultsRow } from '../data/formDefaultsCatalog';
import { Button, EmptyState, Modal } from './ui';
import type { FormDefaultRow } from '../types/domain';

// Variant of LoadDefaultsModal that appends selected defaults rows into a
// textarea (e.g. Exercise objectives) instead of a repeating table. Rows are
// formatted into a single line each, joined by newlines.

interface LoadTextDefaultsModalProps {
  open: boolean;
  onClose: () => void;
  /** Category key in formDefaultsCatalog, e.g. 'objectives'. */
  categoryKey: string;
  /** Template code the category feeds — used to pick the row mapping. */
  templateCode: string;
  /** Table field key the category targets. */
  fieldKey: string;
  /** A descriptive title for the target field. */
  fieldLabel: string;
  onAppend: (text: string) => void;
}

function formatRow(row: Record<string, unknown>): string {
  const values = Object.values(row)
    .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
    .filter(Boolean);
  return values.join(' — ');
}

export function LoadTextDefaultsModal({
  open,
  onClose,
  categoryKey,
  templateCode,
  fieldKey,
  fieldLabel,
  onAppend
}: LoadTextDefaultsModalProps) {
  const category = useMemo(() => getDefaultsCategory(categoryKey), [categoryKey]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { rows, loading } = useRecords<FormDefaultRow>('form_defaults', {
    match: { category: categoryKey },
    orderBy: 'sort_order',
    ascending: true
  });
  const activeRows = rows.filter((r) => r.is_active !== false);

  useEffect(() => {
    setSelected(new Set());
  }, [open, categoryKey]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const insertSelected = () => {
    if (!category) return;
    const picked = activeRows
      .filter((r) => selected.has(r.id))
      .map((r) => formatRow(mapDefaultsRow(category, templateCode, fieldKey, r.data)))
      .filter(Boolean);
    if (picked.length) onAppend(picked.join('\n'));
    setSelected(new Set());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Load Defaults — ${fieldLabel}`} wide>
      {!category ? (
        <EmptyState title="No defaults category found" />
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
                      <td key={col.key} className="px-3 py-2 text-slate-200">
                        {row.data[col.key] === null || row.data[col.key] === undefined || row.data[col.key] === ''
                          ? '—'
                          : String(row.data[col.key])}
                      </td>
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

/** Whether a defaults category exists that can feed the given template field. */
export function hasTextDefaults(categoryKey: string): boolean {
  return Boolean(getDefaultsCategory(categoryKey));
}
