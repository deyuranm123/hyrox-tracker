'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import { formatSeconds } from '../../lib/format';
import { useProfile } from '../../lib/useProfile';
import { getCoachDashboardData, requestAthleteByEmail, removeAthleteLink } from '../../lib/data';

export default function CoachDashboard() {
  const { profile, loading: profileLoading } = useProfile('coach');
  const [data, setData] = useState({
    roster: [],
    activeAthletes: [],
    pendingAthletes: [],
    attentionItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) return;
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function loadDashboard() {
    try {
      setLoading(true);
      const res = await getCoachDashboardData(profile.id);
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coach command centre.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAthlete(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const status = await requestAthleteByEmail(email);
      const messages = {
        requested: 'Invitation dispatched. Athlete must accept from their portal to reveal simulation splits.',
        not_found: 'No athlete account found with that email. Have them register as an Athlete first.',
        not_allowed: 'Only verified coaches can issue roster invitations.',
      };
      setMessage(messages[status] || 'Invitation processed.');
      if (status === 'requested') setEmail('');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue roster invite.');
    }
  }

  async function handleRemoveLink(athleteId) {
    if (!confirm('Remove this athlete from your active roster?')) return;
    try {
      await removeAthleteLink({ coachId: profile.id, athleteId });
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove athlete.');
    }
  }

  if (profileLoading || (loading && !data.roster.length)) {
    return <div className="container"><p className="muted">Loading Command Centre…</p></div>;
  }
  if (!profile) return <div className="container"><p className="error">Could not load coach profile.</p></div>;

  return (
    <div className="container">
      <Header title={`Coach ${profile.full_name || ''}`.trim()} role="coach" />

      {/* Five-Question KPI Command Ribbon */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Active Athletes</span>
          <span className="kpi-value">{data.activeAthletes.length}</span>
          <span className="kpi-sub">{data.pendingAthletes.length} pending onboarding</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Attention Signals</span>
          <span className="kpi-value" style={{ color: data.attentionItems.length > 0 ? 'var(--gold-hyrox)' : 'var(--success-emerald)' }}>
            {data.attentionItems.length}
          </span>
          <span className="kpi-sub">Critical athlete updates</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Weekly Training Volume</span>
          <span className="kpi-value" style={{ color: 'var(--teal-primary)' }}>
            {data.activeAthletes.filter((a) => a.last != null).length} / {data.activeAthletes.length || 1}
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
      {data.attentionItems.length > 0 && (
        <div className="attention-card">
          <div className="attention-header">
            <span className="card-title" style={{ margin: 0, color: '#fca5a5' }}>
              Attention Required
            </span>
            <span className="attention-badge">{data.attentionItems.length} Action Items</span>
          </div>
          <div>
            {data.attentionItems.map((item, idx) => (
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
        <form onSubmit={handleAddAthlete} className="row">
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
        {data.roster.length === 0 ? (
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
                {data.roster.map((row) => {
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
                            onClick={() => handleRemoveLink(row.athlete_id)}
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
