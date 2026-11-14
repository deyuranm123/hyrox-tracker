/**
 * RŌXCOACH Adaptive HYROX Workout Generator Engine
 *
 * Synthesizes balanced, objective-driven HYROX training sessions
 * tailored to an athlete's exact equipment, space, experience, and duration.
 */

import { OFFICIAL_STATIONS } from './taxonomy.js';
import { resolveStationOrSubstitute } from './substitution-engine.js';

/**
 * Standard warm-up generator tailored to workout intensity & duration.
 */
function buildWarmup(durationMin) {
  if (durationMin <= 20) {
    return '4 minutes: 2 min light jog/march + 10 bodyweight squats + 10 arm circles + 10 alternating lunges.';
  }
  return `8-10 minutes progressive prep:
- 3 min easy aerobic warm-up (jog, bike, or high knees)
- 2 rounds: 10 bodyweight squats, 8 inchworms to push-up, 10 alternating reverse lunges, 10 band pull-aparts
- Specific activation: 2 x 30s station rehearsal at 60% race pace
- Neural prep: 3 x 20m acceleration strides with 30s recovery.`;
}

/**
 * Standard cool-down protocol.
 */
function buildCooldown() {
  return `5-7 minutes recovery & lactate flush:
- 3 min very easy walk/jog to drop heart rate below 120 bpm
- 60s Couch Stretch each side (quads & hip flexors)
- 60s Pigeon Stretch each side (glute & hip rotators)
- 60s Child's Pose with lateral lat reach to decompress thoracic spine.`;
}

/**
 * Generates a structured HYROX workout using deterministic sports-science rules.
 */
