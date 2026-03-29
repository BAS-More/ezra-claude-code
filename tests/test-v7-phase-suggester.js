#!/usr/bin/env node
'use strict';
const path = require('path');
const { MAX_HIGH_COMPLEXITY_PER_PHASE, MAX_TASKS_PER_PHASE, groupIntoPhases, splitIfOverLimit, calculatePhaseComplexity, validatePhaseOrdering, getPhaseName } = require(path.join(__dirname, '..', 'hooks', 'ezra-phase-suggester.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- Constants ---
test('MAX_HIGH_COMPLEXITY_PER_PHASE is 8', () => { assert(MAX_HIGH_COMPLEXITY_PER_PHASE === 8); });
test('MAX_TASKS_PER_PHASE is 15', () => { assert(MAX_TASKS_PER_PHASE === 15); });

// --- getPhaseName ---
test('getPhaseName is a function', () => { assert(typeof getPhaseName === 'function'); });
test('getPhaseName 1 → Foundation', () => { assert(getPhaseName(1) === 'Foundation'); });
test('getPhaseName 2 → Core Features', () => { assert(getPhaseName(2) === 'Core Features'); });
test('getPhaseName 3 → Frontend & Testing', () => { assert(getPhaseName(3) === 'Frontend & Testing'); });
test('getPhaseName 4 → Deployment & Documentation', () => { assert(getPhaseName(4) === 'Deployment & Documentation'); });
test('getPhaseName 5 → Phase 5', () => { assert(getPhaseName(5) === 'Phase 5'); });
test('getPhaseName 99 → Phase 99', () => { assert(getPhaseName(99) === 'Phase 99'); });

// --- calculatePhaseComplexity ---
test('calculatePhaseComplexity is a function', () => { assert(typeof calculatePhaseComplexity === 'function'); });
test('calculatePhaseComplexity empty → 0', () => { assert(calculatePhaseComplexity([]) === 0); });
test('calculatePhaseComplexity non-array → 0', () => { assert(calculatePhaseComplexity(null) === 0); });
test('calculatePhaseComplexity all low', () => {
  const score = calculatePhaseComplexity([{ complexity: 'low' }, { complexity: 'low' }]);
  assert(typeof score === 'number' && score >= 0 && score <= 100);
});
test('calculatePhaseComplexity all critical > all low', () => {
  const low = calculatePhaseComplexity([{ complexity: 'low' }, { complexity: 'low' }]);
  const crit = calculatePhaseComplexity([{ complexity: 'critical' }, { complexity: 'critical' }]);
  assert(crit > low, `Critical ${crit} should be > low ${low}`);
});
test('calculatePhaseComplexity mixed', () => {
  const score = calculatePhaseComplexity([{ complexity: 'low' }, { complexity: 'high' }, { complexity: 'medium' }]);
  assert(score > 0 && score <= 100);
});

// --- groupIntoPhases ---
test('groupIntoPhases is a function', () => { assert(typeof groupIntoPhases === 'function'); });
test('groupIntoPhases empty → []', () => { assert(JSON.stringify(groupIntoPhases([])) === '[]'); });
test('groupIntoPhases non-array → []', () => { assert(JSON.stringify(groupIntoPhases(null)) === '[]'); });
test('groupIntoPhases basic tasks', () => {
  const tasks = [
    { id: 't1', phase: 1, complexity: 'low' },
    { id: 't2', phase: 1, complexity: 'medium' },
    { id: 't3', phase: 2, complexity: 'high' }
  ];
  const phases = groupIntoPhases(tasks);
  assert(Array.isArray(phases) && phases.length >= 2, `Got ${phases.length} phases`);
  assert(phases[0].phase === 1);
  assert(phases[0].tasks.length >= 2);
});
test('groupIntoPhases adds gate tasks', () => {
  const tasks = [{ id: 't1', phase: 1, complexity: 'low' }];
  const phases = groupIntoPhases(tasks);
  assert(phases[0].gate_task_id, 'Should have gate_task_id');
});
test('groupIntoPhases splits large phases', () => {
  const tasks = [];
  for (let i = 0; i < 20; i++) tasks.push({ id: `t${i}`, phase: 1, complexity: 'high' });
  const phases = groupIntoPhases(tasks);
  assert(phases.length > 1, `Should split, got ${phases.length} phases`);
});

// --- splitIfOverLimit ---
test('splitIfOverLimit is a function', () => { assert(typeof splitIfOverLimit === 'function'); });
test('splitIfOverLimit small set → 1 phase', () => {
  const tasks = [{ id: 't1', complexity: 'low' }, { id: 't2', complexity: 'low' }];
  const chunks = splitIfOverLimit(tasks, 1);
  assert(chunks.length === 1);
});
test('splitIfOverLimit large set → multiple', () => {
  const tasks = [];
  for (let i = 0; i < 20; i++) tasks.push({ id: `t${i}`, complexity: 'high' });
  const chunks = splitIfOverLimit(tasks, 1);
  assert(chunks.length > 1, `Should split, got ${chunks.length}`);
});

// --- validatePhaseOrdering ---
test('validatePhaseOrdering is a function', () => { assert(typeof validatePhaseOrdering === 'function'); });
test('validatePhaseOrdering no violations', () => {
  const phases = [
    { phase: 1, tasks: [{ id: 't1' }] },
    { phase: 2, tasks: [{ id: 't2', depends_on: ['t1'] }] }
  ];
  const violations = validatePhaseOrdering(phases);
  assert(Array.isArray(violations) && violations.length === 0);
});
test('validatePhaseOrdering detects violation', () => {
  const phases = [
    { phase: 1, tasks: [{ id: 't1', depends_on: ['t2'] }] },
    { phase: 2, tasks: [{ id: 't2' }] }
  ];
  const violations = validatePhaseOrdering(phases);
  assert(violations.length > 0, 'Should detect forward dependency violation');
});
test('validatePhaseOrdering same phase ok', () => {
  const phases = [
    { phase: 1, tasks: [{ id: 't1', depends_on: ['t2'] }, { id: 't2' }] }
  ];
  const violations = validatePhaseOrdering(phases);
  assert(violations.length === 0, 'Same phase deps should be ok');
});

console.log(`\n  test-v7-phase-suggester: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-phase-suggester: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
