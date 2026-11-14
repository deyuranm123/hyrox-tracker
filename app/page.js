'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('athlete'); // default athlete for high adoption
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) await routeByRole(data.session.user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function routeByRole(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    router.replace(data?.role === 'coach' ? '/coach' : '/athlete');
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);

    if (mode === 'signup') {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, full_name: name, name } },
      });
      setBusy(false);
      if (signUpErr) return setError(signUpErr.message);

      if (!data.session) {
        return setInfo("Click the link in your email. You'll land back here signed in.");
      }
      await routeByRole(data.user.id);
      return;
    }

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInErr) return setError(signInErr.message);
    await routeByRole(data.user.id);
  }

  return (
    <div className="card" style={{ maxWidth: 440, margin: '60px auto 40px', padding: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="brand-badge" style={{ fontSize: '1.05rem', padding: '3px 9px' }}>RŌX</span>
          <span style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '0.08em' }}>COACH</span>
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '8px 0 4px', color: 'var(--text-primary)' }}>
          Log every split. Know where you lose time.
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          The HYROX Coaching & Pacing Operating System
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg-navy)', padding: '4px', borderRadius: '8px' }}>
        <button
          type="button"
          onClick={() => { setMode('login'); setError(''); setInfo(''); }}
          style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
          className={mode === 'login' ? '' : 'secondary'}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(''); setInfo(''); }}
          style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
          className={mode === 'signup' ? '' : 'secondary'}
        >
          Create Account
        </button>
      </div>

      <form onSubmit={submit} className="form-grid" style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
        {mode === 'signup' && (
          <>
            <label>
              Full Name
              <input
                type="text"
                placeholder="e.g. Lauren Weeks or Hunter McIntyre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <div>
              <span className="kpi-label" style={{ display: 'block', marginBottom: 6 }}>I am a</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setRole('athlete')}
                  className={role === 'athlete' ? '' : 'secondary'}
                  style={{ padding: '10px 8px', fontSize: '0.85rem', width: '100%' }}
                >
                  I&apos;m an Athlete
                </button>
                <button
                  type="button"
                  onClick={() => setRole('coach')}
                  className={role === 'coach' ? '' : 'secondary'}
                  style={{ padding: '10px 8px', fontSize: '0.85rem', width: '100%' }}
                >
                  I&apos;m a Coach
                </button>
              </div>
            </div>
          </>
        )}

        <label>
          Email Address
          <input
            type="email"
            placeholder="athlete@gym.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button type="submit" disabled={busy} style={{ width: '100%', marginTop: '6px' }}>
          {busy ? 'Processing…' : mode === 'login' ? 'Access Workspace' : 'Create Free Account'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {info && <p className="muted" style={{ textAlign: 'center', marginTop: '14px', color: 'var(--teal-primary)' }}>{info}</p>}

      <div style={{ marginTop: 20, textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
          🔒 Your sessions are private. Only coaches you accept can see them.
        </p>
      </div>
    </div>
  );
}
