/**
 * RŌXCOACH Periodized Training Programme Engine
 *
 * Generates structured 8-week and 12-week HYROX training programmes
 * with progressive volume, scheduled deload weeks, and equipment adaptivity.
 */

import { generateAdaptiveWorkout } from './workout-generator.js';

export const PROGRAMME_TEMPLATES = [
  {
    id: 'prog-beginner-8wk',
    category: 'beginner_8wk',
    title: 'HYROX Beginner: 8-Week Foundation & Movement Onboarding',
    durationWeeks: 8,
    targetAudience: 'Athletes tackling their first HYROX event or building baseline aerobic conditioning.',
    sessionsPerWeek: 3,
    description: 'Focuses on aerobic base building, movement literacy across all 8 stations, and gentle introduction to compromised running without excessive lactate fatigue.',
    deloadWeeks: [4, 8],
    weeks: [
      { weekNumber: 1, focusTheme: 'Movement Literacy & Aerobic Baseline', isDeload: false, targetVolumeKm: 6 },
      { weekNumber: 2, focusTheme: 'Aerobic Pacing & Sled / Wall Ball Mechanics', isDeload: false, targetVolumeKm: 8 },
      { weekNumber: 3, focusTheme: 'Station Pacing & Transition Awareness', isDeload: false, targetVolumeKm: 10 },
      { weekNumber: 4, focusTheme: 'Recovery & Deload (Technique & Mobility)', isDeload: true, targetVolumeKm: 6 },
      { weekNumber: 5, focusTheme: 'Compromised Running Introduction (800m intervals)', isDeload: false, targetVolumeKm: 12 },
      { weekNumber: 6, focusTheme: 'Station Lactate Tolerance & Breathing Control', isDeload: false, targetVolumeKm: 14 },
      { weekNumber: 7, focusTheme: 'Half Simulation & Pacing Benchmark', isDeload: false, targetVolumeKm: 10 },
      { weekNumber: 8, focusTheme: 'Taper & Movement Rehearsal', isDeload: true, targetVolumeKm: 6 },
    ],
  },
  {
    id: 'prog-foundation-12wk',
    category: 'foundation_12wk',
    title: 'HYROX Foundation: 12-Week Aerobic Base & Lactate Capacity',
    durationWeeks: 12,
    targetAudience: 'Intermediate athletes looking to build substantial aerobic capacity and muscular endurance.',
    sessionsPerWeek: 4,
    description: 'Systematic progression covering aerobic base, compromised pacing blocks, station lactate shuttling, and progressive overload with scheduled recovery deloads on weeks 4, 8, and 12.',
    deloadWeeks: [4, 8, 12],
    weeks: [
      { weekNumber: 1, focusTheme: 'Aerobic Foundation & Station Quality', isDeload: false, targetVolumeKm: 12 },
      { weekNumber: 2, focusTheme: 'Station Push-Pull Endurance', isDeload: false, targetVolumeKm: 14 },
      { weekNumber: 3, focusTheme: 'Compromised Pacing Block 1', isDeload: false, targetVolumeKm: 16 },
      { weekNumber: 4, focusTheme: 'Deload 1: Recovery Flush & Mechanics', isDeload: true, targetVolumeKm: 10 },
      { weekNumber: 5, focusTheme: 'Lactate Threshold Expansion', isDeload: false, targetVolumeKm: 18 },
      { weekNumber: 6, focusTheme: 'Heavy Station Overload & Lunges', isDeload: false, targetVolumeKm: 20 },
      { weekNumber: 7, focusTheme: 'Compromised Running Volume 2', isDeload: false, targetVolumeKm: 22 },
      { weekNumber: 8, focusTheme: 'Deload 2: Mid-Cycle Re-calibration', isDeload: true, targetVolumeKm: 12 },
      { weekNumber: 9, focusTheme: 'Race Pace Specificity & Stations', isDeload: false, targetVolumeKm: 24 },
      { weekNumber: 10, focusTheme: 'Full Simulation Benchmark Test', isDeload: false, targetVolumeKm: 20 },
      { weekNumber: 11, focusTheme: 'Fine-Tuning Transitions & Cadence', isDeload: false, targetVolumeKm: 16 },
      { weekNumber: 12, focusTheme: 'Taper & Nervous System Priming', isDeload: true, targetVolumeKm: 10 },
    ],
  },
  {
    id: 'prog-performance-12wk',
    category: 'performance_12wk',
    title: 'HYROX Performance: 12-Week Competitive Pacing Optimization',
    durationWeeks: 12,
    targetAudience: 'Experienced racers aiming for sub-1:15 Open or Pro Division qualification.',
    sessionsPerWeek: 5,
    description: 'High-density training program targeting lactate turnpoint, sub-4:15 compromised run pacing, station transition speeds, and high-intensity fatigue resistance.',
    deloadWeeks: [4, 8, 12],
    weeks: [
      { weekNumber: 1, focusTheme: 'Threshold Calibration & Baseline Tests', isDeload: false, targetVolumeKm: 20 },
      { weekNumber: 2, focusTheme: 'Heavy Sled & Wall Ball Fatigue Rehearsal', isDeload: false, targetVolumeKm: 24 },
      { weekNumber: 3, focusTheme: 'High-Cadence Compromised Intervals', isDeload: false, targetVolumeKm: 28 },
      { weekNumber: 4, focusTheme: 'Active Deload 1: Aerobic Flush & Mobility', isDeload: true, targetVolumeKm: 16 },
      { weekNumber: 5, focusTheme: 'Peak Lactate Tolerance & SkiErg Transitions', isDeload: false, targetVolumeKm: 30 },
      { weekNumber: 6, focusTheme: 'Sub-Threshold Compromised 1km Loops', isDeload: false, targetVolumeKm: 32 },
      { weekNumber: 7, focusTheme: 'Station Overload (Pro Division Loads)', isDeload: false, targetVolumeKm: 34 },
      { weekNumber: 8, focusTheme: 'Active Deload 2: Movement Efficiency', isDeload: true, targetVolumeKm: 18 },
      { weekNumber: 9, focusTheme: 'Race Simulation 1 (12-Leg Benchmark)', isDeload: false, targetVolumeKm: 30 },
      { weekNumber: 10, focusTheme: 'Race Simulation 2 (Full 16-Leg Rehearsal)', isDeload: false, targetVolumeKm: 28 },
      { weekNumber: 11, focusTheme: 'Pre-Race Taper & Transition Drills', isDeload: false, targetVolumeKm: 18 },
      { weekNumber: 12, focusTheme: 'Race Week Taper: Supercompensation', isDeload: true, targetVolumeKm: 10 },
    ],
  },
  {
    id: 'prog-race-prep-8wk',
    category: 'race_prep_8wk',
    title: 'HYROX Race Preparation: 8-Week Peak Rehearsal & Taper',
    durationWeeks: 8,
    targetAudience: 'Athletes within 2 months of their target race date.',
    sessionsPerWeek: 4,
    description: 'Direct race rehearsal, pacing discipline, transition conservation, and a scientifically engineered 14-day taper.',
    deloadWeeks: [4, 8],
    weeks: [
      { weekNumber: 1, focusTheme: 'Race Pace Familiarization (800m repeats)', isDeload: false, targetVolumeKm: 18 },
      { weekNumber: 2, focusTheme: 'Fatigued Wall Balls & Sandbag Strategy', isDeload: false, targetVolumeKm: 22 },
      { weekNumber: 3, focusTheme: 'Compromised Running Lock-In', isDeload: false, targetVolumeKm: 24 },
      { weekNumber: 4, focusTheme: 'Mid-Prep Deload & Form Check', isDeload: true, targetVolumeKm: 14 },
      { weekNumber: 5, focusTheme: 'Official Half-Race Rehearsal', isDeload: false, targetVolumeKm: 20 },
      { weekNumber: 6, focusTheme: 'Full Simulation Benchmark Test', isDeload: false, targetVolumeKm: 22 },
      { weekNumber: 7, focusTheme: 'Taper Phase 1 (40% Volume Reduction)', isDeload: false, targetVolumeKm: 14 },
      { weekNumber: 8, focusTheme: 'Race Week Priming & Carb Loading Protocol', isDeload: true, targetVolumeKm: 8 },
    ],
  },
];

