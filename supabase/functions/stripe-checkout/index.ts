// Create a Stripe Checkout session for a subscription plan.
// Uses Stripe's REST API directly (no SDK dependency).
//
// Secrets required:
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_STANDARD, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE
//     (Stripe Price IDs for each plan)

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function stripeRequest(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY') ?? ''}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params).toString()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? `Stripe error ${response.status}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return corsResponse({ error: 'Unauthorized' }, 401);

    const { plan, return_url } = await req.json();
    const priceId = Deno.env.get(`STRIPE_PRICE_${String(plan ?? '').toUpperCase()}`) ?? '';
    if (!priceId) return corsResponse({ error: `No Stripe price configured for plan "${plan}"` }, 400);

    const { data: profile } = await supabase.from('profiles').select('tenant_id, email').eq('id', userData.user.id).maybeSingle();
    if (!profile?.tenant_id) return corsResponse({ error: 'User has no organization' }, 400);

    const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.tenant_id).maybeSingle();
    if (!org) return corsResponse({ error: 'Organization not found' }, 404);

    // Reuse or create the Stripe customer for this tenant.
    let customerId = org.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripeRequest('customers', {
        name: org.name,
        email: profile.email ?? userData.user.email ?? '',
        'metadata[tenant_id]': org.id
      });
      customerId = String(customer.id);
      await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id);
    }

    const session = await stripeRequest('checkout/sessions', {
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: return_url ?? 'https://example.com',
      cancel_url: return_url ?? 'https://example.com',
      'subscription_data[metadata][tenant_id]': org.id,
      'metadata[tenant_id]': org.id,
      'metadata[plan]': String(plan)
    });

    return corsResponse({ url: session.url });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
