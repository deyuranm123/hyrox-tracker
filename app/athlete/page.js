'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { formatSeconds, LEGS } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';
import { computeRunSplits } from '../../lib/performance';

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
        .select('coach_id, status, profiles!coach_athletes_coach_id_fkey(full_name, email)')
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
    if (!confirm('Permanently delete this workout log?')) return;
    await supabase.from('sessions').delete().eq('id', id);
    load();
  }

  if (loading) return <div className="container"><p className="muted">Loading Athlete Portal…</p></div>;
  if (!profile) return <div className="container"><p className="error">Could not load athlete profile.</p></div>;

  const validSessions = sessions.filter((s) => s.total_time_sec != null);
  const personalBest = validSessions.length > 0
    ? Math.min(...validSessions.map((s) => s.total_time_sec))
    : null;

  return (
    <div className="container">
      <Header title={`Athlete: ${profile.full_name || 'Competitor'}`} role="athlete" />

      {/* Pending Coach Connection Banner */}
      {requests.length > 0 && (
        <div className="attention-card" style={{ borderColor: 'var(--teal-primary)', background: 'linear-gradient(180deg, rgba(25, 182, 160, 0.1) 0%, rgba(23, 38, 59, 1) 100%)' }}>
          <div className="attention-header">
            <span className="card-title" style={{ margin: 0, color: 'var(--teal-primary)' }}>
              Incoming Coach Connection Request
            </span>
            <span className="badge badge-active">{requests.length} Pending</span>
          </div>
          {requests.map((r) => (
            <div key={r.coach_id} className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-card)', borderRadius: 8 }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Coach {r.profiles?.full_name || r.profiles?.email}
                </span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Wants to analyze your split times, station metrics, and race simulations.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => respond(r.coach_id, true)} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                  Accept Coach
                </button>
                <button className="secondary" onClick={() => respond(r.coach_id, false)} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Athlete Performance Quick Ribbon */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Personal Best</span>
          <span className="kpi-value" style={{ color: 'var(--gold-hyrox)' }}>
            {formatSeconds(personalBest)}
          </span>
          <span className="kpi-sub">Full 16-Leg Simulation</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Completed Simulations</span>
          <span className="kpi-value">{validSessions.length}</span>
          <span className="kpi-sub">Logged in training engine</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Connected Coach</span>
          <span className="kpi-value" style={{ color: 'var(--teal-primary)' }}>
            Active
          </span>
          <span className="kpi-sub">Live Roster Shared</span>
        </div>
      </div>

      {/* Log Action Button */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Ready for your next HYROX simulation?</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Record split times across all 8 runs and 8 workout stations.
          </div>
        </div>
        <Link href="/athlete/log" className="button" style={{ padding: '12px 22px' }}>
          + Log New Workout (&lt; 60s)
        </Link>
      </div>

      {/* Past Workout Sessions List */}
      <div className="card">
        <h2 className="card-title">My Training History</h2>
        {error && <p className="error">{error}</p>}
        {sessions.length === 0 ? (
          <p className="muted">No simulation sessions logged yet. Log your first workout above.</p>
        ) : (
          sessions.map((s) => {
            const runSplits = computeRunSplits(s);
            return (
              <details key={s.id}>
                <summary>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 10 }}>
                      {s.session_date}
                    </span>
                    <span className="badge badge-active">{s.type || 'Simulation'}</span>
                    <span style={{ marginLeft: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Pace: {runSplits.formattedAvgPace}
                    </span>
                  </div>
                  <span style={{ color: 'var(--teal-primary)', fontWeight: 800, fontFeatureSettings: '"tnum"' }}>
                    {formatSeconds(s.total_time_sec)}
                  </span>
                </summary>
                <div style={{ padding: '14px 16px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Leg</th>
                        <th>Station</th>
                        <th style={{ textAlign: 'right' }}>Split Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LEGS.map((leg) => {
                        const r = s.station_results.find((x) => x.leg === leg.leg);
                        return (
                          <tr key={leg.leg}>
                            <td style={{ width: 40, color: 'var(--text-subtle)' }}>#{leg.leg}</td>
                            <td>
                              <span style={{ fontWeight: leg.isRun ? 500 : 700, color: leg.isRun ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                {leg.label}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontFeatureSettings: '"tnum"' }}>
                              {formatSeconds(r?.time_sec)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="secondary danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => deleteSession(s.id)}>
                      Delete Log
                    </button>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