export function generateAdaptiveWorkout({
  objective = 'compromised_running',
  availableEquipment = ['bodyweight', 'running_shoes'],
  availableSpace = 'open_floor',
  durationMin = 45,
  experienceLevel = 'intermediate',
  intensity = 'hard',
  division = 'open_men',
  preferredStructure = null,
}) {
  const safeEquipment = Array.isArray(availableEquipment) ? availableEquipment : ['bodyweight', 'running_shoes'];
  const safeSpace = availableSpace || 'open_floor';
  const safeDuration = Number(durationMin) || 45;

  // Decide structure type if not explicitly requested
  let structureType = preferredStructure;
  if (!structureType) {
    if (objective === 'compromised_running') structureType = 'compromised_running';
    else if (objective === 'lactate_tolerance') structureType = safeDuration <= 30 ? 'emom' : 'intervals';
    else if (objective === 'aerobic_power') structureType = 'running_intervals';
    else if (objective === 'strength_conditioning') structureType = 'strength_conditioning';
    else if (objective === 'full_simulation') structureType = 'hyrox_simulation';
    else structureType = 'circuit';
  }

  // Resolve all 8 stations against equipment
  const resolvedStations = OFFICIAL_STATIONS.map(st =>
    resolveStationOrSubstitute(st.slug, safeEquipment, safeSpace)
  );

  let title = '';
  let workoutBlocks = [];
  const substitutionsSummary = [];

  // Track substitutions for transparent reporting
  resolvedStations.forEach(res => {
    if (!res.isOfficial) {
      substitutionsSummary.push({
        officialStation: res.stationSlug,
        substituteName: res.name,
        transferScore: res.transferScore,
        transferRating: res.transferRating,
        rationale: res.rationale,
      });
    }
  });

  // Build specific workout types based on structureType
  if (structureType === 'compromised_running') {
    title = `HYROX Compromised Pacing Engine (${safeDuration} Min)`;
    
    // Choose 3-4 stations to alternate with 1km or 800m runs
    const cycleCount = safeDuration >= 60 ? 4 : safeDuration >= 40 ? 3 : 2;
    const selected = [
      resolvedStations[1], // Sled Push or alternative
      resolvedStations[4], // Rowing or alternative
      resolvedStations[6], // Sandbag Lunges or alternative
      resolvedStations[7], // Wall Balls or alternative
    ].slice(0, cycleCount);

    selected.forEach((station, idx) => {
      // 1. Compromised Run Leg
      workoutBlocks.push({
        blockIndex: idx + 1,
        orderIndex: 1,
        exerciseName: 'Compromised Running Block',
        distanceMeters: 800,
        sets: 1,
        reps: 1,
        durationSec: null,
        restSec: 0,
        targetIntensity: 'Aerobic Race Pace (RPE 7-8)',
        isSubstitution: false,
        notes: `Run immediately after ${station.name}. Hold pace flat without walking in first 200m.`,
      });

      // 2. Station Leg
      workoutBlocks.push({
        blockIndex: idx + 1,
        orderIndex: 2,
        exerciseName: station.name,
        distanceMeters: null,
        sets: 1,
        reps: station.isOfficial ? (station.distanceOrReps.includes('m') ? parseInt(station.distanceOrReps) : 50) : 25,
        durationSec: null,
        restSec: idx < cycleCount - 1 ? 60 : 0,
        targetIntensity: 'Sub-threshold to Lactate Peak (RPE 8-9)',
        isSubstitution: !station.isOfficial,
        substituteReason: !station.isOfficial ? station.rationale : null,
        notes: station.instructions,
      });
    });
  } else if (structureType === 'emom') {
    title = `HYROX Lactate Threshold EMOM (${safeDuration} Min)`;
    const rounds = Math.min(6, Math.floor(safeDuration / 4));

    const s1 = resolvedStations[0]; // SkiErg or sub
    const s2 = resolvedStations[3]; // BBJ or sub
    const s3 = resolvedStations[7]; // Wall Balls or sub

    workoutBlocks = [
      {
        blockIndex: 1,
        orderIndex: 1,
        exerciseName: `Minute 1: ${s1.name}`,
        sets: rounds,
        reps: s1.isOfficial ? 15 : 20,
        durationSec: 45,
        restSec: 15,
        targetIntensity: 'Hard Aerobic (40s work / 20s rest)',
        isSubstitution: !s1.isOfficial,
        substituteReason: !s1.isOfficial ? s1.rationale : null,
        notes: s1.instructions,
      },
      {
        blockIndex: 1,
        orderIndex: 2,
        exerciseName: `Minute 2: ${s2.name}`,
        sets: rounds,
        reps: 12,
        durationSec: 45,
        restSec: 15,
        targetIntensity: 'Explosive Cadence',
        isSubstitution: !s2.isOfficial,
        substituteReason: !s2.isOfficial ? s2.rationale : null,
        notes: s2.instructions,
      },
      {
        blockIndex: 1,
        orderIndex: 3,
        exerciseName: `Minute 3: ${s3.name}`,
        sets: rounds,
        reps: 18,
        durationSec: 45,
        restSec: 15,
        targetIntensity: 'Unbroken Rhythm',
        isSubstitution: !s3.isOfficial,
        substituteReason: !s3.isOfficial ? s3.rationale : null,
        notes: s3.instructions,
      },
      {
        blockIndex: 1,
        orderIndex: 4,
        exerciseName: 'Minute 4: Active Aerobic Flush / Rest',
        sets: rounds,
        reps: null,
        durationSec: 60,
        restSec: 60,
        targetIntensity: 'Zone 1 Recovery Walk & Nasal Breathing',
        isSubstitution: false,
        notes: 'Lower heart rate and prepare for the next round.',
      },
    ];
  } else if (structureType === 'amrap') {
    title = `HYROX Capacity AMRAP 20`;
    const sPush = resolvedStations[1];
    const sCarry = resolvedStations[5];
    const sLunge = resolvedStations[6];

    workoutBlocks = [
      {
        blockIndex: 1,
        orderIndex: 1,
        exerciseName: '400m Fast Aerobic Run',
        distanceMeters: 400,
        sets: null,
        reps: 1,
        targetIntensity: 'Threshold Pace (RPE 8)',
        isSubstitution: false,
        notes: 'Quick transition immediately onto station.',
      },
      {
        blockIndex: 1,
        orderIndex: 2,
        exerciseName: sPush.name,
        sets: null,
        reps: sPush.isOfficial ? 25 : 20,
        targetIntensity: 'Heavy Push Driver',
        isSubstitution: !sPush.isOfficial,
        substituteReason: !sPush.isOfficial ? sPush.rationale : null,
        notes: sPush.instructions,
      },
      {
        blockIndex: 1,
        orderIndex: 3,
        exerciseName: sCarry.name,
        sets: null,
        reps: 1,
        distanceMeters: 50,
        targetIntensity: 'Grip & Core Brace',
        isSubstitution: !sCarry.isOfficial,
        substituteReason: !sCarry.isOfficial ? sCarry.rationale : null,
        notes: sCarry.instructions,
      },
      {
        blockIndex: 1,
        orderIndex: 4,
        exerciseName: sLunge.name,
        sets: null,
        reps: 20,
        targetIntensity: 'Unilateral Endurance',
        isSubstitution: !sLunge.isOfficial,
        substituteReason: !sLunge.isOfficial ? sLunge.rationale : null,
        notes: sLunge.instructions,
      },
    ];
  } else {
    // Default Circuit or Station-Specific format
    title = `Adaptive HYROX Conditioning Circuit (${safeDuration} Min)`;
    resolvedStations.slice(0, 5).forEach((station, i) => {
      workoutBlocks.push({
        blockIndex: 1,
        orderIndex: i + 1,
        exerciseName: station.name,
        sets: 3,
        reps: station.isOfficial ? 25 : 15,
        durationSec: 60,
        restSec: 45,
        targetIntensity: 'Sustained HYROX Power',
        isSubstitution: !station.isOfficial,
        substituteReason: !station.isOfficial ? station.rationale : null,
        notes: station.instructions,
      });
    });
  }

  return {
    id: `gen-${Date.now()}`,
    title,
    trainingObjective: objective,
    structureType,
    estimatedDurationMin: safeDuration,
    division,
    experienceLevel,
    intensity,
    warmupProtocol: buildWarmup(safeDuration, objective),
    cooldownProtocol: buildCooldown(objective),
    workoutBlocks,
    substitutionsSummary,
    generationParams: {
      availableEquipment: safeEquipment,
      availableSpace: safeSpace,
      durationMin: safeDuration,
      experienceLevel,
      intensity,
      division,
      timestamp: new Date().toISOString(),
    },
  };
}
