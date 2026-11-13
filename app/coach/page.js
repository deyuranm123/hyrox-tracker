'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { supabase } from '../../lib/supabase';
import { formatSeconds } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';

export default function CoachDashboard() {
  const { profile, loading } = useProfile('coach');
  const [roster, setRoster] = useState([]);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function load() {
    const { data: links, error: linkErr } = await supabase
      .from('coach_athletes')
      .select('athlete_id, status, profiles!coach_athletes_athlete_id_fkey(full_name, email)')
      .eq('coach_id', profile.id);
    if (linkErr) return setError(linkErr.message);

    const accepted = (links || []).filter((l) => l.status === 'accepted').map((l) => l.athlete_id);
    let sessionsByAthlete = {};

    if (accepted.length > 0) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('athlete_id, session_date, total_time_sec, type')
        .in('athlete_id', accepted)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });

      for (const s of sessions || []) {
        if (!sessionsByAthlete[s.athlete_id]) {
          sessionsByAthlete[s.athlete_id] = [];
        }
        sessionsByAthlete[s.athlete_id].push(s);
      }
    }

    const compiledRoster = (links || []).map((l) => {
      const athleteSessions = sessionsByAthlete[l.athlete_id] || [];
      const lastSession = athleteSessions[0] || null;
      const prevSession = athleteSessions[1] || null;

      let deltaSec = null;
      let deltaFormatted = '—';
      if (lastSession?.total_time_sec && prevSession?.total_time_sec) {
        deltaSec = lastSession.total_time_sec - prevSession.total_time_sec;
        const sign = deltaSec > 0 ? '+' : deltaSec < 0 ? '−' : '';
        deltaFormatted = `${sign}${formatSeconds(Math.abs(deltaSec))}`;
      }

      // Inactivity check (> 7 days since last session)
      let daysSinceLast = null;
      if (lastSession?.session_date) {
        const diffMs = Date.now() - new Date(lastSession.session_date).getTime();
        daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        ...l,
        last: lastSession,
        prev: prevSession,
        deltaSec,
        deltaFormatted,
        daysSinceLast,
        totalSessionsCount: athleteSessions.length,
      };
    });

    setRoster(compiledRoster);
  }

  async function addAthlete(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    const { data, error: reqErr } = await supabase.rpc('request_athlete', { p_email: email });
    if (reqErr) return setError(reqErr.message);

    const messages = {
      requested: 'Invitation dispatched. Athlete must accept from their portal to reveal simulation splits.',
      not_found: 'No athlete account found with that email. Have them register as an Athlete first.',
      not_allowed: 'Only verified coaches can issue roster invitations.',
    };
    setMessage(messages[data] || 'Invitation processed.');
    if (data === 'requested') setEmail('');
    load();
  }

  async function removeLink(athleteId) {
    if (!confirm('Remove this athlete from your active roster?')) return;
    await supabase
      .from('coach_athletes')
      .delete()
      .eq('coach_id', profile.id)
      .eq('athlete_id', athleteId);
    load();
  }

  if (loading) return <div className="container"><p className="muted">Loading Command Centre…</p></div>;
  if (!profile) return <div className="container"><p className="error">Could not load coach profile.</p></div>;

  const activeAthletes = roster.filter((r) => r.status === 'accepted');
  const pendingAthletes = roster.filter((r) => r.status === 'pending');

  // Attention Required Engine:
  // 1. Pending athlete approvals
  // 2. Inactive athletes (> 7 days without training)
  // 3. Athletes who improved in their latest session
  const attentionItems = [];
  pendingAthletes.forEach((p) => {
    attentionItems.push({
      type: 'pending',
      title: `${p.profiles?.full_name || p.profiles?.email} invitation pending`,
      desc: 'Awaiting athlete confirmation.',
    });
  });
  activeAthletes.forEach((a) => {
    if (a.daysSinceLast != null && a.daysSinceLast >= 7) {
      attentionItems.push({
        type: 'inactive',
        title: `${a.profiles?.full_name || 'Athlete'} missed training`,
        desc: `${a.daysSinceLast} days since last logged session. Review weekly volume.`,
      });
    } else if (a.deltaSec != null && a.deltaSec < 0) {
      attentionItems.push({
        type: 'progress',
        title: `${a.profiles?.full_name || 'Athlete'} improved pace`,
        desc: `Cut ${formatSeconds(Math.abs(a.deltaSec))} off their last simulation.`,
      });
    }
  });

  return (
    <div className="container">
      <Header title={`Coach ${profile.full_name || ''}`.trim()} role="coach" />

      {/* Five-Question KPI Command Ribbon */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Active Athletes</span>
          <span className="kpi-value">{activeAthletes.length}</span>
          <span className="kpi-sub">{pendingAthletes.length} pending onboarding</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Attention Signals</span>
          <span className="kpi-value" style={{ color: attentionItems.length > 0 ? 'var(--gold-hyrox)' : 'var(--success-emerald)' }}>
            {attentionItems.length}
          </span>
          <span className="kpi-sub">Critical athlete updates</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Weekly Training Pace</span>
          <span className="kpi-value" style={{ color: 'var(--teal-primary)' }}>
            {activeAthletes.filter((a) => a.last != null).length} / {activeAthletes.length || 1}
          </span>
          <span className="kpi-sub">Athletes logged sessions</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Race Readiness</span>
          <span className="kpi-value">Active</span>
          <span className="kpi-sub">8-Station benchmark engine</span>
        </div>
      </div>

      {/* Attention Required Command Panel */}
      {attentionItems.length > 0 && (
        <div className="attention-card">
          <div className="attention-header">
            <span className="card-title" style={{ margin: 0, color: '#fca5a5' }}>
              Attention Required
            </span>
            <span className="attention-badge">{attentionItems.length} Action Items</span>
          </div>
          <div>
            {attentionItems.map((item, idx) => (
              <div key={idx} className="attention-item">
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
                <span className="badge badge-pending">Review</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Athlete Quick Bar */}
      <div className="card">
        <h2 className="card-title">Add Athlete to Roster</h2>
        <form onSubmit={addAthlete} className="row">
          <input
            type="email"
            placeholder="athlete@gym.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ flex: 1, minWidth: 240 }}
          />
          <button type="submit">Issue Roster Invite</button>
        </form>
        {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      {/* Athlete Portfolio Roster */}
      <div className="card">
        <h2 className="card-title">Athlete Roster & Performance Deltas</h2>
        {roster.length === 0 ? (
          <p className="muted">No athletes assigned yet. Issue an invitation above to begin tracking.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Athlete Name</th>
                  <th>Status</th>
                  <th>Last Simulation</th>
                  <th>Total Time</th>
                  <th>Recent Delta</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((row) => {
                  const last = row.last;
                  const isAccepted = row.status === 'accepted';
                  const isFaster = row.deltaSec != null && row.deltaSec < 0;

                  return (
                    <tr key={row.athlete_id}>
                      <td>
                        {isAccepted ? (
                          <Link href={`/coach/${row.athlete_id}`} style={{ color: 'var(--teal-primary)', fontWeight: 700, textDecoration: 'none' }}>
                            {row.profiles?.full_name || row.profiles?.email}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>
                            {row.profiles?.full_name || row.profiles?.email}
                          </span>
                        )}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                          {row.profiles?.email}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isAccepted ? 'badge-active' : 'badge-pending'}`}>
                          {isAccepted ? 'Active' : 'Awaiting Acceptance'}
                        </span>
                      </td>
                      <td>{last?.session_date || '—'}</td>
                      <td style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                        {formatSeconds(last?.total_time_sec)}
                      </td>
                      <td>
                        {row.deltaSec != null ? (
                          <span className={isFaster ? 'delta-pos' : 'delta-neg'}>
                            {row.deltaFormatted}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          {isAccepted && (
                            <Link href={`/coach/${row.athlete_id}`} className="button secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                              Scorecard
                            </Link>
                          )}
                          <button
                            className="secondary danger"
                            onClick={() => removeLink(row.athlete_id)}
                            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Remove from roster"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
