'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import { supabase } from '../../../lib/supabase';
import { LEGS, parseTime, formatSeconds } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';

const today = () => new Date().toISOString().slice(0, 10);

export default function LogSession() {
  const router = useRouter();
  const { profile, loading } = useProfile('athlete');
  const [date, setDate] = useState(today());
  const [type, setType] = useState('training');
  const [rpe, setRpe] = useState('8');
  const [times, setTimes] = useState(() => Object.fromEntries(LEGS.map((l) => [l.leg, ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Live total time calculation as the athlete types
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

  async function save(e) {
    e.preventDefault();
    setError('');

    const parsed = {};
    for (const leg of LEGS) {
      const value = parseTime(times[leg.leg]);
      if (value === null) {
        return setError(`Please enter a time split for Leg ${leg.leg}: ${leg.label}.`);
      }
      if (Number.isNaN(value)) {
        return setError(`Time for ${leg.label} must be formatted like 4:30 (mm:ss).`);
      }
      parsed[leg.leg] = value;
    }

    const total = Object.values(parsed).reduce((a, b) => a + b, 0);

    setBusy(true);
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({
        athlete_id: profile.id,
        session_date: date,
        type: `${type} (RPE: ${rpe})`,
        total_time_sec: total,
      })
      .select('id')
      .single();

    if (sErr) {
      setBusy(false);
      return setError(sErr.message);
    }

    const rows = LEGS.map((leg) => ({
      session_id: session.id,
      leg: leg.leg,
      time_sec: parsed[leg.leg],
    }));

    const { error: rErr } = await supabase.from('station_results').insert(rows);
    setBusy(false);

    if (rErr) return setError(rErr.message);
    router.push('/athlete');
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

      <form onSubmit={save}>
        {/* Session Meta */}
        <div className="card">
          <h2 className="card-title">Session Configuration</h2>
          <div className="form-grid">
            <label>
              Workout Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Simulation Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="training">Training Simulation</option>
                <option value="race">Official Race Benchmark</option>
                <option value="taper">Taper Rehearsal</option>
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

        {/* Live Elapsed Split Indicator */}
        <div className="card" style={{ background: 'linear-gradient(135deg, var(--surface-card), var(--surface-elevated))', borderColor: 'var(--teal-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="kpi-label">Calculated Elapsed Time</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--teal-primary)', fontFeatureSettings: '"tnum"' }}>
                {formatSeconds(liveTotalSec)}
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

        {/* 16-Leg Rapid Entry Grid */}
        <div className="card">
          <h2 className="card-title">16-Leg Split Entry (8 Runs + 8 Stations)</h2>
          <p className="muted" style={{ margin: '0 0 16px', fontSize: '0.82rem' }}>
            Enter split times in <code style={{ color: 'var(--teal-primary)' }}>m:ss</code> format (e.g. 4:15).
          </p>

          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {LEGS.map((leg) => (
              <label
                key={leg.leg}
                style={{
                  background: leg.isRun ? 'var(--bg-navy)' : 'var(--surface-elevated)',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
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
                  onChange={(e) => setTimes({ ...times, [leg.leg]: e.target.value })}
                  inputMode="numeric"
                  style={{ marginTop: 4, textAlign: 'center', fontWeight: 700, fontFeatureSettings: '"tnum"' }}
                />
              </label>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="submit" disabled={busy} style={{ padding: '12px 28px', fontSize: '1rem' }}>
            {busy ? 'Validating & Recording…' : 'Save HYROX Simulation'}
          </button>
        </div>
      </form>
    </div>
  );
}
