'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { formatSeconds } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';

export default function CoachRoster() {
  const { profile, loading } = useProfile('coach');
  const [roster, setRoster] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    const { data: links, error } = await supabase
      .from('coach_athletes')
      .select('athlete_id, status, profiles!coach_athletes_athlete_id_fkey(full_name, email)')
      .eq('coach_id', profile.id);
    if (error) return setError(error.message);

    // Only accepted athletes return sessions (RLS), so pending ones show no last session.
    const accepted = (links || []).filter((l) => l.status === 'accepted').map((l) => l.athlete_id);
    let lastByAthlete = {};
    if (accepted.length > 0) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('athlete_id, session_date, total_time_sec')
        .in('athlete_id', accepted)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });
      for (const s of sessions || []) {
        if (!lastByAthlete[s.athlete_id]) lastByAthlete[s.athlete_id] = s;
      }
    }

    setRoster((links || []).map((l) => ({ ...l, last: lastByAthlete[l.athlete_id] || null })));
  }

  async function addAthlete(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    const { data, error } = await supabase.rpc('request_athlete', { p_email: email });
    if (error) return setError(error.message);

    const messages = {
      requested: 'Request sent. The athlete needs to accept it before you can see their sessions.',
      not_found: 'No athlete account uses that email.',
      not_allowed: 'Only coaches can send requests.',
    };
    setMessage(messages[data] || 'Done.');
    if (data === 'requested') setEmail('');
    load();
  }

  async function removeLink(athleteId) {
    if (!confirm('Remove this athlete from your roster?')) return;
    await supabase
      .from('coach_athletes')
      .delete()
      .eq('coach_id', profile.id)
      .eq('athlete_id', athleteId);
    load();
  }

  if (loading) return <p>Loading…</p>;
  if (!profile) return <p className="error">Could not load your profile.</p>;

  return (
    <>
      <Header title={`Coach ${profile.full_name || ''}`.trim()} />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Add an athlete</h2>
        <form onSubmit={addAthlete} className="row">
          <input
            type="email"
            placeholder="athlete@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ flex: 1, minWidth: 220 }}
          />
          <button type="submit">Send request</button>
        </form>
        {message && <p className="muted">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>My athletes</h2>
        {roster.length === 0 && <p className="muted">No athletes yet.</p>}
        {roster.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Status</th>
                <th>Last session</th>
                <th>Last total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roster.map((row) => {
                const last = row.last;
                return (
                  <tr key={row.athlete_id}>
                    <td>
                      {row.status === 'accepted' ? (
                        <Link href={`/coach/${row.athlete_id}`}>
                          {row.profiles?.full_name || row.profiles?.email}
                        </Link>
                      ) : (
                        row.profiles?.full_name || row.profiles?.email
                      )}
                    </td>
                    <td>{row.status === 'accepted' ? 'Active' : 'Waiting for athlete'}</td>
                    <td>{last?.session_date || '—'}</td>
                    <td>{formatSeconds(last?.total_time_sec)}</td>
                    <td>
                      <button className="secondary" onClick={() => removeLink(row.athlete_id)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
