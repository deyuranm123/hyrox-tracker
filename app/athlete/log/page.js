'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import { LEGS, parseTime, formatSeconds, formatAsTimeInput, validateAllLegs } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';
import { saveWorkoutSession } from '../../../lib/data';

const today = () => new Date().toISOString().slice(0, 10);

export default function LogSession() {
  const router = useRouter();
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

      {error && !validationErrors.length && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Session Meta */}
        <div className="card">
          <h2 className="card-title">Session Configuration</h2>
          <div className="form-grid">
            <label>
              Workout Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Simulation Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="full_simulation">Full Race Simulation (16 Legs)</option>
                <option value="half_sim">Half Simulation (8 Legs)</option>
                <option value="benchmark">Benchmark Assessment</option>
                <option value="training">General Training</option>
              </select>
            </label>
            <label>
              Perceived Exertion (RPE 1-10)
              <select value={rpe} onChange={(e) => setRpe(e.target.value)}>
                <option value="6">6 — Moderate Aerobic</option>
                <option value="7">7 — Hard / Controlled</option>
                <option value="8">8 — Heavy / Threshold</option>
                <option value="9">9 — Very Hard / Race Pace</option>
                <option value="10">10 — All-out Maximal Effort</option>
              </select>
            </label>
          </div>
        </div>

        {/* Live Elapsed Split Indicator & Progress */}
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--surface-card), var(--surface-elevated))', borderColor: 'var(--teal-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="kpi-label">Calculated Elapsed Time</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--teal-primary)', fontFeatureSettings: '"tnum"' }}>
                {formatSeconds(liveTotalSec)}
              </div>
              <div style={{ fontSize: '0.82rem', color: enteredCount === 16 ? 'var(--success-emerald)' : 'var(--gold-hyrox)', fontWeight: 600, marginTop: 2 }}>
                {enteredCount} of 16 legs entered
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <div>
                <span style={{ display: 'block', color: 'var(--text-subtle)' }}>Total Runs (8km):</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{formatSeconds(liveRunSec)}</strong>
              </div>
              <div>
                <span style={{ display: 'block', color: 'var(--text-subtle)' }}>Total Stations:</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{formatSeconds(liveStationSec)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 16-Leg Rapid Entry Grid with Auto-Colon */}
        <div className="card">
          <h2 className="card-title">16-Leg Split Entry (8 Runs + 8 Stations)</h2>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: '0.82rem' }}>
            Auto-formats as you type digits on mobile (e.g. typing <code style={{ color: 'var(--teal-primary)' }}>430</code> becomes <code style={{ color: 'var(--teal-primary)' }}>4:30</code>).
          </p>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {LEGS.map((leg) => {
              const val = times[leg.leg];
              const isFilled = val && !Number.isNaN(parseTime(val));
              return (
                <label
                  key={leg.leg}
                  style={{
                    background: leg.isRun ? 'var(--bg-navy)' : 'var(--surface-elevated)',
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
