import { useState, type FormEvent } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConnectivity } from '../contexts/ConnectivityContext';
import { useRecords } from '../hooks/useRecords';
import { saveRecord } from '../lib/repo';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '../components/ui';
import { fmtDateTime, titleCase } from '../lib/utils';
import type { AppNotification, NotificationDelivery } from '../types/domain';

// Notification composer (spec §3.7): channel + audience selection with
// delivery tracking. Sending fans out through the vendor-agnostic
// `send-notification` edge function (email live; SMS/paging adapters are
// pluggable stubs — see supabase/functions/send-notification).

export function NotificationsPage() {
  const { profile, can } = useAuth();
  const { online } = useConnectivity();
  const { rows: notifications, reload } = useRecords<AppNotification>('notifications', { orderBy: 'created_at', ascending: false });
  const { rows: deliveries } = useRecords<NotificationDelivery>('notification_deliveries', {});

  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Partial<AppNotification>>({ channel: 'email', audience: 'all_staff' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const notification = await saveRecord('notifications', {
        ...draft,
        status: 'queued',
        sent_by: profile?.id ?? null
      } as Record<string, unknown>);
      logAudit('notification.queued', 'notification', String(notification.id), { audience: draft.audience, channel: draft.channel });

      if (online) {
        const { error: fnError } = await supabase.functions.invoke('send-notification', {
          body: { notification_id: notification.id }
        });
        if (fnError) {
          setError(`Queued, but sending failed: ${fnError.message}. It can be retried once the edge function is deployed/configured.`);
        }
      } else {
        setError('Offline — the notification is queued and can be sent when connectivity returns.');
      }
      setShowNew(false);
      setDraft({ channel: 'email', audience: 'all_staff' });
      await reload();
    } finally {
      setSending(false);
    }
  };

  const deliveriesFor = (id: string) => deliveries.filter((d) => d.notification_id === id);

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Activation alerts, role callbacks, and SitRep distribution — email live, SMS/paging via pluggable adapters"
        actions={can('send_mass_notification') && (
          <Button onClick={() => setShowNew(true)}><Megaphone size={16} /> Compose</Button>
        )}
      />

      {notifications.length === 0 ? (
        <EmptyState title="No notifications sent" hint="Compose activation alerts and callbacks; delivery and acknowledgement are tracked per recipient." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const dels = deliveriesFor(notification.id);
            return (
              <Card
                key={notification.id}
                title={notification.subject || '(no subject)'}
                subtitle={`${titleCase(notification.audience)} · ${notification.channel.toUpperCase()} · ${fmtDateTime(notification.created_at)}`}
                actions={<Badge tone={statusTone(notification.status)}>{titleCase(notification.status)}</Badge>}
              >
                <p className="text-sm text-slate-300">{notification.body}</p>
                {dels.length > 0 && (
                  <div className="mt-3 border-t border-slate-700/60 pt-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Deliveries ({dels.filter((d) => ['delivered', 'read', 'acknowledged', 'sent'].includes(d.status)).length}/{dels.length})
                    </p>
                    <DataTable head={['Recipient', 'Channel', 'Status']}>
                      {dels.slice(0, 25).map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-2 text-sm">{d.recipient_name || d.recipient_address}</td>
                          <td className="px-4 py-2 text-sm">{d.channel}</td>
                          <td className="px-4 py-2"><Badge tone={statusTone(d.status)}>{titleCase(d.status)}</Badge></td>
                        </tr>
                      ))}
                    </DataTable>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Compose Notification" wide>
        <form onSubmit={send} className="space-y-4">
          {error && <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Channel">
              <Select value={draft.channel ?? 'email'} onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as AppNotification['channel'] }))}>
                <option value="email">Email</option>
                <option value="sms">SMS (adapter required)</option>
                <option value="paging">Paging (adapter required)</option>
                <option value="all">All channels</option>
              </Select>
            </Field>
            <Field label="Audience">
              <Select value={draft.audience ?? 'all_staff'} onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value as AppNotification['audience'] }))}>
                <option value="all_staff">All active staff</option>
                <option value="himt">Current HIMT members</option>
                <option value="section">Section (set filter below)</option>
                <option value="custom">Custom list</option>
              </Select>
            </Field>
          </div>
          {draft.audience === 'section' && (
            <Field label="Section">
              <Select
                value={String((draft.audience_filter as Record<string, unknown>)?.section ?? 'operations')}
                onChange={(e) => setDraft((d) => ({ ...d, audience_filter: { section: e.target.value } }))}
              >
                {['command', 'operations', 'planning', 'logistics', 'finance'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
              </Select>
            </Field>
          )}
          {draft.audience === 'custom' && (
            <Field label="Recipients (comma-separated emails/phones)">
              <Input
                value={String((draft.audience_filter as Record<string, unknown>)?.recipients ?? '')}
                onChange={(e) => setDraft((d) => ({ ...d, audience_filter: { recipients: e.target.value } }))}
                placeholder="a@hospital.org, b@hospital.org"
              />
            </Field>
          )}
          <Field label="Subject" required>
            <Input value={draft.subject ?? ''} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} required />
          </Field>
          <Field label="Message" required>
            <Textarea value={draft.body ?? ''} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit" disabled={sending}><Send size={15} /> {sending ? 'Sending…' : 'Send'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
