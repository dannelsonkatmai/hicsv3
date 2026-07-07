import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import type { FormTemplateDef, TemplateColumn, TemplateField } from '../types/forms';
import { Button, Card, Field, Input, Select, Textarea } from './ui';
import { cn } from '../lib/utils';

// The template-driven forms engine renderer: interprets FormTemplateDef
// section/field definitions, so every HICS form (and future org-custom forms)
// is configuration, not code.

interface FormRendererProps {
  template: FormTemplateDef;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function FormRenderer({ template, data, onChange, readOnly }: FormRendererProps) {
  const setField = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      {template.noPhi && (
        <div className="flex items-start gap-3 rounded-xl border border-red-800 bg-red-950/50 p-4">
          <ShieldAlert className="mt-0.5 shrink-0 text-red-400" size={20} />
          <div>
            <p className="text-sm font-semibold text-red-200">Aggregate counts only — no patient identifiers</p>
            <p className="mt-0.5 text-xs text-red-300/80">
              This form stores totals by category and status. Never enter names, MRNs, dates of birth, or any other
              patient-identifying information. Entries are validated before saving.
            </p>
          </div>
        </div>
      )}
      {template.schema.sections.map((section) => (
        <Card key={section.title} title={section.title} subtitle={section.description}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {section.fields.map((field) => (
              <FormFieldControl
                key={field.key}
                field={field}
                value={data[field.key]}
                onChange={(v) => setField(field.key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function FormFieldControl({ field, value, onChange, readOnly }: {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}) {
  if (field.type === 'note') {
    return (
      <p className={cn('text-xs text-slate-400 md:col-span-3')}>{field.label}</p>
    );
  }

  if (field.type === 'table') {
    return (
      <div className="md:col-span-3">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">{field.label}</span>
        <RepeatingTable
          columns={field.columns ?? []}
          rows={Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []}
          onChange={onChange}
          readOnly={readOnly}
        />
        {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
      </div>
    );
  }

  const common = { disabled: readOnly, required: field.required };
  let control: JSX.Element;
  switch (field.type) {
    case 'textarea':
      control = <Textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} {...common} />;
      break;
    case 'number':
      control = (
        <Input
          type="number"
          value={value === undefined || value === null || value === '' ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          {...common}
        />
      );
      break;
    case 'date':
      control = <Input type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} {...common} />;
      break;
    case 'time':
      control = <Input type="time" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} {...common} />;
      break;
    case 'datetime':
      control = <Input type="datetime-local" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} {...common} />;
      break;
    case 'select':
      control = (
        <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">— Select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      );
      break;
    case 'checkbox':
      return (
        <label className="flex min-h-touch items-center gap-2 md:col-span-1">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
            className="h-5 w-5 rounded border-slate-500 bg-slate-800 text-brand-600"
          />
          <span className="text-sm text-slate-300">{field.label}</span>
        </label>
      );
    case 'signature':
      control = (
        <Input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type name to sign"
          {...common}
        />
      );
      break;
    default:
      control = <Input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} {...common} />;
  }

  return (
    <Field label={field.label} required={field.required} span={field.span}>
      {control}
      {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
    </Field>
  );
}

function RepeatingTable({ columns, rows, onChange, readOnly }: {
  columns: TemplateColumn[];
  rows: Array<Record<string, unknown>>;
  onChange: (rows: Array<Record<string, unknown>>) => void;
  readOnly?: boolean;
}) {
  const updateCell = (rowIndex: number, key: string, value: unknown) => {
    const next = rows.map((row, i) => (i === rowIndex ? { ...row, [key]: value } : row));
    onChange(next);
  };

  const addRow = () => {
    const blank: Record<string, unknown> = {};
    columns.forEach((c) => (blank[c.key] = c.type === 'checkbox' ? false : ''));
    onChange([...rows, blank]);
  };

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const widthClass = (w?: string) => (w === 'narrow' ? 'w-24' : w === 'wide' ? 'min-w-[220px]' : 'min-w-[140px]');

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('px-2 py-2 text-left font-medium', widthClass(col.width))}>{col.label}</th>
            ))}
            {!readOnly && <th className="w-10 px-2 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col.key} className="px-1 py-1">
                  <TableCell col={col} value={row[col.key]} onChange={(v) => updateCell(rowIndex, col.key, v)} readOnly={readOnly} />
                </td>
              ))}
              {!readOnly && (
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
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (readOnly ? 0 : 1)} className="px-3 py-4 text-center text-xs text-slate-500">
                No rows yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!readOnly && (
        <div className="border-t border-slate-700 p-2">
          <Button variant="ghost" size="sm" onClick={addRow} type="button">
            <Plus size={15} /> Add Row
          </Button>
        </div>
      )}
    </div>
  );
}

function TableCell({ col, value, onChange, readOnly }: {
  col: TemplateColumn;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}) {
  const base =
    'w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 focus:border-brand-500 focus:outline-none disabled:opacity-60';
  switch (col.type) {
    case 'checkbox':
      return (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={readOnly}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-brand-600"
          />
        </div>
      );
    case 'select':
      return (
        <select className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} disabled={readOnly}>
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
          disabled={readOnly}
        />
      );
    case 'date':
      return <input type="date" className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
    case 'time':
      return <input type="time" className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
    default:
      return <input className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} disabled={readOnly} />;
  }
}
