import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

// Shared UI kit. Command-post ergonomics: 44px+ touch targets, high contrast,
// readable on tablets in dark rooms.

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    ghost: 'bg-transparent hover:bg-slate-700/60 text-slate-300'
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm min-h-touch', lg: 'px-6 py-3 text-base min-h-touch' };
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

const inputBase =
  'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 ' +
  'placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ' +
  'disabled:opacity-60 min-h-touch';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'min-h-[96px]', className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputBase, className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, required, children, span }: { label: string; required?: boolean; children: ReactNode; span?: 1 | 2 | 3 }) {
  const spanClass = span === 3 ? 'md:col-span-3' : span === 2 ? 'md:col-span-2' : '';
  return (
    <label className={cn('block', spanClass)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

export function Card({ title, subtitle, actions, children, className }: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-slate-700 bg-slate-800/60 shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 px-4 py-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const badgeTones: Record<string, string> = {
  slate: 'bg-slate-700 text-slate-200',
  blue: 'bg-blue-900/70 text-blue-200',
  green: 'bg-emerald-900/70 text-emerald-200',
  yellow: 'bg-amber-900/70 text-amber-200',
  red: 'bg-red-900/70 text-red-200',
  purple: 'bg-purple-900/70 text-purple-200'
};

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', badgeTones[tone])}>
      {children}
    </span>
  );
}

/** Map common status strings to badge tones so lists stay consistent. */
export function statusTone(status: string): keyof typeof badgeTones {
  const green = ['active', 'approved', 'completed', 'delivered', 'published', 'met', 'verified', 'final', 'available', 'green', 'open', 'sent', 'done'];
  const yellow = ['in_review', 'in_progress', 'partial', 'partially_met', 'pending', 'ordered', 'yellow', 'assigned', 'demobilizing', 'in_transit', 'draft'];
  const red = ['denied', 'not_met', 'failed', 'red', 'divert', 'blocked', 'expired', 'overdue', 'cancelled', 'critical', 'immediate'];
  if (green.includes(status)) return 'green';
  if (yellow.includes(status)) return 'yellow';
  if (red.includes(status)) return 'red';
  return 'slate';
}

export function StatCard({ label, value, hint, tone = 'slate' }: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'slate' | 'blue' | 'green' | 'yellow' | 'red';
}) {
  const tones = {
    slate: 'border-slate-700',
    blue: 'border-brand-700',
    green: 'border-emerald-700',
    yellow: 'border-amber-700',
    red: 'border-red-700'
  };
  return (
    <div className={cn('rounded-xl border bg-slate-800/60 p-4', tones[tone])}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 py-12 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-12" onClick={onClose}>
      <div
        className={cn('w-full rounded-xl border border-slate-700 bg-slate-800 shadow-2xl', wide ? 'max-w-4xl' : 'max-w-xl')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/70 text-slate-200">{children}</tbody>
      </table>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: {
  tabs: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-700 bg-slate-800/70 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-touch',
            active === tab.key ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-700'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-brand-500" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
