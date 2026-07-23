import { useCallback, useRef, useState } from 'react';
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Download, FileUp, RotateCcw } from 'lucide-react';
import { Button, Modal } from './ui';
import { cn } from '../lib/utils';
import type { DefaultsCategory } from '../data/formDefaultsCatalog';
import { parseImportFile, generateCsvTemplate, downloadTextFile, type ParseResult } from '../lib/fileImport';

type Phase = 'idle' | 'parsing' | 'preview' | 'error';

export function ImportDefaultsModal({
  open,
  onClose,
  category,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  category: DefaultsCategory;
  onImport: (rows: Record<string, unknown>[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setFileName('');
    setErrorMsg('');
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setPhase('parsing');
    setErrorMsg('');
    try {
      const parsed = await parseImportFile(file, category.columns);
      setResult(parsed);
      setPhase('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read the file');
      setPhase('error');
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate(category.columns);
    downloadTextFile(`${category.key}-template.csv`, csv);
  };

  const handleConfirmImport = () => {
    if (!result || result.rows.length === 0) return;
    onImport(result.rows.map((r) => r.data));
    reset();
    onClose();
  };

  const canImport = result && result.rows.length > 0 && result.missingHeaders.length === 0;

  return (
    <Modal open={open} onClose={handleClose} title={`Import ${category.label}`} wide>
      <div className="space-y-5">
        {/* Format guide */}
        <FormatGuide category={category} onDownloadTemplate={handleDownloadTemplate} />

        {phase === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center transition-colors',
              dragOver ? 'border-brand-500 bg-brand-900/20' : 'border-slate-600 bg-slate-800/40'
            )}
          >
            <FileUp size={32} className="text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-200">
              Drag &amp; drop a CSV or XLSX file here
            </p>
            <p className="mt-1 text-xs text-slate-500">or</p>
            <Button variant="secondary" className="mt-3" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} /> Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onInputChange}
              className="hidden"
            />
          </div>
        )}

        {phase === 'parsing' && (
          <div className="flex items-center justify-center gap-3 py-10 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-brand-500" />
            <span className="text-sm">Parsing {fileName}…</span>
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-red-800 bg-red-900/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-200">Could not read file</p>
                <p className="mt-1 text-xs text-red-300">{errorMsg}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                  <RotateCcw size={14} /> Try Again
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase === 'preview' && result && (
          <PreviewPanel
            result={result}
            fileName={fileName}
            category={category}
            canImport={!!canImport}
            onConfirm={handleConfirmImport}
            onReset={reset}
          />
        )}
      </div>
    </Modal>
  );
}

function FormatGuide({
  category,
  onDownloadTemplate,
}: {
  category: DefaultsCategory;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-100">Expected File Format</h4>
        <Button variant="ghost" size="sm" onClick={onDownloadTemplate}>
          <Download size={14} /> Download Template
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Upload a <strong className="text-slate-300">CSV</strong> or{' '}
        <strong className="text-slate-300">XLSX</strong> file with a header row. The header
        labels must match the column names below (case-insensitive). Extra columns are ignored.
      </p>

      <table className="mt-3 w-full text-left text-xs">
        <thead className="text-slate-400">
          <tr>
            <th className="py-1.5 pr-4 font-medium">Column Header</th>
            <th className="py-1.5 pr-4 font-medium">Type</th>
            <th className="py-1.5 font-medium">Example</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60 text-slate-300">
          {category.columns.map((col) => (
            <tr key={col.key}>
              <td className="py-1.5 pr-4 font-medium text-slate-100">{col.label}</td>
              <td className="py-1.5 pr-4 text-slate-400">
                {col.type === 'checkbox'
                  ? 'Yes/No'
                  : col.type === 'number'
                  ? 'Number'
                  : col.type === 'select'
                  ? `One of: ${col.options?.join(', ') ?? ''}`
                  : 'Text'}
              </td>
              <td className="py-1.5 text-slate-500">
                {col.type === 'checkbox'
                  ? 'yes'
                  : col.type === 'number'
                  ? '1'
                  : col.type === 'select'
                  ? col.options?.[0] ?? ''
                  : `sample text`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-900/50 p-2.5">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="text-xs text-slate-400">
          Checkbox columns accept: <code className="text-slate-300">yes</code>,{' '}
          <code className="text-slate-300">no</code>, <code className="text-slate-300">true</code>,
          <code className="text-slate-300">false</code>, <code className="text-slate-300">1</code>,
          <code className="text-slate-300">0</code>, or <code className="text-slate-300">x</code>.
          The first sheet in an XLSX workbook is used.
        </p>
      </div>
    </div>
  );
}

function PreviewPanel({
  result,
  fileName,
  category,
  canImport,
  onConfirm,
  onReset,
}: {
  result: ParseResult;
  fileName: string;
  category: DefaultsCategory;
  canImport: boolean;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const totalWarnings = result.rows.reduce((n, r) => n + r.warnings.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1 text-slate-200">
          <CheckCircle2 size={14} className="text-emerald-400" />
          {result.rows.length} row{result.rows.length !== 1 ? 's' : ''} parsed
        </span>
        {fileName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1 text-slate-300">
            {fileName}
          </span>
        )}
        {totalWarnings > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-900/60 px-3 py-1 text-amber-200">
            <AlertTriangle size={14} />
            {totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Missing headers — blocking */}
      {result.missingHeaders.length > 0 && (
        <div className="rounded-lg border border-amber-800 bg-amber-900/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">Missing column headers</p>
              <p className="mt-1 text-xs text-amber-300">
                The file is missing these required columns:{' '}
                <strong>{result.missingHeaders.join(', ')}</strong>. Please add them to the file
                and try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unmatched headers — non-blocking */}
      {result.unmatchedHeaders.length > 0 && (
        <div className="rounded-md bg-slate-700/40 p-2.5 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Ignored columns:</span>{' '}
          {result.unmatchedHeaders.join(', ')}
        </div>
      )}

      {/* Warnings list */}
      {totalWarnings > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-md border border-amber-800/50 bg-amber-900/20 p-3">
          <ul className="space-y-1 text-xs text-amber-200">
            {result.rows.flatMap((r, i) =>
              r.warnings.map((w, j) => <li key={`${i}-${j}`}>{w}</li>)
            )}
          </ul>
        </div>
      )}

      {/* Data preview table */}
      {result.rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {category.columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {result.rows.slice(0, 10).map((row, i) => (
                <tr key={i} className="text-slate-200">
                  {category.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-xs">
                      {String(row.data[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 10 && (
            <div className="border-t border-slate-700 px-3 py-2 text-center text-xs text-slate-500">
              Showing 10 of {result.rows.length} rows
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-slate-700 pt-4">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw size={14} /> Choose Different File
        </Button>
        <Button onClick={onConfirm} disabled={!canImport}>
          <CheckCircle2 size={16} /> Import {result.rows.length} Row{result.rows.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}
