'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import { formatSeconds, parseTime, LEGS } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';
import {
  getCoachAthleteDetailData,
  getAthletePrescriptions,
  createWorkoutPrescription,
  calculatePrescriptionCompliance,
  saveCoachFeedback,
} from '../../../lib/data';
import { generateAdaptiveWorkout } from '../../../lib/ai/workout-generator';

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
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Prescription Modal State
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescDate, setPrescDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [prescObjective, setPrescObjective] = useState('compromised_running');
  const [prescDuration, setPrescDuration] = useState(45);
  const [coachingNotes, setCoachingNotes] = useState('');
  const [targetTimeStr, setTargetTimeStr] = useState('1:15:00');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  // Debrief & Feedback Modal State
  const [debriefSession, setDebriefSession] = useState(null);
  const [generalFeedbackInput, setGeneralFeedbackInput] = useState('');
  const [recommendationsInput, setRecommendationsInput] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState('');

  useEffect(() => {
    if (!profile || !athleteId) return;
    loadAthleteDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, athleteId]);

  async function loadAthleteDetail() {
    try {
      setLoading(true);
      const [res, prescList] = await Promise.all([
        getCoachAthleteDetailData(athleteId),
        getAthletePrescriptions(athleteId),
      ]);
      setData(res);
      setPrescriptions(prescList || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athlete performance detail.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePrescription(e) {
    e.preventDefault();
    if (!profile?.id || !athleteId) return;

    setSubmittingPrescription(true);
    try {
      // 1. Generate structured workout block using adaptive generator
      const generated = generateAdaptiveWorkout({
        objective: prescObjective,
        durationMin: Number(prescDuration) || 45,
        availableEquipment: ['bodyweight', 'running_shoes', 'dumbbells', 'kettlebells'],
      });

      // 2. Parse target time
      const targetSec = parseTime(targetTimeStr);

      // 3. Save prescription
      await createWorkoutPrescription({
        coachId: profile.id,
        athleteId,
        scheduledDate: prescDate,
        coachingNotes,
        targetTotalTimeSec: isNaN(targetSec) ? null : targetSec,
        workoutPayload: generated,
      });

      setIsPrescribing(false);
      setCoachingNotes('');
      await loadAthleteDetail();
    } catch (err) {
      alert('Failed to publish prescription: ' + (err.message || err));
    } finally {
      setSubmittingPrescription(false);
    }
  }

  async function handleSaveDebrief(e) {
    e.preventDefault();
    if (!profile?.id || !athleteId || !debriefSession) return;

    setSavingFeedback(true);
    try {
      await saveCoachFeedback({
        coachId: profile.id,
        athleteId,
        sessionId: debriefSession.id,
        generalFeedback: generalFeedbackInput,
        recommendations: recommendationsInput,
      });

      setFeedbackSuccessMsg('✓ Feedback debrief posted to athlete dashboard!');
      setTimeout(() => {
        setFeedbackSuccessMsg('');
        setDebriefSession(null);
        setGeneralFeedbackInput('');
        setRecommendationsInput('');
      }, 1500);
    } catch (err) {
      alert('Failed to save debrief: ' + (err.message || err));
    } finally {
      setSavingFeedback(false);
    }
  }

  if (profileLoading || (loading && !data.athlete)) {
    return <div className="container"><p className="muted">Loading Athlete Analytics…</p></div>;
  }
  if (!profile) return <div className="container"><p className="error">Could not load coach profile.</p></div>;

  const latestSession = data.sessions.filter((s) => s.total_time_sec != null)[0] || null;
  const compliance = calculatePrescriptionCompliance(prescriptions);

  return (
    <div className="container">
      <Header title="Athlete Performance Command" role="coach" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link href="/coach" className="button secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          ← Back to Coach Roster
        </Link>
        <button
          onClick={() => setIsPrescribing(true)}
          className="primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700 }}
        >
          + Prescribe Workout
        </button>
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
            <span className="kpi-label">Training Compliance</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--teal-primary)' }}>
              {compliance.compliancePct}%
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {compliance.completedCount} / {compliance.dueCount} Due Done
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="kpi-label">Personal Best</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-hyrox)', fontFeatureSettings: '"tnum"' }}>
              {data.formattedPersonalBest}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>16-Leg Total</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="kpi-label">Total Completed</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {data.totalCompleted}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulations</span>
          </div>
        </div>
      </div>

      {/* Prescribed vs Completed Coaching Circuit */}
      <div className="card" style={{ border: '1px solid var(--border-active)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <span className="transfer-badge transfer-high" style={{ marginBottom: 4 }}>
              Two-Way Coaching Circuit
            </span>
            <h2 className="card-title" style={{ margin: '4px 0 0' }}>
              Prescribed Training Schedule ({prescriptions.length})
            </h2>
          </div>
          <button
            onClick={() => setIsPrescribing(true)}
            className="secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            + New Prescription
          </button>
        </div>

        {prescriptions.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No workouts prescribed yet for this athlete. Click &ldquo;Prescribe Workout&rdquo; above to program their training.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Scheduled Date</th>
                  <th>Workout Title</th>
                  <th>Structure</th>
                  <th>Target Time</th>
                  <th>Coaching Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((p) => {
                  const isCompleted = p.status === 'completed';
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.scheduled_date}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.workout?.title || 'HYROX Target Session'}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--surface-elevated)', fontSize: '0.72rem' }}>
                          {p.workout?.structure_type || 'Custom'}
                        </span>
                      </td>
                      <td style={{ fontFeatureSettings: '"tnum"', fontWeight: 700, color: 'var(--gold-hyrox)' }}>
                        {p.target_total_time_sec ? formatSeconds(p.target_total_time_sec) : 'Open Target'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 220 }}>
                        {p.coaching_notes || '—'}
                      </td>
                      <td>
                        <span className={`badge ${isCompleted ? 'badge-active' : 'badge-pending'}`}>
                          {isCompleted ? '✓ Completed' : p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={() => {
                  setDebriefSession(s);
                  setGeneralFeedbackInput('');
                  setRecommendationsInput('');
                }}
              >
                💬 Post Coach Debrief
              </button>
            </div>
          </details>
        ))}
      </div>

      {/* Prescription Builder Modal */}
      {isPrescribing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span className="transfer-badge transfer-high" style={{ marginBottom: 4 }}>Prescription Engine</span>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Prescribe HYROX Training Session</h3>
              </div>
              <button onClick={() => setIsPrescribing(false)} className="secondary" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 16 }}>
              Assign an objective-driven HYROX session to <strong>{data.athlete?.full_name || data.athlete?.email}</strong>.
            </p>

            <form onSubmit={handleCreatePrescription} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled Date</label>
                  <input
                    type="date"
                    value={prescDate}
                    onChange={(e) => setPrescDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Time (m:ss or h:mm:ss)</label>
                  <input
                    type="text"
                    value={targetTimeStr}
                    onChange={(e) => setTargetTimeStr(e.target.value)}
                    placeholder="e.g. 1:15:00"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Training Objective</label>
                  <select value={prescObjective} onChange={(e) => setPrescObjective(e.target.value)}>
                    <option value="compromised_running">Compromised Running Pace Engine</option>
                    <option value="lactate_tolerance">Lactate Tolerance & Stations</option>
                    <option value="aerobic_power">Aerobic Threshold Pacing</option>
                    <option value="strength_conditioning">HYROX Strength & Power</option>
                    <option value="full_simulation">Half / Full Race Simulation</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duration (Minutes)</label>
                  <select value={prescDuration} onChange={(e) => setPrescDuration(Number(e.target.value))}>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes (Standard)</option>
                    <option value={60}>60 Minutes</option>
                    <option value={75}>75 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coaching Instructions & Pacing Notes</label>
                <textarea
                  value={coachingNotes}
                  onChange={(e) => setCoachingNotes(e.target.value)}
                  placeholder="e.g. Keep 1km compromised run pace strictly under 4:45/km. Breathe rhythmically on Wall Balls and do not drop arms."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setIsPrescribing(false)} className="secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPrescription} className="primary" style={{ padding: '10px 20px' }}>
                  {submittingPrescription ? 'Publishing...' : 'Publish Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coach Debrief & Split Comments Modal */}
      {debriefSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 580, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span className="transfer-badge transfer-high" style={{ marginBottom: 4 }}>Coach Debrief</span>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                  Debrief Workout ({debriefSession.session_date})
                </h3>
              </div>
              <button onClick={() => setDebriefSession(null)} className="secondary" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            {feedbackSuccessMsg && (
              <div className="alert alert-success" style={{ marginBottom: 14 }}>
                {feedbackSuccessMsg}
              </div>
            )}

            <p className="muted" style={{ fontSize: '0.84rem', marginBottom: 16 }}>
              Provide structured performance feedback on this {formatSeconds(debriefSession.total_time_sec)} simulation. Attached directly to the athlete&apos;s workout record.
            </p>

            <form onSubmit={handleSaveDebrief} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Performance Observations & Pacing Review
                </label>
                <textarea
                  value={generalFeedbackInput}
                  onChange={(e) => setGeneralFeedbackInput(e.target.value)}
                  placeholder="e.g. Your compromised run pace held remarkably steady at 4:35/km. However, you lost 40s during the Wall Ball transition. Focus on immediate breathing resets."
                  rows={4}
                  required
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Recommendations for Next Sessions
                </label>
                <textarea
                  value={recommendationsInput}
                  onChange={(e) => setRecommendationsInput(e.target.value)}
                  placeholder="e.g. Program 3 sets of 25 unbroken wall ball thrusters after 800m threshold repeats on Wednesday."
                  rows={2}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setDebriefSession(null)} className="secondary">
                  Cancel
                </button>
                <button type="submit" disabled={savingFeedback} className="primary" style={{ padding: '10px 20px' }}>
                  {savingFeedback ? 'Posting...' : 'Post Coach Debrief'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
