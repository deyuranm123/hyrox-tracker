/**
 * RŌXCOACH HYROX Intelligent Exercise Substitution Engine
 *
 * Evaluates athlete equipment availability, space constraints, and biomechanical
 * overlap to recommend high-transfer alternatives to official HYROX stations.
 */

import { OFFICIAL_STATIONS, SUBSTITUTION_MATRIX } from './taxonomy.js';

/**
 * Calculates weighted biomechanical transfer score (1-100%).
 * 40% Movement Pattern Similarity + 35% Muscular Overlap + 25% Cardiovascular Demand
 */
export function calculateTransferScore({ movementSimilarity, muscularOverlap, cardioDemand }) {
  const score = Math.round(
    0.4 * (movementSimilarity || 0) +
    0.35 * (muscularOverlap || 0) +
    0.25 * (cardioDemand || 0)
  );
  return Math.min(100, Math.max(1, score));
}

/**
 * Determines whether an athlete has all required equipment for a given movement.
 */
export function hasRequiredEquipment(requiredEquipment = [], availableEquipment = []) {
  if (!requiredEquipment || requiredEquipment.length === 0) return true;
  // If the exercise requires bodyweight only or running shoes, it's always accessible
  if (requiredEquipment.every(e => ['bodyweight', 'running_shoes'].includes(e))) return true;

  // Otherwise, athlete must possess at least one of the required items (or all, if multi-equipment)
  return requiredEquipment.some(req => availableEquipment.includes(req));
}

/**
 * Checks if the space available satisfies the exercise requirement.
 * Hierarchy: turf_track > open_floor > compact
 */
export function isSpaceAdequate(requiredSpace = 'compact', availableSpace = 'open_floor') {
  if (requiredSpace === 'compact') return true;
  if (requiredSpace === 'open_floor') return availableSpace !== 'compact';
  if (requiredSpace === 'turf_track') return availableSpace === 'turf_track' || availableSpace === 'outdoor_field';
  return true;
}

/**
 * Finds all valid substitutions for a specified HYROX station, ranked by transfer score.
 */
export function findSubstitutesForStation(
  stationSlug,
  availableEquipment = [],
  availableSpace = 'open_floor'
) {
  const candidates = SUBSTITUTION_MATRIX.filter(sub => sub.originalSlug === stationSlug);

  const matched = candidates.map(sub => {
    const hasEquip = hasRequiredEquipment(sub.equipmentRequired, availableEquipment);
    const hasSpace = isSpaceAdequate(sub.spaceRequired, availableSpace);
    const transferScore = calculateTransferScore(sub);

    return {
      ...sub,
      isFeasible: hasEquip && hasSpace,
      hasEquip,
      hasSpace,
      transferScore,
    };
  });

  // Sort feasible options first, then highest transfer score descending
  return matched.sort((a, b) => {
    if (a.isFeasible && !b.isFeasible) return -1;
    if (!a.isFeasible && b.isFeasible) return 1;
    return b.transferScore - a.transferScore;
  });
}

/**
 * Resolves whether an athlete can perform the official station or needs an intelligent substitute.
 */
export function resolveStationOrSubstitute(
  stationSlug,
  availableEquipment = [],
  availableSpace = 'open_floor'
) {
  const official = OFFICIAL_STATIONS.find(s => s.slug === stationSlug);
  if (!official) return null;

  const canDoOfficial = hasRequiredEquipment(official.equipmentRequired, availableEquipment) &&
                        isSpaceAdequate(official.spaceRequired, availableSpace);

  if (canDoOfficial) {
    return {
      isOfficial: true,
      stationSlug: official.slug,
      name: official.name,
      distanceOrReps: official.officialDistanceOrReps,
      equipmentRequired: official.equipmentRequired,
      instructions: official.instructions,
      safetyConsiderations: official.safetyConsiderations,
      transferScore: 100,
      transferRating: 'direct_equivalent',
      rationale: 'Official HYROX race movement with official equipment.',
    };
  }

  // Find best substitution
  const substitutes = findSubstitutesForStation(stationSlug, availableEquipment, availableSpace);
  const bestSub = substitutes.find(s => s.isFeasible) || substitutes[0];

  if (!bestSub) {
    // Ultimate universal bodyweight fallback
    return {
      isOfficial: false,
      stationSlug: official.slug,
      name: `Bodyweight Conditioning (${official.name} Target)`,
      distanceOrReps: '45-60s Continuous Effort',
      equipmentRequired: ['bodyweight'],
      instructions: 'Perform high-cadence bodyweight squats, lunges, or mountain climbers at maximum steady aerobic output.',
      safetyConsiderations: 'Maintain form under fatigue.',
      transferScore: 65,
      transferRating: 'general_fitness',
      rationale: `Substituted for ${official.name} due to limited equipment/space.`,
    };
  }

  return {
    isOfficial: false,
    stationSlug: official.slug,
    name: bestSub.substituteName,
    substituteSlug: bestSub.substituteSlug,
    distanceOrReps: bestSub.scalingGuidance.split('.')[1]?.trim() || '4 Sets',
    scalingGuidance: bestSub.scalingGuidance,
    equipmentRequired: bestSub.equipmentRequired,
    instructions: bestSub.scalingGuidance,
    safetyConsiderations: 'Perform with controlled pacing; avoid jerky movements.',
    transferScore: bestSub.transferScore,
    transferRating: bestSub.transferRating,
    rationale: bestSub.rationale,
  };
}

/**
 * Audits an athlete's equipment profile across all 8 stations.
 * Returns readiness overview showing which stations can be trained officially vs substituted.
 */
export function auditStationReadiness(availableEquipment = [], availableSpace = 'open_floor') {
  const results = OFFICIAL_STATIONS.map(station => {
    const resolution = resolveStationOrSubstitute(station.slug, availableEquipment, availableSpace);
    return {
      stationSlug: station.slug,
      officialName: station.name,
      isOfficialAccessible: resolution.isOfficial,
      resolvedName: resolution.name,
      transferScore: resolution.transferScore,
      transferRating: resolution.transferRating,
      rationale: resolution.rationale,
    };
  });

  const officialCount = results.filter(r => r.isOfficialAccessible).length;
  const avgTransferScore = Math.round(
    results.reduce((acc, r) => acc + r.transferScore, 0) / results.length
  );

  return {
    results,
    officialCount,
    substitutedCount: 8 - officialCount,
    readinessScorePct: Math.round((officialCount / 8) * 100),
    avgTransferScore,
  };
}
