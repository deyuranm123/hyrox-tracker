'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../../components/Header';
import { useProfile } from '../../../../lib/useProfile';
import { getAthleteEquipment, saveGeneratedWorkout } from '../../../../lib/data';
import { EQUIPMENT_CATALOG, OFFICIAL_STATIONS } from '../../../../lib/ai/taxonomy';
import { generateAdaptiveWorkout } from '../../../../lib/ai/workout-generator';
import { findSubstitutesForStation } from '../../../../lib/ai/substitution-engine';

export default function BuildWorkoutPage() {
  const { profile, loading: authLoading } = useProfile('athlete');

  // Generator Options State
  const [objective, setObjective] = useState('compromised_running');
  const [space, setSpace] = useState('open_floor');
  const [durationMin, setDurationMin] = useState(45);
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [intensity, setIntensity] = useState('hard');
  const [preferredStructure, setPreferredStructure] = useState('compromised_running');

  // Equipment Selection
  const [availableEquipment, setAvailableEquipment] = useState(['bodyweight', 'running_shoes']);
  const [loadingEquipment, setLoadingEquipment] = useState(true);

  // Generated Workout State
  const [workout, setWorkout] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Exercise Swap Drawer State
  const [swappingBlockIndex, setSwappingBlockIndex] = useState(null);
  const [swapCandidates, setSwapCandidates] = useState([]);

  useEffect(() => {
    if (!profile?.id) return;
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadEquipment() {
    setLoadingEquipment(true);
    try {
      const items = await getAthleteEquipment(profile.id);
      if (items && items.length > 0) {
        setAvailableEquipment(items.map((i) => i.equipment_slug));
      }
    } catch (e) {
      console.warn('Could not fetch equipment:', e);
    } finally {
      setLoadingEquipment(false);
    }
  }

  function toggleEquipment(slug) {
    if (availableEquipment.includes(slug)) {
      setAvailableEquipment(availableEquipment.filter((s) => s !== slug));
    } else {
      setAvailableEquipment([...availableEquipment, slug]);
    }
  }

  function handleGenerate() {
    setGenerating(true);
    setSavedSuccess(false);

    setTimeout(() => {
      const generated = generateAdaptiveWorkout({
        objective,
        availableEquipment,
        availableSpace: space,
        durationMin,
        experienceLevel,
        intensity,
        preferredStructure: preferredStructure === 'auto' ? null : preferredStructure,
      });

      setWorkout(generated);
      setGenerating(false);
    }, 400);
  }

  async function handleSaveWorkout() {
    if (!workout || !profile?.id) return;
    try {
      await saveGeneratedWorkout({ creatorId: profile.id, workout });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      alert('Could not save workout: ' + err.message);
    }
  }

  function openSwapDrawer(blockIdx, currentExerciseName) {
    setSwappingBlockIndex(blockIdx);
    // Find matching station to get substitutions
    const matchedStation = OFFICIAL_STATIONS.find(
      (s) => s.name.toLowerCase().includes(currentExerciseName.toLowerCase()) ||
             currentExerciseName.toLowerCase().includes(s.slug)
    ) || OFFICIAL_STATIONS[1]; // default to sled push

    const subs = findSubstitutesForStation(matchedStation.slug, availableEquipment, space);
    setSwapCandidates(subs);
  }

  function applySwap(newSub) {
    if (!workout || swappingBlockIndex === null) return;
    const updatedBlocks = [...workout.workoutBlocks];
    const target = updatedBlocks[swappingBlockIndex];

    if (target) {
      target.exerciseName = newSub.substituteName;
      target.isSubstitution = true;
      target.substituteReason = `${newSub.rationale} (Transfer Score: ${newSub.transferScore}%)`;
      target.notes = newSub.scalingGuidance;
    }

    setWorkout({ ...workout, workoutBlocks: updatedBlocks });
    setSwappingBlockIndex(null);
  }

  if (authLoading || loadingEquipment) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="muted">Loading workout generator...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Header title="AI Workout Generator" role="athlete" />

      {/* Top Banner */}
      <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #17263b 0%, #1a2f4c 100%)' }}>
        <span className="transfer-badge transfer-high" style={{ marginBottom: 8 }}>
          RŌXCOACH AI Generator
        </span>
        <h2 style={{ margin: '4px 0 8px', fontSize: '1.45rem', fontWeight: 800 }}>
          Build My HYROX Workout
        </h2>
        <p className="muted" style={{ margin: 0, maxWidth: 620 }}>
          Scientifically programmed HYROX sessions adapted to your available equipment, training space, and fatigue state.
        </p>
      </div>

      {/* Generator Configuration Grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>1. Training Objective & Structure</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {/* Objective */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Primary Objective</label>
            <select value={objective} onChange={(e) => setObjective(e.target.value)}>
              <option value="compromised_running">Compromised Running Pace Engine</option>
              <option value="lactate_tolerance">Lactate Tolerance & Stations</option>
              <option value="aerobic_power">Aerobic Threshold Pacing</option>
              <option value="strength_conditioning">HYROX Strength & Power</option>
              <option value="full_simulation">Half / Full Race Simulation</option>
            </select>
          </div>

          {/* Workout Structure */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Workout Structure</label>
            <select value={preferredStructure} onChange={(e) => setPreferredStructure(e.target.value)}>
              <option value="compromised_running">Compromised Running Cycles</option>
              <option value="emom">EMOM (Every Minute on the Minute)</option>
              <option value="amrap">AMRAP (As Many Rounds As Possible)</option>
              <option value="circuit">Station Conditioning Circuit</option>
              <option value="intervals">High-Intensity Intervals</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Target Duration</label>
            <select value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))}>
              <option value={20}>20 Minutes (Express HIIT)</option>
              <option value={30}>30 Minutes (Station Focus)</option>
              <option value={45}>45 Minutes (Standard HYROX Block)</option>
              <option value={60}>60 Minutes (High Volume)</option>
              <option value={75}>75 Minutes (Extended Race Rehearsal)</option>
            </select>
          </div>

          {/* Space */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Available Training Space</label>
            <select value={space} onChange={(e) => setSpace(e.target.value)}>
              <option value="compact">Compact / Living Room / Hotel</option>
              <option value="open_floor">Open Gym Floor / Garage</option>
              <option value="turf_track">Gym with Turf Track</option>
              <option value="outdoor_field">Outdoor Track / Park</option>
            </select>
          </div>

          {/* Fitness Experience Level */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Experience Level</label>
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
              <option value="beginner">Beginner (First HYROX)</option>
              <option value="intermediate">Intermediate (Age Group Competitor)</option>
              <option value="advanced">Advanced (Sub-1:15 Target)</option>
              <option value="elite">Elite / Pro Division</option>
            </select>
          </div>

          {/* Training Intensity */}
          <div>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Target Intensity</label>
            <select value={intensity} onChange={(e) => setIntensity(e.target.value)}>
              <option value="aerobic_base">Aerobic Zone 2 / Recovery</option>
              <option value="moderate">Moderate / Tempo Pacing</option>
              <option value="hard">Hard / Race Target Pace</option>
              <option value="all_out">Maximal / Lactate Test</option>
            </select>
          </div>
        </div>

        {/* Available Equipment Chips */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Equipment Available for this Workout:
            </label>
            <Link href="/athlete/equipment" style={{ fontSize: '0.8rem', color: 'var(--teal-primary)' }}>
              Manage Saved Gear →
            </Link>
          </div>

          <div className="chip-group">
            {EQUIPMENT_CATALOG.map((item) => {
              const isSelected = availableEquipment.includes(item.slug);
              return (
                <div
                  key={item.slug}
                  onClick={() => toggleEquipment(item.slug)}
                  className={`chip ${isSelected ? 'selected' : ''}`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Generate Action Button */}
        <div style={{ marginTop: 16 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="primary"
            style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 800, background: 'var(--teal-primary)', color: '#000' }}
          >
            {generating ? 'Synthesizing HYROX Workout...' : '⚡ Generate Adaptive Workout'}
          </button>
        </div>
      </div>

      {/* Generated Workout Display */}
      {workout && (
        <div className="card" style={{ border: '1px solid var(--teal-primary)', marginBottom: 24 }}>
          {savedSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              ✓ Workout saved to your profile!
            </div>
          )}

          {/* Workout Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span className="transfer-badge transfer-high">{workout.structureType.toUpperCase()}</span>
                <span className="transfer-badge transfer-direct">{workout.estimatedDurationMin} MINS</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>{workout.title}</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
                Objective: <strong>{workout.trainingObjective.replace('_', ' ').toUpperCase()}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={handleGenerate} className="secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                🔄 Regenerate
              </button>
              <button onClick={handleSaveWorkout} className="primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                💾 Save Workout
              </button>
              <Link
                href="/athlete/log"
                className="primary"
                style={{ background: 'var(--gold-hyrox)', color: '#000', padding: '8px 14px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                ▶ Start & Log
              </Link>
            </div>
          </div>

          {/* Substitution Transparency Banner */}
          {workout.substitutionsSummary?.length > 0 && (
            <div style={{ padding: 12, background: 'rgba(25, 182, 160, 0.08)', borderRadius: 6, border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-primary)' }}>
                Intelligent Substitutions Applied:
              </span>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {workout.substitutionsSummary.map((sub, i) => (
                  <li key={i}>
                    <strong>{sub.officialStation.replace('_', ' ').toUpperCase()}</strong> substituted with{' '}
                    <span style={{ color: 'var(--text-primary)' }}>{sub.substituteName}</span> ({sub.transferScore}% Transfer).{' '}
                    <em>{sub.rationale}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warmup */}
          <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-navy)', borderRadius: 6 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--gold-hyrox)' }}>🔥 Warm-Up Protocol</h4>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {workout.warmupProtocol}
            </div>
          </div>

          {/* Main Workout Exercises */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '1rem' }}>⚡ Main Training Sequence</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {workout.workoutBlocks.map((block, idx) => (
                <div key={idx} className="workout-block">
                  <div className="workout-block-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--teal-primary)' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        {block.exerciseName}
                      </span>
                      {block.isSubstitution && (
                        <span className="transfer-badge transfer-moderate" style={{ fontSize: '0.7rem' }}>
                          Substituted
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => openSwapDrawer(idx, block.exerciseName)}
                      className="secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                      🔄 Swap Movement
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.84rem', margin: '6px 0' }}>
                    {block.distanceMeters && <div><strong>Distance:</strong> {block.distanceMeters}m</div>}
                    {block.sets && <div><strong>Sets:</strong> {block.sets}</div>}
                    {block.reps && <div><strong>Reps:</strong> {block.reps}</div>}
                    {block.durationSec && <div><strong>Duration:</strong> {block.durationSec}s</div>}
                    {block.restSec !== null && <div><strong>Rest:</strong> {block.restSec}s</div>}
                    {block.targetIntensity && <div><strong>Intensity:</strong> {block.targetIntensity}</div>}
                  </div>

                  {block.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      💡 {block.notes}
                    </div>
                  )}

                  {block.substituteReason && (
                    <div style={{ fontSize: '0.76rem', color: 'var(--gold-hyrox)', marginTop: 4 }}>
                      Biomechanical transfer rationale: {block.substituteReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cooldown */}
          <div style={{ padding: 14, background: 'var(--bg-navy)', borderRadius: 6 }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--teal-primary)' }}>❄️ Cool-Down Protocol</h4>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {workout.cooldownProtocol}
            </div>
          </div>
        </div>
      )}

      {/* Exercise Swap Drawer Modal */}
      {swappingBlockIndex !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Choose an Alternative Exercise</h3>
              <button onClick={() => setSwappingBlockIndex(null)} className="secondary" style={{ padding: '4px 10px' }}>✕</button>
            </div>

            <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
              Ranked by biomechanical and cardiovascular transfer to official HYROX stations:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {swapCandidates.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => applySwap(sub)}
                  style={{
                    padding: 12,
                    background: 'var(--bg-navy)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--teal-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {sub.substituteName}
                    </span>
                    <span className="transfer-badge transfer-high">
                      {sub.transferScore}% Transfer
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {sub.rationale}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
