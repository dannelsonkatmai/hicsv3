import { useState, type FormEvent } from 'react';
import { TriangleAlert as AlertTriangle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button, Input, Field } from '../../components/ui';

type Mode = 'signin' | 'signup' | 'reset';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [ssoDomain, setSsoDomain] = useState('');
  const [showSso, setShowSso] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (err) throw err;
        setNotice('Account created. You are now signed in.');
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`
        });
        if (err) throw err;
        setNotice('Password reset email sent — check your inbox.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  // Enterprise SSO launch providers: Microsoft Entra ID + Google via OAuth,
  // Okta (and other SAML IdPs) via Supabase SSO domain lookup.
  const oauth = async (provider: 'azure' | 'google') => {
    setError('');
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    });
    if (err) setError(err.message);
  };

  const ssoByDomain = async () => {
    setError('');
    try {
      const { data, error: err } = await supabase.auth.signInWithSSO({ domain: ssoDomain });
      if (err) throw err;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO sign-in failed. Confirm your identity provider is configured.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-brand-600">
            <img src="/Essential_HICS-256.png" alt="Essential HICS" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Essential HICS</h1>
          <p className="mt-1 text-sm text-slate-400">Hospital Incident Command System</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-xs text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Supabase is not connected yet. Connect it from the integration panel (or set VITE_SUPABASE_URL /
            VITE_SUPABASE_ANON_KEY) and apply the migrations in supabase/migrations.
          </div>
        )}

        <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full Name" required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </Field>
            {mode !== 'reset' && (
              <Field label="Password" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </Field>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-400">{notice}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Working…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-700" /> or continue with <div className="h-px flex-1 bg-slate-700" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void oauth('azure')} type="button">Microsoft Entra ID</Button>
            <Button variant="secondary" onClick={() => void oauth('google')} type="button">Google</Button>
          </div>
          <Button variant="ghost" className="mt-2 w-full" type="button" onClick={() => setShowSso((s) => !s)}>
            Enterprise SSO (Okta / SAML)
          </Button>
          {showSso && (
            <div className="mt-2 flex gap-2">
              <Input placeholder="company-domain.com" value={ssoDomain} onChange={(e) => setSsoDomain(e.target.value)} />
              <Button variant="secondary" type="button" onClick={() => void ssoByDomain()}>Go</Button>
            </div>
          )}

          <div className="mt-5 flex justify-between text-xs text-slate-400">
            {mode !== 'signin' ? (
              <button className="hover:text-slate-200" onClick={() => setMode('signin')}>Back to sign in</button>
            ) : (
              <button className="hover:text-slate-200" onClick={() => setMode('signup')}>Create an account</button>
            )}
            {mode === 'signin' && (
              <button className="hover:text-slate-200" onClick={() => setMode('reset')}>Forgot password?</button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Aggregate-only situational data · No patient identifiers stored · Offline-capable PWA
        </p>
      </div>
    </div>
  );
}
