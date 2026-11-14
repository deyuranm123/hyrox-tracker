'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import { useProfile } from '../../../lib/useProfile';
import { getAthleteActiveProgramme, saveAthleteProgramme } from '../../../lib/data';
import { PROGRAMME_TEMPLATES, buildCustomizedProgramme } from '../../../lib/ai/programme-generator';

export default function AthleteProgrammesPage() {
  const { profile, loading: authLoading } = useProfile('athlete');

  const [activeProgramme, setActiveProgramme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('beginner_8wk');
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    loadProgramme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadProgramme() {
    try {
      setLoading(true);
      const prog = await getAthleteActiveProgramme(profile.id);
      setActiveProgramme(prog);
    } catch (err) {
      console.warn('Failed to load athlete programme:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelfEnroll() {
    if (!profile?.id) return;
    setEnrolling(true);
    try {
      const generated = buildCustomizedProgramme({
        templateCategory: selectedTemplate,
        athleteAbility: 'intermediate',
        availableDaysPerWeek: 4,
        availableEquipment: ['bodyweight', 'running_shoes'],
      });

      await saveAthleteProgramme({
        athleteId: profile.id,
        coachId: null,
        programme: generated,
      });

      setActiveProgramme(generated);
    } catch (err) {
      alert('Failed to enroll: ' + (err.message || err));
    } finally {
      setEnrolling(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="muted">Loading Training Programme…</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Header title="My Training Programme" role="athlete" />

      <div style={{ marginBottom: 16 }}>
        <Link href="/athlete" className="button secondary" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
          ← Back to Athlete Dashboard
        </Link>
      </div>

      {/* Active Programme Card */}
      {activeProgramme ? (
        <div>
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #17263b 0%, #1a2f4c 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span className="transfer-badge transfer-high">{activeProgramme.durationWeeks} WEEKS</span>
                  <span className="transfer-badge transfer-direct">
                    {activeProgramme.coach_id ? 'Assigned by Coach' : 'Self-Guided Plan'}
                  </span>
                </div>
                <h2 style={{ margin: '4px 0 6px', fontSize: '1.45rem', fontWeight: 800 }}>
                  {activeProgramme.title}
                </h2>
                <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
                  {activeProgramme.description}
                </p>
              </div>

              <Link
                href="/athlete/workouts/generate"
                className="primary"
                style={{ background: 'var(--gold-hyrox)', color: '#000', textDecoration: 'none', padding: '8px 16px', fontWeight: 800 }}
              >
                ⚡ Start Next Session
              </Link>
            </div>
          </div>

          {/* Week by Week Schedule */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>Weekly Training Roadmap</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activeProgramme.weeks.map((wk) => (
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
                      {wk.isDeload ? '🔄 Deload Week' : `~${wk.targetVolumeKm}km Volume`}
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
                          {sess.durationMin} mins · {sess.objective?.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State / Enrollment */
        <div className="card">
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <span style={{ fontSize: '2.5rem' }}>📋</span>
            <h2 style={{ margin: '8px 0 6px', fontSize: '1.35rem' }}>No Active Training Programme</h2>
            <p className="muted" style={{ maxWidth: 520, margin: '0 auto 24px', fontSize: '0.88rem' }}>
              Your coach can prescribe a custom multi-week programme, or you can self-enroll into one of our four HYROX training templates below:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, textAlign: 'left', marginBottom: 24 }}>
              {PROGRAMME_TEMPLATES.map((t) => {
                const isSelected = selectedTemplate === t.category;
                return (
                  <div
                    key={t.category}
                    onClick={() => setSelectedTemplate(t.category)}
                    style={{
                      background: isSelected ? 'rgba(25, 182, 160, 0.08)' : 'var(--bg-navy)',
                      border: `1px solid ${isSelected ? 'var(--teal-primary)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="transfer-badge transfer-high">{t.durationWeeks} Weeks</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.sessionsPerWeek} days/wk</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 4 }}>{t.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.targetAudience}</div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSelfEnroll}
              disabled={enrolling}
              className="primary"
              style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 800 }}
            >
              {enrolling ? 'Enrolling...' : '✓ Enroll in Selected Programme'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
