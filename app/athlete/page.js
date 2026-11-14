'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../components/Header';
import { formatSeconds, LEGS } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';
import { computeRunSplits } from '../../lib/performance';
import {
  getAthleteDashboardData,
  respondToCoachRequest,
  deleteWorkoutSession,
  inviteCoachByEmail,
  getAthletePrescriptions,
  getAthleteFeedback,
  athleteRespondToFeedback,
} from '../../lib/data';

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
  const [prescriptions, setPrescriptions] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [replyInputs, setReplyInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSavedBanner, setShowSavedBanner] = useState(Boolean(savedSuccess));

  // Viral Coach Invite State
  const [coachEmailInput, setCoachEmailInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [res, prescList, fbList] = await Promise.all([
        getAthleteDashboardData(profile.id),
        getAthletePrescriptions(profile.id),
        getAthleteFeedback(profile.id),
      ]);
      setData(res);
      setPrescriptions(prescList || []);
      setFeedbackList(fbList || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athlete dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply(feedbackId) {
    const text = replyInputs[feedbackId];
    if (!text || !text.trim()) return;

    try {
      await athleteRespondToFeedback({
        feedbackId,
        athleteId: profile.id,
        response: text.trim(),
      });
      setReplyInputs((prev) => ({ ...prev, [feedbackId]: '' }));
      await loadDashboard();
    } catch (err) {
      alert('Failed to send reply: ' + (err.message || err));
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

  async function handleInviteCoach(e) {
    e.preventDefault();
    if (!coachEmailInput.trim()) return;
    setInviting(true);
    setInviteStatus(null);

    try {
      const res = await inviteCoachByEmail(coachEmailInput.trim());
      if (res === 'connected') {
        setInviteStatus({ type: 'success', msg: `Connected with Coach ${coachEmailInput}! They can now view your training.` });
        loadDashboard();
      } else {
        setInviteStatus({
          type: 'info',
          msg: `Invite recorded for ${coachEmailInput}. As soon as they sign up as a coach, your account will be linked.`,
        });
      }
      setCoachEmailInput('');
    } catch (err) {
      setInviteStatus({ type: 'error', msg: err.message || 'Failed to send invite.' });
    } finally {
      setInviting(false);
    }
  }

  if (profileLoading || (loading && !data.sessions.length)) {
    return <div className="container"><p className="muted">Loading Athlete Portal…</p></div>;
  }
  if (!profile) return <div className="container"><p className="error">Could not load athlete profile.</p></div>;

  const activePrescription = prescriptions.find((p) => p.status !== 'completed' && p.status !== 'cancelled') || null;

  return (
    <div className="container">
      <Header title={`Athlete: ${profile.full_name || 'Competitor'}`} role="athlete" />

      {/* High-Priority Prescribed Workout Banner ("Today's Workout") */}
      {activePrescription && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(23, 38, 59, 1) 100%)',
            borderColor: 'var(--gold-hyrox)',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="transfer-badge transfer-moderate">Prescribed by Coach</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--gold-hyrox)', fontWeight: 700 }}>
                  Due: {activePrescription.scheduled_date}
                </span>
              </div>
              <h2 style={{ margin: '2px 0 6px', fontSize: '1.35rem', fontWeight: 800 }}>
                {activePrescription.workout?.title || 'HYROX Prescribed Session'}
              </h2>
              {activePrescription.coaching_notes && (
                <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  💬 Coach instructions: <em>&ldquo;{activePrescription.coaching_notes}&rdquo;</em>
                </p>
              )}
              {activePrescription.target_total_time_sec && (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Target Completion Time: <strong>{formatSeconds(activePrescription.target_total_time_sec)}</strong>
                </div>
              )}
            </div>

            <div style={{ alignSelf: 'center' }}>
              <Link
                href={`/athlete/log?prescriptionId=${activePrescription.id}&target=${activePrescription.target_total_time_sec || ''}`}
                className="button"
                style={{
                  background: 'var(--gold-hyrox)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  padding: '12px 24px',
                  display: 'inline-block',
                }}
              >
                ⚡ START & LOG THIS SESSION
              </Link>
            </div>
          </div>
        </div>
      )}

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

      {/* Stage 2 Adaptive Action Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 18 }}>
        {/* AI Workout Generator */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #17263b 0%, #1c3350 100%)', border: '1px solid var(--teal-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1.3rem' }}>⚡</span>
            <span className="transfer-badge transfer-high">Adaptive OS</span>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>Build My HYROX Workout</h3>
          <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 16 }}>
            Generate balanced compromised running & station workouts tailored strictly to your gear.
          </p>
          <Link href="/athlete/workouts/generate" className="button" style={{ display: 'inline-block', width: '100%', textAlign: 'center', background: 'var(--teal-primary)', color: '#000', fontWeight: 800 }}>
            Generate Workout →
          </Link>
        </div>

        {/* Equipment Inventory */}
        <div className="card" style={{ background: 'linear-gradient(135deg, #17263b 0%, #1a2f4c 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '1.3rem' }}>🎒</span>
            <span className="transfer-badge transfer-direct">Inventory & Scan</span>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>My Equipment & Coverage</h3>
          <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 16 }}>
            Audit your available gear and review biomechanical transfer against official stations.
          </p>
          <Link href="/athlete/equipment" className="secondary" style={{ display: 'inline-block', width: '100%', textAlign: 'center', fontWeight: 700 }}>
            Manage Equipment →
          </Link>
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

      {/* Prescribed Training Schedule (From Coach) */}
      {prescriptions.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              Coach Prescriptions & Training Schedule ({prescriptions.length})
            </h2>
            <span className="badge badge-active">Active Plan</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Prescribed Workout</th>
                  <th>Target Time</th>
                  <th>Coach Instructions</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((p) => {
                  const isDone = p.status === 'completed';
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.scheduled_date}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.workout?.title || 'Prescribed Session'}
                        </span>
                      </td>
                      <td style={{ fontFeatureSettings: '"tnum"', fontWeight: 600, color: 'var(--gold-hyrox)' }}>
                        {p.target_total_time_sec ? formatSeconds(p.target_total_time_sec) : 'Open Target'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 220 }}>
                        {p.coaching_notes || '—'}
                      </td>
                      <td>
                        <span className={`badge ${isDone ? 'badge-active' : 'badge-pending'}`}>
                          {isDone ? '✓ Completed' : p.status}
                        </span>
                      </td>
                      <td>
                        {!isDone ? (
                          <Link
                            href={`/athlete/log?prescriptionId=${p.id}&target=${p.target_total_time_sec || ''}`}
                            className="button"
                            style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'var(--gold-hyrox)', color: '#000' }}
                          >
                            Log
                          </Link>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Logged</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Coach Feedback & Debrief Notes (Two-Way Coaching) */}
      {feedbackList.length > 0 && (
        <div className="card" style={{ border: '1px solid var(--teal-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>💬</span>
              <h2 className="card-title" style={{ margin: 0 }}>
                Coach Feedback & Session Debriefs ({feedbackList.length})
              </h2>
            </div>
            {feedbackList.some((f) => !f.is_read_by_athlete) && (
              <span className="badge badge-pending">New Unread Feedback</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                style={{
                  background: 'var(--bg-navy)',
                  borderRadius: 8,
                  padding: 14,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: 'var(--teal-primary)', fontSize: '0.9rem' }}>
                    Coach Observation
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: 8, whiteSpace: 'pre-line' }}>
                  {fb.general_feedback}
                </div>

                {fb.recommendations && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--gold-hyrox)', background: 'rgba(245, 158, 11, 0.08)', padding: '8px 10px', borderRadius: 6, marginBottom: 10 }}>
                    🎯 <strong>Next Action:</strong> {fb.recommendations}
                  </div>
                )}

                {/* Athlete Reply Thread */}
                {fb.athlete_response ? (
                  <div style={{ borderLeft: '2px solid var(--teal-primary)', paddingLeft: 10, marginTop: 8, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>You replied:</span>{' '}
                    <span style={{ color: 'var(--text-primary)' }}>{fb.athlete_response}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      type="text"
                      placeholder="Type a reply or question to your coach..."
                      value={replyInputs[fb.id] || ''}
                      onChange={(e) => setReplyInputs({ ...replyInputs, [fb.id]: e.target.value })}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      className="primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={() => handleSendReply(fb.id)}
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            ))}
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
      {/* Invite Your Coach (Viral Growth Loop) */}
      <div className="card" style={{ border: '1px dashed var(--border-active)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>Invite Your Coach to RŌXCOACH</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 14 }}>
          Coached by a certified trainer or gym? Connect your account so they can prescribe workouts, review your splits, and give debrief feedback.
        </p>

        {inviteStatus && (
          <div
            className={`alert ${inviteStatus.type === 'success' ? 'alert-success' : 'alert-info'}`}
            style={{ marginBottom: 12 }}
          >
            {inviteStatus.msg}
          </div>
        )}

        <form onSubmit={handleInviteCoach} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="email"
            value={coachEmailInput}
            onChange={(e) => setCoachEmailInput(e.target.value)}
            placeholder="coach@example.com"
            required
            style={{ flex: 1, minWidth: 240, padding: '10px 14px' }}
          />
          <button type="submit" disabled={inviting} className="primary" style={{ padding: '10px 18px' }}>
            {inviting ? 'Sending Invite...' : 'Send Coach Invite'}
          </button>
        </form>
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
