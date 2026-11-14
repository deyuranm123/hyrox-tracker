'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { formatSeconds, LEGS } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';
import { computeRunSplits } from '../../lib/performance';
import { getAthleteDashboardData, respondToCoachRequest, deleteWorkoutSession } from '../../lib/data';

function AthleteDashboardContent() {
  const searchParams = useSearchParams();
  const savedSuccess = searchParams.get('saved');
  const savedTotal = searchParams.get('total');

  const { profile, loading: profileLoading } = useProfile('athlete');
  const [data, setData] = useState({
    sessions: [],
    requests: [],
    trend: [],
    personalBest: null,
    formattedPersonalBest: '—',
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSavedBanner, setShowSavedBanner] = useState(Boolean(savedSuccess));

  useEffect(() => {
    if (!profile) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await getAthleteDashboardData(profile.id);
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athlete dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleCoachResponse(coachId, accept) {
    try {
      await respondToCoachRequest({ coachId, athleteId: profile.id, accept });
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to coach request.');
    }
  }

  async function handleDeleteSession(id) {
    if (!confirm('Permanently delete this workout log?')) return;
    try {
      await deleteWorkoutSession(id);
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workout session.');
    }
  }

  if (profileLoading || (loading && !data.sessions.length)) {
    return <div className="container"><p className="muted">Loading Athlete Portal…</p></div>;
  }
  if (!profile) return <div className="container"><p className="error">Could not load athlete profile.</p></div>;

  return (
    <div className="container">
      <Header title={`Athlete: ${profile.full_name || 'Competitor'}`} role="athlete" />

      {/* Success Banner After Saving a Workout */}
      {showSavedBanner && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(23, 38, 59, 1) 100%)',
            borderColor: 'var(--success-emerald)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: 'var(--success-emerald)', fontSize: '1.05rem' }}>
              ✓ Workout Saved Successfully
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: 2 }}>
              Total Time: <strong>{savedTotal || 'Recorded'}</strong>. Added to your progression trend.
            </div>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowSavedBanner(false)}
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Pending Coach Connection Banner */}
      {data.requests.length > 0 && (
        <div className="attention-card" style={{ borderColor: 'var(--teal-primary)', background: 'linear-gradient(180deg, rgba(25, 182, 160, 0.1) 0%, rgba(23, 38, 59, 1) 100%)' }}>
          <div className="attention-header">
            <span className="card-title" style={{ margin: 0, color: 'var(--teal-primary)' }}>
              Incoming Coach Connection Request
            </span>
            <span className="badge badge-active">{data.requests.length} Pending</span>
          </div>
          {data.requests.map((r) => (
            <div key={r.coach_id} className="row" style={{ justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface-card)', borderRadius: 8, marginTop: 8 }}>
              <div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  Coach {r.profiles?.full_name || r.profiles?.email}
                </span>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Wants to analyze your split times, station metrics, and race simulations.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleCoachResponse(r.coach_id, true)} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                  Accept Coach
                </button>
                <button className="secondary" onClick={() => handleCoachResponse(r.coach_id, false)} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
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
            {data.formattedPersonalBest}
          </span>
          <span className="kpi-sub">Full 16-Leg Simulation</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Completed Simulations</span>
          <span className="kpi-value">{data.totalCompleted}</span>
          <span className="kpi-sub">Logged in training engine</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Privacy Guarantee</span>
          <span className="kpi-value" style={{ color: 'var(--teal-primary)', fontSize: '1.25rem' }}>
            Private
          </span>
          <span className="kpi-sub">Only accepted coaches can view splits</span>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Log a Training or Race Simulation</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Auto-formatted mobile input with live elapsed pace summation.
          </div>
        </div>
        <Link href="/athlete/log" className="button" style={{ padding: '12px 22px' }}>
          + Log New Workout (&lt; 60s)
        </Link>
      </div>

      {/* Athlete's Own Last-5 Progression Trend Table */}
      {data.trend.length > 0 && (
        <div className="card">
          <h2 className="card-title">My Recent Performance Trend (Last {data.trend.length} Simulations)</h2>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Total Time</th>
                  <th>Change vs Prior</th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((s) => (
                  <tr key={s.id}>
                    <td>{s.session_date}</td>
                    <td><span className="badge badge-active">{s.category}</span></td>
                    <td style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                      {s.formattedTotal}
                    </td>
                    <td>
                      {s.isBaseline ? (
                        <span className="muted">Baseline</span>
                      ) : (
                        <span className={s.isFaster ? 'delta-pos' : 'delta-neg'}>
                          {s.changeFormatted} {s.isFaster ? '(faster)' : '(slower)'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past Workout Sessions List */}
      <div className="card">
        <h2 className="card-title">All Completed Simulations</h2>
        {data.sessions.length === 0 ? (
          <p className="muted">No simulation sessions logged yet. Tap above to log your first workout.</p>
        ) : (
          data.sessions.map((s) => {
            const runSplits = computeRunSplits(s);
            return (
              <details key={s.id}>
                <summary>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: 10 }}>
                      {s.session_date}
                    </span>
                    <span className="badge badge-active">{s.category || s.type || 'Simulation'}</span>
                    {s.rpe && (
                      <span className="badge" style={{ marginLeft: 6, background: 'var(--surface-elevated)' }}>
                        RPE {s.rpe}
                      </span>
                    )}
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
                    <button className="secondary danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleDeleteSession(s.id)}>
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

export default function AthleteHome() {
  return (
    <Suspense fallback={<div className="container"><p className="muted">Loading Athlete Portal…</p></div>}>
      <AthleteDashboardContent />
    </Suspense>
  );
}
