// Open the Stripe customer portal (invoices, payment methods, cancellation)
// for the caller's organization.
//
// Secrets required: STRIPE_SECRET_KEY

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return corsResponse({ error: 'Unauthorized' }, 401);

    const { return_url } = await req.json();

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', userData.user.id).maybeSingle();
    const { data: org } = await supabase.from('organizations').select('stripe_customer_id').eq('id', profile?.tenant_id ?? '').maybeSingle();
    if (!org?.stripe_customer_id) {
      return corsResponse({ error: 'No Stripe customer yet — select a plan first.' }, 400);
    }

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY') ?? ''}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        customer: org.stripe_customer_id,
        return_url: return_url ?? 'https://example.com'
      }).toString()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message ?? `Stripe error ${response.status}`);

    return corsResponse({ url: data.url });
  } catch (err) {
    return corsResponse({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
