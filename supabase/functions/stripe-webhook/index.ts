// Stripe webhook → tenant entitlement sync.
// Verifies the webhook signature (HMAC-SHA256 via Web Crypto), then mirrors
// subscription state onto the organization row, which gates feature access.
//
// Secrets required: STRIPE_WEBHOOK_SECRET
// Configure the endpoint in Stripe for:
//   checkout.session.completed, customer.subscription.updated,
//   customer.subscription.deleted

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === signature;
}

function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return stripeStatus;
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'unpaid';
  }
}

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.text();
    const signatureHeader = req.headers.get('stripe-signature') ?? '';
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

    if (!secret || !(await verifySignature(payload, signatureHeader, secret))) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }

    const event = JSON.parse(payload);
    const object = event.data?.object ?? {};

    if (event.type === 'checkout.session.completed') {
      const tenantId = object.metadata?.tenant_id;
      const plan = object.metadata?.plan;
      if (tenantId) {
        await supabase
          .from('organizations')
          .update({
            subscription_status: 'active',
            plan: plan ?? 'standard',
            stripe_customer_id: object.customer ?? null,
            stripe_subscription_id: object.subscription ?? null
          })
          .eq('id', tenantId);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const tenantId = object.metadata?.tenant_id;
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(String(object.status ?? ''));
      const update = { subscription_status: status };
      if (tenantId) {
        await supabase.from('organizations').update(update).eq('id', tenantId);
      } else if (object.customer) {
        await supabase.from('organizations').update(update).eq('stripe_customer_id', object.customer);
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), { status: 500 });
  }
});