/**
 * Builds a customized training programme adapted to an athlete's equipment and days.
 */
export function buildCustomizedProgramme({
  templateCategory = 'foundation_12wk',
  athleteAbility = 'intermediate',
  availableDaysPerWeek = 4,
  availableEquipment = ['bodyweight', 'running_shoes'],
  availableSpace = 'open_floor',
}) {
  const template = PROGRAMME_TEMPLATES.find((t) => t.category === templateCategory) || PROGRAMME_TEMPLATES[1];

  const weeks = template.weeks.map((wk) => {
    // Generate sessions for the week
    const sessionCount = Math.min(Number(availableDaysPerWeek) || 4, template.sessionsPerWeek);
    const sessions = [];

    for (let day = 1; day <= sessionCount; day++) {
      let objective = 'compromised_running';
      if (wk.isDeload) objective = 'aerobic_power';
      else if (day === 2) objective = 'lactate_tolerance';
      else if (day === 3) objective = 'strength_conditioning';

      const sampleWorkout = generateAdaptiveWorkout({
        objective,
        durationMin: wk.isDeload ? 30 : 45,
        availableEquipment,
        availableSpace,
        experienceLevel: athleteAbility,
      });

      sessions.push({
        dayOfWeek: day,
        title: `Day ${day}: ${sampleWorkout.title}`,
        objective,
        durationMin: sampleWorkout.estimatedDurationMin,
        isDeloadSession: wk.isDeload,
      });
    }

    return {
      ...wk,
      sessions,
    };
  });

  return {
    id: `prog-${Date.now()}`,
    templateCategory: template.category,
    title: template.title,
    durationWeeks: template.durationWeeks,
    description: template.description,
    targetAudience: template.targetAudience,
    athleteAbility,
    availableEquipment,
    availableSpace,
    deloadWeeks: template.deloadWeeks,
    weeks,
    createdAt: new Date().toISOString(),
  };
}
