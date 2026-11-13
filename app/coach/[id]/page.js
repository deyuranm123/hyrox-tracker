'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '../../../components/Header';
import { supabase } from '../../../lib/supabase';
import { formatSeconds, LEGS } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';

export default function AthleteDetail() {
  const { id: athleteId } = useParams();
  const { profile, loading } = useProfile('coach');
  const [athlete, setAthlete] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: a }, { data: s, error: sErr }] = await Promise.all([
        supabase.from('profiles').select('name, email').eq('id', athleteId).single(),
        supabase
          .from('sessions')
          .select('id, session_date, type, total_time_sec, station_results(leg, time_sec)')
          .eq('athlete_id', athleteId)
          .order('session_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);
      if (sErr) setError(sErr.message);
      setAthlete(a);
      setSessions(s || []);
    })();
  }, [profile, athleteId]);

  if (loading) return <p>Loading…</p>;
  if (!profile) return <p className="error">Could not load your profile.</p>;

  // Trend: totals for the most recent five sessions, oldest first.
  const trend = sessions
    .filter((s) => s.total_time_sec != null)
    .slice(0, 5)
    .reverse();

  return (
    <>
      <Header title={athlete?.name || athlete?.email || 'Athlete'} />
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Last {trend.length} totals</h2>
        {trend.length === 0 && <p className="muted">No sessions yet.</p>}
        {trend.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Total</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((s, i) => {
                const prev = trend[i - 1];
                let change = '—';
                if (prev) {
                  const diff = s.total_time_sec - prev.total_time_sec;
                  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
                  change = `${sign}${formatSeconds(Math.abs(diff))}`;
                }
                return (
                  <tr key={s.id}>
                    <td>{s.session_date}</td>
                    <td>{formatSeconds(s.total_time_sec)}</td>
                    <td>{change}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>All sessions</h2>
        {sessions.length === 0 && <p className="muted">Nothing logged yet.</p>}
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
          </details>
        ))}
      </div>
    </>
  );
}
