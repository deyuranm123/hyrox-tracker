'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { formatSeconds, LEGS } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';

export default function AthleteHome() {
  const { profile, loading } = useProfile('athlete');
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    const [{ data: s, error: sErr }, { data: r, error: rErr }] = await Promise.all([
      supabase
        .from('sessions')
        .select('id, session_date, type, total_time_sec, station_results(leg, time_sec)')
        .eq('athlete_id', profile.id)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('coach_athletes')
        .select('coach_id, status, profiles!coach_athletes_coach_id_fkey(name)')
        .eq('athlete_id', profile.id)
        .eq('status', 'pending'),
    ]);
    if (sErr || rErr) setError((sErr || rErr).message);
    setSessions(s || []);
    setRequests(r || []);
  }

  async function respond(coachId, accept) {
    if (accept) {
      await supabase
        .from('coach_athletes')
        .update({ status: 'accepted' })
        .eq('coach_id', coachId)
        .eq('athlete_id', profile.id);
    } else {
      await supabase
        .from('coach_athletes')
        .delete()
        .eq('coach_id', coachId)
        .eq('athlete_id', profile.id);
    }
    load();
  }

  async function deleteSession(id) {
    if (!confirm('Delete this session?')) return;
    await supabase.from('sessions').delete().eq('id', id);
    load();
  }

  if (loading) return <p>Loading…</p>;
  if (!profile) return <p className="error">Could not load your profile.</p>;

  return (
    <>
      <Header title={`Hi ${profile.name || 'athlete'}`} />

      {requests.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Coach requests</h2>
          {requests.map((r) => (
            <div key={r.coach_id} className="row" style={{ marginBottom: 8 }}>
              <span style={{ flex: 1 }}>{r.profiles?.name || 'A coach'} wants to see your sessions.</span>
              <button onClick={() => respond(r.coach_id, true)}>Accept</button>
              <button className="secondary" onClick={() => respond(r.coach_id, false)}>Decline</button>
            </div>
          ))}
        </div>
      )}

      <div className="card row">
        <Link href="/athlete/log" className="button">Log a session</Link>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>My sessions</h2>
        {error && <p className="error">{error}</p>}
        {sessions.length === 0 && <p className="muted">No sessions yet. Log your first one.</p>}
        {sessions.map((s) => (
          <details key={s.id}>
            <summary>
              {s.session_date} · {s.type} · total {formatSeconds(s.total_time_sec)}
            </summary>
            <table>
              <tbody>
                {LEGS.map((leg) => {
                  const r = s.station_results.find((x) => x.leg === leg.leg);
                  return (
                    <tr key={leg.leg}>
                      <td>{leg.label}</td>
                      <td>{formatSeconds(r?.time_sec)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button className="danger" style={{ marginTop: 8 }} onClick={() => deleteSession(s.id)}>
              Delete session
            </button>
          </details>
        ))}
      </div>
    </>
  );
}
