'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import { useProfile } from '../../../lib/useProfile';
import { getCoachDashboardData, saveAthleteProgramme } from '../../../lib/data';
import { buildCustomizedProgramme } from '../../../lib/ai/programme-generator';

export default function CoachProgrammesPage() {
  const { profile, loading: authLoading } = useProfile('coach');

  const [athletes, setAthletes] = useState([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('foundation_12wk');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [ability, setAbility] = useState('intermediate');
  const [programmePreview, setProgrammePreview] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadRoster() {
    try {
      setLoading(true);
      const data = await getCoachDashboardData(profile.id);
      const active = (data.athletes || []).filter((a) => a.status === 'accepted');
      setAthletes(active);
      if (active.length > 0) {
        setSelectedAthleteId(active[0].id);
      }
    } catch (err) {
      console.warn('Failed to load coach roster:', err);
    } finally {
      setLoading(false);
    }
  }

  // Update preview whenever category or parameters change
  useEffect(() => {
    const prog = buildCustomizedProgramme({
      templateCategory: selectedCategory,
      athleteAbility: ability,
      availableDaysPerWeek: daysPerWeek,
      availableEquipment: ['bodyweight', 'running_shoes', 'dumbbells', 'kettlebells'],
    });
    setProgrammePreview(prog);
  }, [selectedCategory, daysPerWeek, ability]);

  async function handleAssignProgramme() {
    if (!selectedAthleteId || !programmePreview || !profile?.id) return;

    setAssigning(true);
    setAssignSuccess(false);

    try {
      await saveAthleteProgramme({
        athleteId: selectedAthleteId,
        coachId: profile.id,
        programme: programmePreview,
      });

      setAssignSuccess(true);
      setTimeout(() => setAssignSuccess(false), 4000);
    } catch (err) {
      alert('Failed to assign programme: ' + (err.message || err));
    } finally {
      setAssigning(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="muted">Loading HYROX Programme Builder…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Header title="Training Programme Generator" role="coach" />

      <div style={{ marginBottom: 16 }}>
        <Link href="/coach" className="button secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          ← Back to Command Centre
        </Link>
      </div>

      {assignSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✓ Programme assigned successfully! The athlete will see their multi-week periodized roadmap.
        </div>
      )}

      {/* Header Banner */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #17263b 0%, #1a2f4c 100%)' }}>
        <span className="transfer-badge transfer-high" style={{ marginBottom: 8 }}>
          Module H · Periodized Cycle Architecture
        </span>
        <h2 style={{ margin: '4px 0 8px', fontSize: '1.45rem', fontWeight: 800 }}>
          HYROX Structured Programme Builder
        </h2>
        <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
          Program progressive volume, structured deload weeks, and station lactate tolerance tailored to each athlete&apos;s race timeline.
        </p>
      </div>

      {/* Configuration Grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>1. Programme & Roster Assignment</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {/* Athlete Selector */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Target Athlete</label>
            {athletes.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.82rem' }}>No active athletes connected.</p>
            ) : (
              <select value={selectedAthleteId} onChange={(e) => setSelectedAthleteId(e.target.value)}>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Programme Category */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Programme Category</label>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="beginner_8wk">HYROX Beginner (8 Weeks)</option>
              <option value="foundation_12wk">HYROX Foundation (12 Weeks)</option>
              <option value="performance_12wk">HYROX Performance (12 Weeks)</option>
              <option value="race_prep_8wk">HYROX Race Preparation (8 Weeks)</option>
            </select>
          </div>

          {/* Training Days */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Weekly Frequency</label>
            <select value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
              <option value={3}>3 Days / Week</option>
              <option value={4}>4 Days / Week (Recommended)</option>
              <option value={5}>5 Days / Week (Pro / High Volume)</option>
            </select>
          </div>

          {/* Ability Level */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Target Ability Level</label>
            <select value={ability} onChange={(e) => setAbility(e.target.value)}>
              <option value="beginner">Beginner (First Race)</option>
              <option value="intermediate">Intermediate (Age Group)</option>
              <option value="advanced">Advanced (Sub-1:15 Target)</option>
              <option value="elite">Elite / Pro Competitor</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleAssignProgramme}
            disabled={assigning || !selectedAthleteId}
            className="primary"
            style={{ padding: '12px 24px', fontWeight: 800 }}
          >
            {assigning ? 'Assigning Programme...' : '✓ Review & Assign Programme to Athlete'}
          </button>
        </div>
      </div>

      {/* Programme Roadmap Preview */}
      {programmePreview && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span className="transfer-badge transfer-high">{programmePreview.durationWeeks} WEEKS</span>
                <span className="transfer-badge transfer-direct">{daysPerWeek} SESSIONS / WK</span>
                <span className="transfer-badge transfer-moderate">DELOAD WEEKS: {programmePreview.deloadWeeks.join(', ')}</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{programmePreview.title}</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.86rem' }}>
                {programmePreview.description}
              </p>
            </div>
          </div>

          {/* Week by Week Schedule */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {programmePreview.weeks.map((wk) => (
              <div
                key={wk.weekNumber}
                style={{
                  background: wk.isDeload ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-navy)',
                  border: `1px solid ${wk.isDeload ? 'var(--gold-hyrox)' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 800, color: wk.isDeload ? 'var(--gold-hyrox)' : 'var(--teal-primary)' }}>
                      WEEK {wk.weekNumber}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{wk.focusTheme}</span>
                  </div>

                  <span className={`badge ${wk.isDeload ? 'badge-pending' : 'badge-active'}`}>
                    {wk.isDeload ? '🔄 Deload & Recovery' : `~${wk.targetVolumeKm}km Volume`}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 10 }}>
                  {wk.sessions.map((sess, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--surface-card)',
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: '0.8rem',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sess.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        {sess.durationMin} mins · {sess.objective.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
