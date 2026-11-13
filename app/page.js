'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('athlete');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  // If already signed in, go to the right home page.
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role, name } },
      });
      setBusy(false);
      if (error) return setError(error.message);
      if (!data.session) {
        return setInfo('Check your email to confirm your account, then sign in.');
      }
      await routeByRole(data.user.id);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    await routeByRole(data.user.id);
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h1 style={{ marginTop: 0 }}>Hyrox Tracker</h1>
      <p className="muted">Athletes log sessions. Coaches see their athletes.</p>

      <form onSubmit={submit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        {mode === 'signup' && (
          <>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              I am a
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
              </select>
            </label>
          </>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {info && <p className="muted">{info}</p>}

      <p className="muted">
        {mode === 'login' ? 'New here? ' : 'Already have an account? '}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
            setInfo('');
          }}
        >
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </button>
      </p>
    </div>
  );
}
