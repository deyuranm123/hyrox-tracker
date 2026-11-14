/**
 * Stage 2 Core Engine Automated Verification Script
 */

import { OFFICIAL_STATIONS, SUBSTITUTION_MATRIX, EQUIPMENT_CATALOG } from '../lib/ai/taxonomy.js';
import {
  calculateTransferScore,
  hasRequiredEquipment,
  findSubstitutesForStation,
  resolveStationOrSubstitute,
  auditStationReadiness,
} from '../lib/ai/substitution-engine.js';
import { generateAdaptiveWorkout } from '../lib/ai/workout-generator.js';
import { calculatePrescriptionCompliance } from '../lib/data.js';
import { PROGRAMME_TEMPLATES, buildCustomizedProgramme } from '../lib/ai/programme-generator.js';

function runTests() {
  console.log('================================================================');
  console.log('RUNNING RŌXCOACH STAGE 2 ACCEPTANCE & ENGINE TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Taxonomy & Constants
  assert(OFFICIAL_STATIONS.length === 8, '8 Official HYROX stations defined in taxonomy');
  assert(SUBSTITUTION_MATRIX.length >= 15, 'At least 15 high-fidelity substitution mappings present');
  assert(EQUIPMENT_CATALOG.length >= 15, 'Equipment catalog includes specialized, standard, and minimal items');

  // TEST 2: Transfer Score Formula Verification
  // Transfer Score = 0.40 * movementSimilarity + 0.35 * muscularOverlap + 0.25 * cardioDemand
  const testSub = { movementSimilarity: 85, muscularOverlap: 90, cardioDemand: 95 };
  const expectedScore = Math.round(0.4 * 85 + 0.35 * 90 + 0.25 * 95); // 34 + 31.5 + 23.75 = 89.25 => 89
  const actualScore = calculateTransferScore(testSub);
  assert(actualScore === expectedScore, `Transfer score accurately computed (expected ${expectedScore}, got ${actualScore})`);

  // TEST 3: Scenario 1 — Minimal Equipment Athlete (Backpack + Resistance Bands)
  const minimalGear = ['backpack', 'resistance_band', 'running_shoes', 'bodyweight'];
  const audit = auditStationReadiness(minimalGear, 'open_floor');
  assert(audit.officialCount <= 2, `Accurately recognizes missing official gear (${audit.officialCount} official accessible)`);
  assert(audit.avgTransferScore >= 75, `Substitutions maintain high average transfer score (${audit.avgTransferScore}%)`);

  // Test Sled Push substitution with minimal gear
  const sledPushRes = resolveStationOrSubstitute('sled_push', minimalGear, 'open_floor');
  assert(!sledPushRes.isOfficial, 'Sled push flagged as substituted due to missing sled/turf');
  assert(sledPushRes.name.includes('Bear Crawl') || sledPushRes.name.includes('March'), `Appropriate alternative resolved: ${sledPushRes.name}`);
  assert(sledPushRes.transferScore >= 75, `Sled push substitution has high transfer score: ${sledPushRes.transferScore}%`);

  // TEST 4: Adaptive Workout Generation
  const generatedWorkout = generateAdaptiveWorkout({
    objective: 'compromised_running',
    availableEquipment: minimalGear,
    availableSpace: 'open_floor',
    durationMin: 45,
    preferredStructure: 'compromised_running',
  });

  assert(generatedWorkout.title.includes('HYROX'), `Workout title properly generated: "${generatedWorkout.title}"`);
  assert(generatedWorkout.workoutBlocks.length > 0, `Workout contains ${generatedWorkout.workoutBlocks.length} structured blocks`);
  assert(generatedWorkout.substitutionsSummary.length > 0, 'Substitutions summary properly generated for athlete transparency');
  assert(generatedWorkout.warmupProtocol.length > 0, 'Warmup protocol generated');
  assert(generatedWorkout.cooldownProtocol.length > 0, 'Cooldown protocol generated');

  // TEST 5: Scenario 3 — Exercise Replacement / Swapping
  const sledSubs = findSubstitutesForStation('sled_push', minimalGear, 'open_floor');
  assert(sledSubs.length >= 2, `Found ${sledSubs.length} alternative options for sled push`);
  assert(sledSubs[0].transferScore >= sledSubs[1].transferScore, 'Substitutions properly ranked by transfer score descending');

  // TEST 6: Scenario 4 & 6 — Prescribed vs Completed Compliance Engine
  const testPrescriptions = [
    { id: 'p1', scheduled_date: '2026-11-10', status: 'completed' },
    { id: 'p2', scheduled_date: '2026-11-12', status: 'completed' },
    { id: 'p3', scheduled_date: '2026-11-14', status: 'completed' },
    { id: 'p4', scheduled_date: '2026-11-14', status: 'published' }, // 3 completed out of 4 due => 75%
    { id: 'p5', scheduled_date: '2026-11-20', status: 'published' }, // future date -> not counted in due
    { id: 'p6', scheduled_date: '2026-11-11', status: 'cancelled' }, // cancelled -> ignored
  ];

  const compliance = calculatePrescriptionCompliance(testPrescriptions);
  assert(compliance.dueCount === 4, `Due count correctly calculated (expected 4, got ${compliance.dueCount})`);
  assert(compliance.completedCount === 3, `Completed count correctly calculated (expected 3, got ${compliance.completedCount})`);
  assert(compliance.upcomingCount === 1, `Upcoming future prescriptions isolated (expected 1, got ${compliance.upcomingCount})`);
  assert(compliance.compliancePct === 75, `Compliance rate correctly calculated: ${compliance.compliancePct}% (expected 75%)`);

  // TEST 7: Scenario 9 — Multi-Week Training Programme Generation
  assert(PROGRAMME_TEMPLATES.length === 4, `4 Foundational programme templates defined (${PROGRAMME_TEMPLATES.length})`);
  const foundation12Wk = buildCustomizedProgramme({
    templateCategory: 'foundation_12wk',
    athleteAbility: 'intermediate',
    availableDaysPerWeek: 4,
    availableEquipment: ['bodyweight', 'running_shoes', 'dumbbells'],
  });

  assert(foundation12Wk.weeks.length === 12, '12-week programme contains exactly 12 periodized weeks');
  assert(foundation12Wk.deloadWeeks.includes(4) && foundation12Wk.deloadWeeks.includes(8), 'Scheduled recovery deloads built on weeks 4 & 8');
  assert(foundation12Wk.weeks[3].isDeload === true, 'Week 4 properly flagged as deload week');
  assert(foundation12Wk.weeks[3].sessions.length === 4, 'Deload week contains appropriate session count (4)');

  const beginner8Wk = buildCustomizedProgramme({
    templateCategory: 'beginner_8wk',
    athleteAbility: 'beginner',
    availableDaysPerWeek: 3,
  });
  assert(beginner8Wk.weeks.length === 8, '8-week beginner programme contains exactly 8 weeks');

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} tests passed successfully.`);
  console.log('================================================================\n');
}

runTests();
