'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { supabase } from '../../../lib/supabase';
import { LEGS, parseTime } from '../../../lib/format';
import { useProfile } from '../../../lib/useProfile';

const today = () => new Date().toISOString().slice(0, 10);

export default function LogSession() {
  const router = useRouter();
  const { profile, loading } = useProfile('athlete');
  const [date, setDate] = useState(today());
  const [type, setType] = useState('training');
  const [times, setTimes] = useState(() => Object.fromEntries(LEGS.map((l) => [l.leg, ''])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setError('');

    const parsed = {};
    for (const leg of LEGS) {
      const value = parseTime(times[leg.leg]);
      if (value === null) {
        return setError(`Enter a time for ${leg.label}.`);
      }
      if (Number.isNaN(value)) {
        return setError(`Time for ${leg.label} must look like 4:30 (mm:ss).`);
      }
      parsed[leg.leg] = value;
    }

    const total = Object.values(parsed).reduce((a, b) => a + b, 0);

    setBusy(true);
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .insert({ athlete_id: profile.id, session_date: date, type, total_time_sec: total })
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

  if (loading) return <p>Loading…</p>;
  if (!profile) return <p className="error">Could not load your profile.</p>;

  return (
    <>
      <Header title="Log a session" />
      <form onSubmit={save}>
        <div className="card">
          <div className="form-grid">
            <label>
              Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="training">Training</option>
                <option value="race">Race</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <p className="muted" style={{ marginTop: 0 }}>
            Enter each time as m:ss (for example 4:30). Total time is calculated for you.
          </p>
          <div className="form-grid">
            {LEGS.map((leg) => (
              <label key={leg.leg}>
                {leg.label}
                <input
                  placeholder="m:ss"
                  value={times[leg.leg]}
                  onChange={(e) => setTimes({ ...times, [leg.leg]: e.target.value })}
                  inputMode="numeric"
                />
              </label>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save session'}</button>
      </form>
    </>
  );
}
