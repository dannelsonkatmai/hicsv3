import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Badge, Button, Card, PageHeader } from '../../components/ui';
import { titleCase } from '../../lib/utils';

// Stripe subscription management (spec §12.8). Checkout and the customer
// portal are created by edge functions (stripe-checkout / stripe-portal);
// the stripe-webhook function syncs subscription state back onto the
// organization row, which gates entitlements.

const PLANS = [
  {
    key: 'standard',
    name: 'Standard',
    price: '$299/mo',
    blurb: 'Single facility (~100 beds): incidents, IAP builder, forms engine, status boards, 25 seats.'
  },
  {
    key: 'professional',
    name: 'Professional',
    price: '$599/mo',
    blurb: 'Adds preparedness & compliance program, notifications, reports, 75 seats.'
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Contact us',
    blurb: 'Multi-facility health systems, SSO/SAML, unlimited seats, priority support.'
  }
];

export function BillingPage() {
  const { organization } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const checkout = async (plan: string) => {
    setBusy(plan);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout', {
        body: { plan, return_url: window.location.href }
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(
        `Could not start checkout: ${err instanceof Error ? err.message : 'unknown error'}. ` +
          'Deploy the stripe-checkout edge function and set STRIPE_SECRET_KEY (plus price IDs) in function secrets.'
      );
    } finally {
      setBusy('');
    }
  };

  const portal = async () => {
    setBusy('portal');
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-portal', {
        body: { return_url: window.location.href }
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(`Could not open the customer portal: ${err instanceof Error ? err.message : 'unknown error'}.`);
    } finally {
      setBusy('');
    }
  };

  const status = organization?.subscription_status ?? 'trialing';
  const healthy = status === 'active' || status === 'trialing';

  return (
    <div className="max-w-4xl">
      <PageHeader title="Billing & Subscription" subtitle="Stripe-backed plans, seats, and invoices" />

      {error && <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">{error}</p>}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <CreditCard size={18} className="text-brand-400" />
            <span>Current plan:</span>
            <Badge tone="blue">{titleCase(organization?.plan ?? 'trial')}</Badge>
            <Badge tone={healthy ? 'green' : 'red'}>{titleCase(status)}</Badge>
            <span>{organization?.seats ?? 0} seats</span>
          </div>
          <Button variant="secondary" onClick={() => void portal()} disabled={busy === 'portal'}>
            <ExternalLink size={15} /> Customer Portal (invoices, payment method)
          </Button>
        </div>
        {!healthy && (
          <p className="mt-3 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            The subscription is {titleCase(status).toLowerCase()} — feature access may be limited until billing is resolved.
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.key} title={plan.name} subtitle={plan.price}>
            <p className="mb-4 min-h-[72px] text-sm text-slate-400">{plan.blurb}</p>
            <Button
              className="w-full"
              variant={organization?.plan === plan.key ? 'secondary' : 'primary'}
              disabled={busy === plan.key || organization?.plan === plan.key}
              onClick={() => void checkout(plan.key)}
            >
              {organization?.plan === plan.key ? 'Current Plan' : busy === plan.key ? 'Opening checkout…' : plan.key === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Webhooks (checkout.session.completed, customer.subscription.updated/deleted) sync subscription status to the
        organization record via the stripe-webhook edge function, which gates entitlements across the app.
      </p>
    </div>
  );
}
