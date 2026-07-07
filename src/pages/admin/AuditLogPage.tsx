import { useState } from 'react';
import { useRecords } from '../../hooks/useRecords';
import { Badge, Card, DataTable, EmptyState, Input, PageHeader } from '../../components/ui';
import { fmtDateTime } from '../../lib/utils';
import type { AuditLogEntry } from '../../types/domain';

// Immutable audit trail viewer (admins/auditors). Rows are INSERT-only under
// RLS — there is no update or delete path, in the app or the database.

export function AuditLogPage() {
  const { rows: entries, loading } = useRecords<AuditLogEntry>('audit_log', {
    orderBy: 'created_at',
    ascending: false,
    limit: 500
  });
  const [filter, setFilter] = useState('');

  const filtered = entries.filter((entry) => {
    if (!filter) return true;
    const haystack = `${entry.action} ${entry.actor_email} ${entry.entity_type} ${JSON.stringify(entry.detail)}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Immutable record of security- and record-level events (most recent 500 shown)"
      />
      <Card>
        <div className="mb-4 max-w-sm">
          <Input placeholder="Filter by action, user, or entity…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {!loading && filtered.length === 0 ? (
          <EmptyState title="No audit events" hint="Actions like incident activation, IAP approval, role changes, and notifications are recorded here." />
        ) : (
          <DataTable head={['Time', 'Actor', 'Action', 'Entity', 'Detail']}>
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/70">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">{fmtDateTime(entry.created_at)}</td>
                <td className="px-4 py-3 text-sm">{entry.actor_email || '—'}</td>
                <td className="px-4 py-3"><Badge tone="blue">{entry.action}</Badge></td>
                <td className="px-4 py-3 text-sm text-slate-400">{entry.entity_type}</td>
                <td className="max-w-md truncate px-4 py-3 text-xs text-slate-500">{JSON.stringify(entry.detail)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
