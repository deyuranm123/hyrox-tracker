'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import { formatSeconds, LEGS } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';
import { getCoachAthleteDetailData } from '../../../lib/data';

export default function AthleteDetail() {
  const { id: athleteId } = useParams();
  const { profile, loading: profileLoading } = useProfile('coach');
  const [data, setData] = useState({
    athlete: null,
    sessions: [],
    scorecard: [],
    runSplits: { runs: [], totalRunSec: 0, avgPaceSec: 0, formattedAvgPace: '—' },
    primaryWeakness: null,
    personalBest: null,
    formattedPersonalBest: '—',
    trend: [],
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile || !athleteId) return;
    loadAthleteDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, athleteId]);

  async function loadAthleteDetail() {
    try {
      setLoading(true);
      const res = await getCoachAthleteDetailData(athleteId);
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athlete performance detail.');
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading || (loading && !data.athlete)) {
    return <div className="container"><p className="muted">Loading Athlete Analytics…</p></div>;
  }
  if (!profile) return <div className="container"><p className="error">Could not load coach profile.</p></div>;

  const latestSession = data.sessions.filter((s) => s.total_time_sec != null)[0] || null;

  return (
    <div className="container">
      <Header title="Athlete Performance Command" role="coach" />

      <div style={{ marginBottom: 16 }}>
        <Link href="/coach" className="button secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          ← Back to Coach Roster
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {/* Athlete Header Card */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800 }}>
            {data.athlete?.full_name || data.athlete?.email || 'Athlete'}
          </h1>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{data.athlete?.email}</div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <span className="kpi-label">Personal Best</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-hyrox)', fontFeatureSettings: '"tnum"' }}>
              {data.formattedPersonalBest}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="kpi-label">Total Completed</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal-primary)' }}>
              {data.totalCompleted}
            </div>
          </div>
        </div>
      </div>

      {/* 8-Station Performance Scorecard */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            HYROX 8-Station Performance Scorecard
          </h2>
          {latestSession && (
            <span className="badge badge-active">
              Simulation: {latestSession.session_date}
            </span>
          )}
        </div>
        <p className="muted" style={{ margin: '0 0 16px', fontSize: '0.82rem' }}>
          Compromised station timings compared against previous benchmark simulation.
        </p>

        {!latestSession ? (
          <p className="muted">No simulation sessions logged by athlete yet.</p>
        ) : (
          <>
            <div className="scorecard-grid">
              {data.scorecard.map((st) => (
                <div key={st.id} className="scorecard-item">
                  <div className="scorecard-station">{st.name}</div>
                  <div className="scorecard-time">{st.formattedTime}</div>
                  <div className="scorecard-delta">
                    {st.deltaSec != null ? (
                      <span className={st.isImproved ? 'delta-pos' : 'delta-neg'}>
                        {st.deltaFormatted} {st.isImproved ? 'faster' : 'slower'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-subtle)' }}>No prior benchmark</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Run Compromise Summary */}
            <div style={{ background: 'var(--bg-navy)', padding: '14px 18px', borderRadius: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="kpi-label">Running Engine Average</span>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--teal-primary)' }}>
                  {data.runSplits.formattedAvgPace}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total 8km Run Time: {formatSeconds(data.runSplits.totalRunSec)}
                </div>
              </div>

              {data.primaryWeakness && (
                <div style={{ textAlign: 'right' }}>
                  <span className="kpi-label" style={{ color: 'var(--gold-hyrox)' }}>Primary Focus Area</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {data.primaryWeakness.name} ({data.primaryWeakness.formattedTime})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                    Highest time drain under fatigue
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Progression Trend Table */}
      <div className="card">
        <h2 className="card-title">Progression Trend (Last {data.trend.length} Simulations)</h2>
        {data.trend.length === 0 ? (
          <p className="muted">No simulation trend data available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Total Time</th>
                  <th>Performance Delta</th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((s, i) => {
                  const prev = data.trend[i - 1];
                  let change = '—';
                  let isFaster = false;
                  if (prev) {
                    const diff = s.total_time_sec - prev.total_time_sec;
                    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
                    change = `${sign}${formatSeconds(Math.abs(diff))}`;
                    isFaster = diff < 0;
                  }
                  return (
                    <tr key={s.id}>
                      <td>{s.session_date}</td>
                      <td><span className="badge badge-active">{s.category || s.type || 'Simulation'}</span></td>
                      <td style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                        {formatSeconds(s.total_time_sec)}
                      </td>
                      <td>
                        {i === 0 ? (
                          <span className="muted">Baseline</span>
                        ) : (
                          <span className={isFaster ? 'delta-pos' : 'delta-neg'}>{change}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complete Session Drill-Down */}
      <div className="card">
        <h2 className="card-title">Complete 16-Leg Workout Logs</h2>
        {data.sessions.length === 0 && <p className="muted">No logs recorded yet.</p>}
        {data.sessions.map((s) => (
          <details key={s.id}>
            <summary>
              <span>{s.session_date} · {s.category || s.type || 'Training'}</span>
              <span style={{ color: 'var(--teal-primary)', fontWeight: 700 }}>
                {formatSeconds(s.total_time_sec)}
              </span>
            </summary>
            <table>
              <thead>
                <tr>
                  <th>Leg #</th>
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
          </details>
        ))}
      </div>
    </div>
  );
}
