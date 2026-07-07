// Fan out a queued notification to its audience through the vendor-agnostic
// provider layer, recording per-recipient delivery status.
//
// Secrets required: RESEND_API_KEY, NOTIFY_FROM_EMAIL (for the email channel).
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getProvider, type NotificationRecipient } from '../_shared/notification-providers.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface NotificationRow {
  id: string;
  tenant_id: string;
  incident_id: string | null;
  subject: string;
  body: string;
  channel: 'email' | 'sms' | 'paging' | 'all';
  audience: 'all_staff' | 'himt' | 'section' | 'custom';
  audience_filter: Record<string, unknown>;
}

async function resolveRecipients(notification: NotificationRow, channel: 'email' | 'sms' | 'paging'): Promise<NotificationRecipient[]> {
  const addressField = channel === 'email' ? 'email' : channel === 'sms' ? 'phone' : 'pager';

  if (notification.audience === 'custom') {
    const raw = String(notification.audience_filter?.recipients ?? '');
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((address) => ({ name: address, address }));
  }

  if (notification.audience === 'himt' && notification.incident_id) {
    const { data: assignments } = await supabase
      .from('himt_assignments')
      .select('assignee_name, personnel_id')
      .eq('incident_id', notification.incident_id)
      .is('released_at', null);
    const personnelIds = (assignments ?? []).map((a) => a.personnel_id).filter(Boolean);
    if (!personnelIds.length) return [];
    const { data: people } = await supabase
      .from('personnel')
      .select(`full_name, ${addressField}`)
      .in('id', personnelIds);
    return (people ?? [])
      .map((p) => ({ name: p.full_name as string, address: String((p as Record<string, unknown>)[addressField] ?? '') }))
      .filter((r) => r.address);
  }

  // all_staff / section → personnel directory for the tenant
  let query = supabase
    .from('personnel')
    .select(`full_name, department, ${addressField}`)
    .eq('tenant_id', notification.tenant_id)
    .eq('is_active', true);
  const section = String(notification.audience_filter?.section ?? '');
  if (notification.audience === 'section' && section) {
    query = query.ilike('department', `%${section}%`);
  }
  const { data: people } = await query;
  return (people ?? [])
    .map((p) => ({ name: p.full_name as string, address: String((p as Record<string, unknown>)[addressField] ?? '') }))
    .filter((r) => r.address);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { notification_id } = await req.json();
    if (!notification_id) return corsResponse({ error: 'notification_id is required' }, 400);

    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notification_id)
      .maybeSingle();
    if (error || !notification) return corsResponse({ error: 'Notification not found' }, 404);

    await supabase.from('notifications').update({ status: 'sending' }).eq('id', notification_id);

    const channels: Array<'email' | 'sms' | 'paging'> =
      notification.channel === 'all' ? ['email', 'sms', 'paging'] : [notification.channel];

    let sent = 0;
    let failed = 0;

    for (const channel of channels) {
      const provider = getProvider(channel);
      const recipients = await resolveRecipients(notification as NotificationRow, channel);

      for (const recipient of recipients) {
        const result = await provider.send(recipient, notification.subject, notification.body);
        result.ok ? sent++ : failed++;
        await supabase.from('notification_deliveries').insert({
          tenant_id: notification.tenant_id,
          notification_id,
          recipient_name: recipient.name,
          recipient_address: recipient.address,
          channel,
          provider: result.provider,
          status: result.ok ? 'sent' : 'failed',
          error: result.error ?? '',
          delivered_at: result.ok ? new Date().toISOString() : null
        });
      }
    }

    await supabase
      .from('notifications')
      .update({ status: failed > 0 && sent === 0 ? 'failed' : 'sent', sent_at: new Date().toISOString() })
      .eq('id', notification_id);

    return corsResponse({ sent, failed });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
