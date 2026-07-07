import { useState, type FormEvent } from 'react';
import { MessageSquare, Plus, Reply } from 'lucide-react';
import { useIncident } from './IncidentContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useRecords } from '../../../hooks/useRecords';
import { saveRecord } from '../../../lib/repo';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, statusTone } from '../../../components/ui';
import { fmtDateTime, titleCase } from '../../../lib/utils';
import type { ActivityLogEntry, IncidentMessage } from '../../../types/domain';

// HICS 213 incident messaging + HICS 214 operational/activity log.
// Messages update live via Realtime when online; both work offline.

export function CommsTab() {
  const [tab, setTab] = useState('messages');
  return (
    <div>
      <Tabs
        tabs={[
          { key: 'messages', label: 'Messages (213)' },
          { key: 'log', label: 'Activity Log (214)' }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'messages' ? <MessagesPanel /> : <ActivityLogPanel />}
    </div>
  );
}

function MessagesPanel() {
  const { incident } = useIncident();
  const { profile } = useAuth();
  const { rows: messages, reload } = useRecords<IncidentMessage>(
    'incident_messages',
    { match: { incident_id: incident.id }, orderBy: 'created_at', ascending: false },
    { realtime: true }
  );
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<IncidentMessage>>({ priority: 'routine' });
  const [replying, setReplying] = useState<IncidentMessage | null>(null);
  const [replyText, setReplyText] = useState('');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('incident_messages', {
      ...draft,
      incident_id: incident.id,
      from_name: draft.from_name || profile?.full_name || '',
      created_by: profile?.id ?? null
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ priority: 'routine' });
    await reload();
  };

  const sendReply = async () => {
    if (!replying) return;
    await saveRecord('incident_messages', {
      ...replying,
      reply: replyText,
      replied_at: new Date().toISOString()
    } as unknown as Record<string, unknown>);
    setReplying(null);
    setReplyText('');
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}><MessageSquare size={16} /> New Message</Button>
      </div>
      {messages.length === 0 ? (
        <EmptyState title="No incident messages" hint="Formal 213 message traffic between positions is logged here with replies." />
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card key={message.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">#{message.message_number ?? '—'}</span>
                    <Badge tone={statusTone(message.priority)}>{titleCase(message.priority)}</Badge>
                    <span className="text-xs text-slate-500">{fmtDateTime(message.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    <span className="font-medium text-slate-100">{message.from_name}</span>
                    {message.from_position && <span className="text-slate-400"> ({message.from_position})</span>}
                    <span className="text-slate-500"> → </span>
                    <span className="font-medium text-slate-100">{message.to_name}</span>
                    {message.to_position && <span className="text-slate-400"> ({message.to_position})</span>}
                  </p>
                  {message.subject && <p className="mt-1 text-sm font-semibold text-slate-200">{message.subject}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{message.body}</p>
                </div>
                {!message.reply && (
                  <Button size="sm" variant="ghost" onClick={() => setReplying(message)}><Reply size={14} /> Reply</Button>
                )}
              </div>
              {message.reply && (
                <div className="mt-3 rounded-lg border-l-4 border-brand-600 bg-slate-800 p-3">
                  <p className="text-xs text-slate-500">Reply · {fmtDateTime(message.replied_at)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{message.reply}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Incident Message (HICS 213)" wide>
        <form onSubmit={send} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="To (Name)" required>
            <Input value={draft.to_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, to_name: e.target.value }))} required />
          </Field>
          <Field label="To (Position)">
            <Input value={draft.to_position ?? ''} onChange={(e) => setDraft((d) => ({ ...d, to_position: e.target.value }))} />
          </Field>
          <Field label="From (Name)">
            <Input value={draft.from_name ?? profile?.full_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, from_name: e.target.value }))} />
          </Field>
          <Field label="From (Position)">
            <Input value={draft.from_position ?? ''} onChange={(e) => setDraft((d) => ({ ...d, from_position: e.target.value }))} />
          </Field>
          <Field label="Priority">
            <Select value={draft.priority ?? 'routine'} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as IncidentMessage['priority'] }))}>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="immediate">Immediate</option>
            </Select>
          </Field>
          <Field label="Subject">
            <Input value={draft.subject ?? ''} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
          </Field>
          <Field label="Message" required span={2}>
            <Textarea value={draft.body ?? ''} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} required />
          </Field>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Send Message</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(replying)} onClose={() => setReplying(null)} title={`Reply to #${replying?.message_number ?? ''}`}>
        <div className="space-y-4">
          <Field label="Reply" required>
            <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReplying(null)}>Cancel</Button>
            <Button onClick={() => void sendReply()} disabled={!replyText}>Send Reply</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ActivityLogPanel() {
  const { incident, currentPeriod } = useIncident();
  const { profile } = useAuth();
  const { rows: entries, reload } = useRecords<ActivityLogEntry>('activity_log_entries', {
    match: { incident_id: incident.id },
    orderBy: 'logged_at',
    ascending: false
  });
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<ActivityLogEntry>>({ section: 'Command' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await saveRecord('activity_log_entries', {
      ...draft,
      incident_id: incident.id,
      operational_period_id: currentPeriod?.id ?? null,
      logged_at: new Date().toISOString(),
      logged_by_name: profile?.full_name ?? '',
      created_by: profile?.id ?? null
    } as Record<string, unknown>);
    setShowNew(false);
    setDraft({ section: draft.section });
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}><Plus size={16} /> Log Entry</Button>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Activity log is empty" hint="The HICS 214 log is the chronological record of notable activities per section/position." />
      ) : (
        <DataTable head={['Time', 'Section / Position', 'Entry', 'Logged By']}>
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-slate-800/70">
              <td className="px-4 py-3 text-sm text-slate-400">{fmtDateTime(entry.logged_at)}</td>
              <td className="px-4 py-3 text-sm">{entry.section}{entry.position_title ? ` · ${entry.position_title}` : ''}</td>
              <td className="px-4 py-3 text-sm">{entry.entry}</td>
              <td className="px-4 py-3 text-sm text-slate-400">{entry.logged_by_name || '—'}</td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Activity Log Entry (HICS 214)">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Section">
              <Select value={draft.section ?? 'Command'} onChange={(e) => setDraft((d) => ({ ...d, section: e.target.value }))}>
                {['Command', 'Operations', 'Planning', 'Logistics', 'Finance/Admin'].map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Position">
              <Input value={draft.position_title ?? ''} onChange={(e) => setDraft((d) => ({ ...d, position_title: e.target.value }))} />
            </Field>
          </div>
          <Field label="Notable Activity" required>
            <Textarea value={draft.entry ?? ''} onChange={(e) => setDraft((d) => ({ ...d, entry: e.target.value }))} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit">Add to Log</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
