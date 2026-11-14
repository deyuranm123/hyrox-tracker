'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import { LEGS, parseTime, formatSeconds, formatAsTimeInput, validateAllLegs } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';
import { saveWorkoutSession, updatePrescriptionStatus } from '../../../lib/data';

const today = () => new Date().toISOString().slice(0, 10);

function LogSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prescriptionId = searchParams.get('prescriptionId');
  const targetTimeParam = searchParams.get('target');

  const { profile, loading } = useProfile('athlete');
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('full_simulation');
  const [rpe, setRpe] = useState('8');
  const [times, setTimes] = useState(() => Object.fromEntries(LEGS.map((l) => [l.leg, ''])));
  const [validationErrors, setValidationErrors] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-formats input as user types digits on mobile
  const handleSplitChange = (legNumber, rawVal) => {
    const formatted = formatAsTimeInput(rawVal);
    setTimes((prev) => ({ ...prev, [legNumber]: formatted }));
    if (validationErrors.length > 0) {
      setValidationErrors([]);
      setError('');
    }
  };

  // Live progress count: "X of 16 entered"
  const enteredCount = LEGS.filter((l) => {
    const p = parseTime(times[l.leg]);
    return p !== null && !Number.isNaN(p);
  }).length;

  // Live total time calculations
  let liveTotalSec = 0;
  let liveRunSec = 0;
  let liveStationSec = 0;

  for (const leg of LEGS) {
    const parsed = parseTime(times[leg.leg]);
    if (parsed && !Number.isNaN(parsed)) {
      liveTotalSec += parsed;
      if (leg.isRun) liveRunSec += parsed;
      else liveStationSec += parsed;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

    // Validate all 16 splits simultaneously
    const validation = validateAllLegs(times);
    if (!validation.isValid) {
      const allErrors = Object.values(validation.errors);
      setValidationErrors(allErrors);
      setError(`Please complete all 16 legs (${validation.missingLegs.length} remaining).`);
      return;
    }

    setBusy(true);
    try {
      const result = await saveWorkoutSession({
        athleteId: profile.id,
        sessionDate: date,
        category,
        rpe: Number(rpe),
        splits: times,
      });

      // If fulfilling a coach's prescription, mark it completed
      if (prescriptionId) {
        await updatePrescriptionStatus({
          prescriptionId,
          athleteId: profile.id,
          status: 'completed',
          completedSessionId: result.sessionId,
        });
      }

      router.push(`/athlete?saved=true&total=${encodeURIComponent(result.formattedTotal)}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Failed to record workout session.');
    }
  }

  if (loading) return <div className="container"><p className="muted">Loading Workout Logger…</p></div>;
  if (!profile) return <div className="container"><p className="error">Could not load athlete profile.</p></div>;

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <Header title="Log Hyrox Workout" role="athlete" />

      <div style={{ marginBottom: 16 }}>
        <Link href="/athlete" className="button secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          ← Back to Athlete Portal
        </Link>
      </div>

      {/* Prescribed Session Context Banner */}
      {prescriptionId && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(23, 38, 59, 1) 100%)',
            borderColor: 'var(--gold-hyrox)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="transfer-badge transfer-moderate">Prescribed Session Fulfillment</span>
            {targetTimeParam && (
              <span style={{ fontSize: '0.8rem', color: 'var(--gold-hyrox)', fontWeight: 700 }}>
                Target: {formatSeconds(Number(targetTimeParam))}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Saving this workout will automatically fulfill your coach&apos;s prescription and update your compliance metrics.
          </div>
        </div>
      )}

      {/* Comprehensive Validation Error Banner */}
      {validationErrors.length > 0 && (
        <div className="attention-card" style={{ marginBottom: 16 }}>
          <div className="attention-header">
            <span className="card-title" style={{ margin: 0, color: 'var(--danger-coral)' }}>
              Incomplete Workout Form ({validationErrors.length} issues)
            </span>
            <span className="badge" style={{ background: 'var(--danger-coral)', color: '#fff' }}>Action Required</span>
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.82rem', color: '#fca5a5' }}>
            {validationErrors.map((msg, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Top Session Configuration */}
        <div className="card">
          <div className="form-grid">
            <div>
              <label>Workout Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <div>
              <label>Simulation Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="full_simulation">Full 16-Leg Simulation</option>
                <option value="half_sim">Half Simulation (8 Legs)</option>
                <option value="benchmark">Benchmark Race Trial</option>
                <option value="training">Daily Training Session</option>
              </select>
            </div>

            <div>
              <label>Rate of Perceived Exertion (RPE 6–10)</label>
              <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
                <option value="6">6 · Moderate (Aerobic Pace)</option>
                <option value="7">7 · Vigorous (Comfortably Hard)</option>
                <option value="8">8 · Hard (Race Target Effort)</option>
                <option value="9">9 · Very Hard (Peak Lactate)</option>
                <option value="10">10 · Maximal (Exhaustion / PB Attempt)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Calculation Banner */}
        <div className="card" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-active)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="kpi-label">Progress: {enteredCount} of 16 entered</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFeatureSettings: '"tnum"' }}>
                Elapsed: <span style={{ color: 'var(--teal-primary)' }}>{formatSeconds(liveTotalSec)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <span className="kpi-label">8km Run Total</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                  {formatSeconds(liveRunSec)}
                </div>
              </div>
              <div>
                <span className="kpi-label">Stations Total</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                  {formatSeconds(liveStationSec)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 16-Leg Split Inputs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="card-title" style={{ margin: 0 }}>Official 16-Leg Splits</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Type digits (e.g. <strong>430</strong> becomes <strong>4:30</strong>)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {LEGS.map((leg) => {
              const isFilled = times[leg.leg] && !Number.isNaN(parseTime(times[leg.leg]));
              return (
                <label
                  key={leg.leg}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--bg-navy)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: isFilled ? '1px solid var(--teal-primary)' : '1px solid var(--border-subtle)',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: leg.isRun ? 'var(--text-muted)' : 'var(--teal-primary)' }}>
                      #{leg.leg} {leg.label}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                      {leg.isRun ? 'RUN' : 'WORKOUT'}
                    </span>
                  </div>
                  <input
                    placeholder="m:ss"
                    value={times[leg.leg]}
                    onChange={(e) => handleSplitChange(leg.leg, e.target.value)}
                    inputMode="numeric"
                    style={{ marginTop: 4, textAlign: 'center', fontWeight: 700, fontFeatureSettings: '"tnum"' }}
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" disabled={busy} style={{ padding: '12px 28px', fontSize: '1rem' }}>
            {busy ? 'Validating & Recording…' : 'Save HYROX Simulation'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LogSession() {
  return (
    <Suspense fallback={<div className="container"><p className="muted">Loading Workout Logger…</p></div>}>
      <LogSessionContent />
    </Suspense>
  );
}
