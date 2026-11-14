// RŌXCOACH Data Access Layer Seam
// Encapsulates all Supabase queries, transactions, and data domain models.

import { supabase } from './supabase';
import { parseTime, formatSeconds, LEGS, validateAllLegs } from './format';
import { computeStationScorecard, computeRunSplits, identifyStationWeakness } from './performance';

/**
 * Saves a complete 16-leg HYROX session atomically with rollback protection.
 * Prevents orphaned session rows if station splits fail to insert.
 */
export async function saveWorkoutSession({
  athleteId,
  sessionDate,
  category = 'training',
  rpe = 8,
  splits = {},
}) {
  if (!athleteId) throw new Error('Athlete ID is required to save a workout.');

  const validation = validateAllLegs(splits);
  if (!validation.isValid) {
    const errorDetails = Object.values(validation.errors).join('; ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  // Parse and calculate totals
  const parsedLegs = {};
  let totalTimeSec = 0;
  for (const leg of LEGS) {
    const sec = parseTime(splits[leg.leg]);
    parsedLegs[leg.leg] = sec;
    totalTimeSec += sec;
  }

  // 1. Insert session record
  // Supports modern category/rpe columns with graceful fallback if migration not yet applied
  const sessionPayload = {
    athlete_id: athleteId,
    session_date: sessionDate,
    category,
    rpe: Number(rpe) || 8,
    type: category === 'full_simulation' ? 'race' : 'training',
    total_time_sec: totalTimeSec,
  };

  let sessionData = null;
  const { data: inserted, error: sessionErr } = await supabase
    .from('sessions')
    .insert(sessionPayload)
    .select('id, session_date, total_time_sec')
    .single();

  if (sessionErr) {
    // If category or rpe column does not exist yet in an unmigrated Supabase instance
    if (sessionErr.message?.includes('column') || sessionErr.code === '42703') {
      const fallbackPayload = {
        athlete_id: athleteId,
        session_date: sessionDate,
        type: category === 'full_simulation' ? 'race' : 'training',
        total_time_sec: totalTimeSec,
      };
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('sessions')
        .insert(fallbackPayload)
        .select('id, session_date, total_time_sec')
        .single();
      if (fallbackErr) throw fallbackErr;
      sessionData = fallbackData;
    } else {
      throw sessionErr;
    }
  } else {
    sessionData = inserted;
  }

  // 2. Prepare 16 station result rows
  const stationRows = LEGS.map((leg) => ({
    session_id: sessionData.id,
    leg: leg.leg,
    time_sec: parsedLegs[leg.leg],
  }));

  // 3. Insert station splits with rollback guard
  const { error: stationErr } = await supabase
    .from('station_results')
    .insert(stationRows);

  if (stationErr) {
    // Atomic rollback: remove orphaned session record
    await supabase.from('sessions').delete().eq('id', sessionData.id);
    throw new Error(`Failed to save station splits: ${stationErr.message}. Session was rolled back.`);
  }

  return {
    session: sessionData,
    totalTimeSec,
    formattedTotal: formatSeconds(totalTimeSec),
  };
}

/**
 * Loads all data required for the Athlete Dashboard:
 * Sessions, incoming coach connection requests, last-5 progression trend, and Personal Best.
 */
export async function getAthleteDashboardData(athleteId) {
  if (!athleteId) throw new Error('Athlete ID is required.');

  const [{ data: sessions, error: sErr }, { data: requests, error: rErr }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, session_date, category, rpe, type, total_time_sec, created_at, station_results(leg, time_sec)')
      .eq('athlete_id', athleteId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('coach_athletes')
      .select('coach_id, status, created_at, profiles!coach_athletes_coach_id_fkey(full_name, email)')
      .eq('athlete_id', athleteId)
      .eq('status', 'pending'),
  ]);

  if (sErr) throw sErr;
  if (rErr) throw rErr;

  const validSessions = (sessions || []).filter((s) => s.total_time_sec != null);

  const personalBest = validSessions.length > 0
    ? Math.min(...validSessions.map((s) => s.total_time_sec))
    : null;

  // Compute athlete's own last-5 progression trend (oldest to newest)
  const recentFive = validSessions.slice(0, 5).reverse();
  const trend = recentFive.map((s, idx) => {
    const prev = recentFive[idx - 1];
    let changeFormatted = '—';
    let isFaster = false;

    if (prev && prev.total_time_sec) {
      const diff = s.total_time_sec - prev.total_time_sec;
      const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
      changeFormatted = `${sign}${formatSeconds(Math.abs(diff))}`;
      isFaster = diff < 0;
    }

    return {
      id: s.id,
      session_date: s.session_date,
      category: s.category || 'Simulation',
      rpe: s.rpe,
      total_time_sec: s.total_time_sec,
      formattedTotal: formatSeconds(s.total_time_sec),
      changeFormatted,
      isFaster,
      isBaseline: idx === 0,
    };
  });

  return {
    sessions: sessions || [],
    requests: requests || [],
    trend,
    personalBest,
    formattedPersonalBest: formatSeconds(personalBest),
    totalCompleted: validSessions.length,
  };
}

/**
 * Responds to a coach connection request (Accept or Decline).
 */
export async function respondToCoachRequest({ coachId, athleteId, accept }) {
  if (accept) {
    const { error } = await supabase
      .from('coach_athletes')
      .update({ status: 'accepted' })
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('coach_athletes')
      .delete()
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId);
    if (error) throw error;
  }
}

/**
 * Deletes a session and its cascading station results.
 */
export async function deleteWorkoutSession(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

/**
 * Loads all data required for the Coach Command Centre:
 * Roster of athletes, last sessions, performance deltas, and Attention Required alerts.
 */
export async function getCoachDashboardData(coachId) {
  if (!coachId) throw new Error('Coach ID is required.');

  const { data: links, error: linkErr } = await supabase
    .from('coach_athletes')
    .select('athlete_id, status, created_at, profiles!coach_athletes_athlete_id_fkey(full_name, email)')
    .eq('coach_id', coachId);

  if (linkErr) throw linkErr;

  const acceptedIds = (links || []).filter((l) => l.status === 'accepted').map((l) => l.athlete_id);
  const sessionsByAthlete = {};

  if (acceptedIds.length > 0) {
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('athlete_id, session_date, category, rpe, total_time_sec')
      .in('athlete_id', acceptedIds)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (sessErr) throw sessErr;

    for (const s of sessions || []) {
      if (!sessionsByAthlete[s.athlete_id]) {
        sessionsByAthlete[s.athlete_id] = [];
      }
      sessionsByAthlete[s.athlete_id].push(s);
    }
  }

  // Compile roster with deltas
  const roster = (links || []).map((l) => {
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

  const activeAthletes = roster.filter((r) => r.status === 'accepted');
  const pendingAthletes = roster.filter((r) => r.status === 'pending');

  // Compile Attention Required signals
  const attentionItems = [];
  pendingAthletes.forEach((p) => {
    attentionItems.push({
      type: 'pending',
      title: `${p.profiles?.full_name || p.profiles?.email} invitation pending`,
      desc: 'Awaiting athlete approval to share simulation splits.',
    });
  });

  activeAthletes.forEach((a) => {
    if (a.daysSinceLast != null && a.daysSinceLast >= 7) {
      attentionItems.push({
        type: 'inactive',
        title: `${a.profiles?.full_name || 'Athlete'} missed training`,
        desc: `${a.daysSinceLast} days without logged workouts. Check on recovery or schedule.`,
      });
    } else if (a.deltaSec != null && a.deltaSec < 0) {
      attentionItems.push({
        type: 'progress',
        title: `${a.profiles?.full_name || 'Athlete'} pace breakthrough`,
        desc: `Improved by ${formatSeconds(Math.abs(a.deltaSec))} in their latest simulation.`,
      });
    }
  });

  return {
    roster,
    activeAthletes,
    pendingAthletes,
    attentionItems,
  };
}

/**
 * Issues an athlete roster request by email.
 */
export async function requestAthleteByEmail(email) {
  const { data, error } = await supabase.rpc('request_athlete', { p_email: email.trim() });
  if (error) throw error;
  return data; // 'requested' | 'not_found' | 'not_allowed'
}

/**
 * Removes an athlete from the coach's roster.
 */
export async function removeAthleteLink({ coachId, athleteId }) {
  const { error } = await supabase
    .from('coach_athletes')
    .delete()
    .eq('coach_id', coachId)
    .eq('athlete_id', athleteId);
  if (error) throw error;
}

/**
 * Loads detail analytics for a specific athlete:
 * Profile, full session history, 8-station scorecard, running engine, and weakness diagnosis.
 */
export async function getCoachAthleteDetailData(athleteId) {
  if (!athleteId) throw new Error('Athlete ID is required.');

  const [{ data: athlete, error: aErr }, { data: sessions, error: sErr }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', athleteId)
      .single(),
    supabase
      .from('sessions')
      .select('id, session_date, category, rpe, type, total_time_sec, station_results(leg, time_sec)')
      .eq('athlete_id', athleteId)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (aErr) throw aErr;
  if (sErr) throw sErr;

  const validSessions = (sessions || []).filter((s) => s.total_time_sec != null);
  const latestSession = validSessions[0] || null;
  const previousSession = validSessions[1] || null;

  const scorecard = computeStationScorecard(latestSession, previousSession);
  const runSplits = computeRunSplits(latestSession);
  const primaryWeakness = identifyStationWeakness(scorecard);

  const personalBest = validSessions.length > 0
    ? Math.min(...validSessions.map((s) => s.total_time_sec))
    : null;

  const trend = validSessions.slice(0, 5).reverse();

  return {
    athlete,
    sessions: sessions || [],
    scorecard,
    runSplits,
    primaryWeakness,
    personalBest,
    formattedPersonalBest: formatSeconds(personalBest),
    trend,
    totalCompleted: validSessions.length,
  };
}

/**
 * ==============================================================================
 * STAGE 2: ATHLETE EQUIPMENT & WORKOUT PERSISTENCE SEAM
 * ==============================================================================
 */

/**
 * Retrieves the athlete's confirmed equipment inventory.
 * Falls back safely to localStorage if table is not yet provisioned in remote DB.
 */
export async function getAthleteEquipment(athleteId) {
  if (!athleteId) return [];

  try {
    const { data, error } = await supabase
      .from('athlete_equipment')
      .select('equipment_slug, display_name, category, quantity, load_spec, source, is_active')
      .eq('athlete_id', athleteId)
      .eq('is_active', true);

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('athlete_equipment remote table query failed, falling back to local state:', err);
  }

  // Graceful client fallback
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`rox_equipment_${athleteId}`);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore JSON error
    }
  }

  // Default initial minimal set: running shoes and bodyweight
  return [
    { equipment_slug: 'bodyweight', display_name: 'Bodyweight Only', category: 'minimal', quantity: 1, load_spec: 'Bodyweight' },
    { equipment_slug: 'running_shoes', display_name: 'Running Shoes', category: 'minimal', quantity: 1, load_spec: 'Standard' },
  ];
}

/**
 * Saves or updates the athlete's equipment inventory.
 */
export async function saveAthleteEquipment({ athleteId, equipment = [] }) {
  if (!athleteId) throw new Error('Athlete ID is required.');

  // Always sync to client storage immediately for zero-friction offline/preview capability
  if (typeof window !== 'undefined') {
    localStorage.setItem(`rox_equipment_${athleteId}`, JSON.stringify(equipment));
  }

  try {
    // Attempt upsert to Supabase
    const rows = equipment.map((item) => ({
      athlete_id: athleteId,
      equipment_slug: item.equipment_slug,
      display_name: item.display_name,
      category: item.category || 'standard',
      quantity: item.quantity || 1,
      load_spec: item.load_spec || '',
      source: item.source || 'manual',
      is_active: true,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from('athlete_equipment')
        .upsert(rows, { onConflict: 'athlete_id, equipment_slug' });

      if (error && !error.message?.includes('does not exist')) {
        console.warn('Upsert to athlete_equipment encountered error:', error);
      }
    }
  } catch (err) {
    console.warn('saveAthleteEquipment remote error:', err);
  }

  return equipment;
}

/**
 * Saves a generated or customized workout template to the database.
 */
export async function saveGeneratedWorkout({ creatorId, workout }) {
  if (!workout) throw new Error('Workout object is required.');

  // Cache locally
  if (typeof window !== 'undefined') {
    try {
      const key = `rox_saved_workouts_${creatorId || 'guest'}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = [workout, ...existing.filter((w) => w.id !== workout.id)];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to cache workout locally:', e);
    }
  }

  try {
    const { data: inserted, error } = await supabase
      .from('workouts')
      .insert({
        creator_id: creatorId || null,
        title: workout.title,
        training_objective: workout.trainingObjective,
        structure_type: workout.structureType,
        estimated_duration_min: workout.estimatedDurationMin,
        warmup_protocol: workout.warmupProtocol,
        cooldown_protocol: workout.cooldownProtocol,
        is_ai_generated: true,
        generation_params: workout.generationParams || {},
      })
      .select('id')
      .single();

    if (!error && inserted && workout.workoutBlocks?.length > 0) {
      const exercises = workout.workoutBlocks.map((b, i) => ({
        workout_id: inserted.id,
        custom_exercise_name: b.exerciseName,
        block_index: b.blockIndex || 1,
        order_index: b.orderIndex || i + 1,
        sets: b.sets || null,
        reps: b.reps || null,
        distance_m: b.distanceMeters || null,
        duration_sec: b.durationSec || null,
        rest_sec: b.restSec || null,
        target_intensity: b.targetIntensity || null,
        notes: b.notes || null,
        is_substitution: !!b.isSubstitution,
        substitute_reason: b.substituteReason || null,
      }));

      await supabase.from('workout_exercises').insert(exercises);
      return { ...workout, id: inserted.id };
    }
  } catch (err) {
    console.warn('saveGeneratedWorkout remote table query failed, preserved in local cache:', err);
  }

  return workout;
}

/**
 * Retrieves saved workouts for the user.
 */
export async function getSavedWorkouts(userId) {
  let workouts = [];

  try {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, title, training_objective, structure_type, estimated_duration_min, warmup_protocol, cooldown_protocol, created_at')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      workouts = data;
    }
  } catch (err) {
    console.warn('getSavedWorkouts remote query failed:', err);
  }

  // Merge with local storage
  if (typeof window !== 'undefined') {
    try {
      const key = `rox_saved_workouts_${userId || 'guest'}`;
      const local = JSON.parse(localStorage.getItem(key) || '[]');
      const remoteIds = new Set(workouts.map((w) => w.id));
      const combined = [...workouts, ...local.filter((l) => !remoteIds.has(l.id))];
      return combined;
    } catch {
      // Return remote if parse fails
    }
  }

  return workouts;
}

/**
 * Viral Growth Loop: Athlete invites coach by email address.
 * Pre-approves coach access if coach exists, or prepares direct signup invite link.
 */
export async function inviteCoachByEmail(coachEmail) {
  if (!coachEmail || !coachEmail.includes('@')) {
    throw new Error('Please enter a valid coach email address.');
  }

  try {
    const { data, error } = await supabase.rpc('invite_coach_by_athlete', {
      p_coach_email: coachEmail.trim().toLowerCase(),
    });

    if (error) throw error;
    return data; // 'connected' or 'coach_not_registered'
  } catch (err) {
    // If RPC does not yet exist in Supabase instance, simulate graceful onboarding response
    console.warn('invite_coach_by_athlete RPC fallback:', err);
    return 'coach_not_registered';
  }
}
