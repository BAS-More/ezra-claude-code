#!/usr/bin/env node
'use strict';

/**
 * EZRA v7 Phase 2 Test Suite — Plan Generator
 * Tests: ezra-plan-generator.js, ezra-phase-suggester.js, plan.md subcommands
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v7-plan-')); }
function rm(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

// ─── Load modules ─────────────────────────────────────────────────────────────

const planGen = require(path.join(ROOT, 'hooks', 'ezra-plan-generator.js'));
const phaseSug = require(path.join(ROOT, 'hooks', 'ezra-phase-suggester.js'));

// ─── ezra-plan-generator.js ───────────────────────────────────────────────────

test('plan-generator: exports required functions', () => {
  assert(typeof planGen.generatePlan === 'function', 'generatePlan missing');
  assert(typeof planGen.decomposeTasks === 'function', 'decomposeTasks missing');
  assert(typeof planGen.suggestPhases === 'function', 'suggestPhases missing');
  assert(typeof planGen.detectTaskAreas === 'function', 'detectTaskAreas missing');
});

test('plan-generator: exports constants', () => {
  assert(Array.isArray(planGen.AGENT_ROLES), 'AGENT_ROLES should be array');
  assert(planGen.AGENT_ROLES.length > 0, 'AGENT_ROLES should not be empty');
  assert(typeof planGen.COMPLEXITY_WEIGHTS === 'object', 'COMPLEXITY_WEIGHTS missing');
  assert(typeof planGen.MAX_HIGH_COMPLEXITY_PER_PHASE === 'number', 'MAX_HIGH_COMPLEXITY_PER_PHASE missing');
  assert(planGen.MAX_HIGH_COMPLEXITY_PER_PHASE > 0, 'MAX_HIGH_COMPLEXITY_PER_PHASE should be positive');
});

test('plan-generator: COMPLEXITY_WEIGHTS covers all levels', () => {
  const w = planGen.COMPLEXITY_WEIGHTS;
  assert(typeof w.low === 'number', 'low weight missing');
  assert(typeof w.medium === 'number', 'medium weight missing');
  assert(typeof w.high === 'number', 'high weight missing');
  assert(typeof w.critical === 'number', 'critical weight missing');
  assert(w.critical > w.high, 'critical should outweigh high');
});

test('plan-generator: generatePlan fails gracefully without definition', () => {
  const tmp = tmpDir();
  try {
    const result = planGen.generatePlan(tmp);
    assert(result.success === false, 'Should fail without project-definition.yaml');
    assert(typeof result.error === 'string', 'Should provide error message');
  } finally { rm(tmp); }
});

test('plan-generator: generatePlan succeeds with minimal definition', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), [
      'project_name: Test App',
      'description: A test application',
      'tech_stack: TypeScript',
    ].join('\n'));

    const result = planGen.generatePlan(tmp);
    assert(result.success === true, 'generatePlan should succeed: ' + (result.error || ''));
    assert(typeof result.plan_id === 'string', 'Should return plan_id');
    assert(result.plan_id.startsWith('plan-'), 'plan_id should start with plan-');
    assert(result.phases > 0, 'Should have at least 1 phase');
    assert(result.tasks > 0, 'Should have at least 1 task');
  } finally { rm(tmp); }
});

test('plan-generator: generatePlan creates master-plan.yaml', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');

    planGen.generatePlan(tmp);

    const planPath = path.join(tmp, '.ezra', 'plans', 'master-plan.yaml');
    assert(fs.existsSync(planPath), 'master-plan.yaml should be created');
    const content = fs.readFileSync(planPath, 'utf8');
    assert(content.includes('plan-'), 'plan file should have plan id');
    assert(content.includes('draft'), 'plan should be in draft status');
  } finally { rm(tmp); }
});

test('plan-generator: generatePlan creates tasks.yaml', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');

    planGen.generatePlan(tmp);

    const tasksPath = path.join(tmp, '.ezra', 'plans', 'tasks.yaml');
    assert(fs.existsSync(tasksPath), 'tasks.yaml should be created');
    const content = fs.readFileSync(tasksPath, 'utf8');
    assert(content.includes('task_'), 'tasks file should have task entries');
  } finally { rm(tmp); }
});

test('plan-generator: generatePlan creates phases.yaml', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');

    planGen.generatePlan(tmp);

    const phasesPath = path.join(tmp, '.ezra', 'plans', 'phases.yaml');
    assert(fs.existsSync(phasesPath), 'phases.yaml should be created');
  } finally { rm(tmp); }
});

test('plan-generator: plan includes gate tasks', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');

    const result = planGen.generatePlan(tmp);
    assert(result.success === true, 'should succeed');
    assert(result.task_types.gate > 0, 'Should have gate tasks, got: ' + JSON.stringify(result.task_types));
  } finally { rm(tmp); }
});

test('plan-generator: gate count equals phase count', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');

    const result = planGen.generatePlan(tmp);
    assert(result.success === true, 'should succeed');
    assert(result.task_types.gate === result.phases,
      `Gates (${result.task_types.gate}) should equal phases (${result.phases})`);
  } finally { rm(tmp); }
});

test('plan-generator: auth definition adds auth tasks', () => {
  const def = { project_name: 'Test', description: 'JWT auth login system' };
  const areas = planGen.detectTaskAreas(def);
  assert(areas.includes('auth'), 'auth should be detected from "auth" keyword');
});

test('plan-generator: database keywords detected', () => {
  const def = { project_name: 'Test', tech_stack: 'PostgreSQL supabase' };
  const areas = planGen.detectTaskAreas(def);
  assert(areas.includes('database'), 'database should be detected');
});

test('plan-generator: api keywords detected', () => {
  const def = { project_name: 'Test', description: 'REST API with GraphQL endpoint' };
  const areas = planGen.detectTaskAreas(def);
  assert(areas.includes('api'), 'api should be detected');
});

test('plan-generator: frontend keywords detected', () => {
  const def = { project_name: 'Test', description: 'React dashboard frontend UI' };
  const areas = planGen.detectTaskAreas(def);
  assert(areas.includes('frontend'), 'frontend should be detected');
});

test('plan-generator: always includes testing and deployment', () => {
  const def = { project_name: 'Test' };
  const areas = planGen.detectTaskAreas(def);
  assert(areas.includes('testing'), 'testing always included');
  assert(areas.includes('deployment'), 'deployment always included');
});

test('plan-generator: decomposeTasks returns array of tasks', () => {
  const def = { project_name: 'Test', description: 'Simple app' };
  const tasks = planGen.decomposeTasks(def);
  assert(Array.isArray(tasks), 'decomposeTasks should return array');
  assert(tasks.length > 0, 'should return at least one task');
});

test('plan-generator: all tasks have required fields', () => {
  const def = { project_name: 'Test' };
  const tasks = planGen.decomposeTasks(def);
  for (const t of tasks) {
    assert(typeof t.id === 'string', 'task.id missing');
    assert(typeof t.title === 'string', 'task.title missing');
    assert(typeof t.phase === 'number', 'task.phase missing: ' + JSON.stringify(t));
    assert(typeof t.agent_role === 'string', 'task.agent_role missing');
    assert(typeof t.complexity === 'string', 'task.complexity missing');
    assert(typeof t.status === 'string', 'task.status missing');
    assert(Array.isArray(t.depends_on), 'task.depends_on should be array');
    assert(t.type === 'task' || t.type === 'gate', 'task.type should be task or gate');
  }
});

test('plan-generator: task IDs are unique', () => {
  const def = { project_name: 'Test', description: 'auth api frontend database' };
  const tasks = planGen.decomposeTasks(def);
  const ids = tasks.map(t => t.id);
  const unique = new Set(ids);
  assert(unique.size === ids.length, 'task IDs should be unique');
});

test('plan-generator: complexity values are valid', () => {
  const valid = new Set(['low', 'medium', 'high', 'critical']);
  const def = { project_name: 'Test', description: 'full stack' };
  const tasks = planGen.decomposeTasks(def);
  for (const t of tasks) {
    assert(valid.has(t.complexity), `Invalid complexity: ${t.complexity}`);
  }
});

test('plan-generator: agent roles are from AGENT_ROLES list', () => {
  const roleSet = new Set(planGen.AGENT_ROLES);
  const def = { project_name: 'Test', description: 'full stack auth api frontend' };
  const tasks = planGen.decomposeTasks(def);
  for (const t of tasks) {
    assert(roleSet.has(t.agent_role), `Unknown agent_role: ${t.agent_role}`);
  }
});

test('plan-generator: suggestPhases groups tasks into phases', () => {
  const def = { project_name: 'Test' };
  const tasks = planGen.decomposeTasks(def);
  const phases = planGen.suggestPhases(tasks);
  assert(Array.isArray(phases), 'suggestPhases should return array');
  assert(phases.length > 0, 'should have at least 1 phase');
});

test('plan-generator: each phase has a gate task', () => {
  const def = { project_name: 'Test' };
  const tasks = planGen.decomposeTasks(def);
  const phases = planGen.suggestPhases(tasks);
  for (const p of phases) {
    const gates = p.tasks.filter(t => t.type === 'gate');
    assert(gates.length >= 1, `Phase ${p.phase} missing gate task`);
  }
});

test('plan-generator: result task_types.task + gate === total tasks', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.ezra', 'project-definition.yaml'), 'project_name: Test\n');
    const result = planGen.generatePlan(tmp);
    assert(result.success === true, 'should succeed');
    const sumTypes = result.task_types.task + result.task_types.gate;
    assert(sumTypes === result.tasks, `task+gate (${sumTypes}) should equal total (${result.tasks})`);
  } finally { rm(tmp); }
});

// ─── ezra-phase-suggester.js ──────────────────────────────────────────────────

test('phase-suggester: exports required functions', () => {
  assert(typeof phaseSug.groupIntoPhases === 'function', 'groupIntoPhases missing');
  assert(typeof phaseSug.splitIfOverLimit === 'function', 'splitIfOverLimit missing');
  assert(typeof phaseSug.calculatePhaseComplexity === 'function', 'calculatePhaseComplexity missing');
  assert(typeof phaseSug.validatePhaseOrdering === 'function', 'validatePhaseOrdering missing');
  assert(typeof phaseSug.getPhaseName === 'function', 'getPhaseName missing');
});

test('phase-suggester: exports limits', () => {
  assert(typeof phaseSug.MAX_HIGH_COMPLEXITY_PER_PHASE === 'number', 'MAX_HIGH_COMPLEXITY_PER_PHASE missing');
  assert(typeof phaseSug.MAX_TASKS_PER_PHASE === 'number', 'MAX_TASKS_PER_PHASE missing');
  assert(phaseSug.MAX_HIGH_COMPLEXITY_PER_PHASE > 0, 'limit must be positive');
  assert(phaseSug.MAX_TASKS_PER_PHASE > 0, 'limit must be positive');
});

test('phase-suggester: groupIntoPhases handles empty array', () => {
  const result = phaseSug.groupIntoPhases([]);
  assert(Array.isArray(result), 'should return array');
  assert(result.length === 0, 'empty input should return empty array');
});

test('phase-suggester: groupIntoPhases adds gate task to each phase', () => {
  const tasks = [
    { id: 't1', phase: 1, title: 'Task 1', complexity: 'low', depends_on: [] },
    { id: 't2', phase: 2, title: 'Task 2', complexity: 'medium', depends_on: [] },
  ];
  const phases = phaseSug.groupIntoPhases(tasks);
  for (const p of phases) {
    const gates = p.tasks.filter(t => t.type === 'gate');
    assert(gates.length === 1, `Phase ${p.phase} should have exactly 1 gate task`);
  }
});

test('phase-suggester: groupIntoPhases respects phase assignment', () => {
  const tasks = [
    { id: 't1', phase: 1, title: 'A', complexity: 'low', depends_on: [] },
    { id: 't2', phase: 1, title: 'B', complexity: 'low', depends_on: [] },
    { id: 't3', phase: 2, title: 'C', complexity: 'low', depends_on: [] },
  ];
  const phases = phaseSug.groupIntoPhases(tasks);
  assert(phases.length === 2, `Expected 2 phases, got ${phases.length}`);
});

test('phase-suggester: splitIfOverLimit does not split under-limit phase', () => {
  const tasks = Array.from({ length: 5 }, (_, i) => ({
    id: 't' + i, phase: 1, title: 'Task ' + i, complexity: 'low', depends_on: []
  }));
  const result = phaseSug.splitIfOverLimit(tasks, 1);
  assert(result.length === 1, 'Should not split phase under limit');
});

test('phase-suggester: splitIfOverLimit splits over high-complexity limit', () => {
  const max = phaseSug.MAX_HIGH_COMPLEXITY_PER_PHASE;
  const tasks = Array.from({ length: max + 3 }, (_, i) => ({
    id: 't' + i, phase: 1, title: 'Task ' + i, complexity: 'high', depends_on: []
  }));
  const result = phaseSug.splitIfOverLimit(tasks, 1);
  assert(result.length > 1, 'Should split phase over high-complexity limit');
});

test('phase-suggester: calculatePhaseComplexity returns 0 for empty array', () => {
  assert(phaseSug.calculatePhaseComplexity([]) === 0, 'Empty array should return 0');
});

test('phase-suggester: calculatePhaseComplexity returns 0-100', () => {
  const tasks = [
    { complexity: 'low' },
    { complexity: 'medium' },
    { complexity: 'high' },
    { complexity: 'critical' },
  ];
  const score = phaseSug.calculatePhaseComplexity(tasks);
  assert(score >= 0 && score <= 100, `Score out of range: ${score}`);
});

test('phase-suggester: calculatePhaseComplexity all-high > all-low', () => {
  const low = phaseSug.calculatePhaseComplexity([
    { complexity: 'low' }, { complexity: 'low' }, { complexity: 'low' }
  ]);
  const high = phaseSug.calculatePhaseComplexity([
    { complexity: 'high' }, { complexity: 'high' }, { complexity: 'high' }
  ]);
  assert(high > low, `All-high (${high}) should be greater than all-low (${low})`);
});

test('phase-suggester: validatePhaseOrdering returns empty for valid order', () => {
  const phases = [
    { phase: 1, tasks: [{ id: 't1', depends_on: [] }] },
    { phase: 2, tasks: [{ id: 't2', depends_on: ['t1'] }] },
  ];
  const violations = phaseSug.validatePhaseOrdering(phases);
  assert(violations.length === 0, 'No violations for valid ordering');
});

test('phase-suggester: validatePhaseOrdering detects dependency violations', () => {
  const phases = [
    { phase: 1, tasks: [{ id: 't1', depends_on: ['t2'] }] },  // t1 depends on t2, but t2 is in phase 2
    { phase: 2, tasks: [{ id: 't2', depends_on: [] }] },
  ];
  const violations = phaseSug.validatePhaseOrdering(phases);
  assert(violations.length > 0, 'Should detect dependency violations');
  assert(violations[0].task === 't1', 'Violation should reference t1');
});

test('phase-suggester: getPhaseName returns string for known phases', () => {
  assert(typeof phaseSug.getPhaseName(1) === 'string', 'Phase 1 name missing');
  assert(typeof phaseSug.getPhaseName(2) === 'string', 'Phase 2 name missing');
  assert(phaseSug.getPhaseName(1).length > 0, 'Phase name should not be empty');
});

test('phase-suggester: getPhaseName handles unknown phase', () => {
  const name = phaseSug.getPhaseName(99);
  assert(typeof name === 'string', 'Should return string for unknown phase');
  assert(name.length > 0, 'Should return non-empty string for unknown phase');
});

// ─── plan.md command file ─────────────────────────────────────────────────────

test('plan.md: command file exists', () => {
  const p = path.join(ROOT, 'commands', 'ezra', 'plan.md');
  assert(fs.existsSync(p), 'plan.md missing');
});

test('plan.md: has generate subcommand', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'plan.md'), 'utf8');
  assert(content.includes('generate'), 'plan.md should document generate subcommand');
});

test('plan.md: has lock subcommand', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'plan.md'), 'utf8');
  assert(content.includes('lock'), 'plan.md should document lock subcommand');
});

test('plan.md: has unlock subcommand', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'plan.md'), 'utf8');
  assert(content.includes('unlock'), 'plan.md should document unlock subcommand');
});

test('plan.md: has review subcommand', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'plan.md'), 'utf8');
  assert(content.includes('review'), 'plan.md should document review subcommand');
});

test('plan.md: has phases subcommand', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'plan.md'), 'utf8');
  assert(content.includes('phases'), 'plan.md should document phases subcommand');
});

// ─── templates/plan-review.yaml ──────────────────────────────────────────────

test('plan-review.yaml: template exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'templates', 'plan-review.yaml')), 'plan-review.yaml missing');
});

test('plan-review.yaml: has 5 steps', () => {
  const content = fs.readFileSync(path.join(ROOT, 'templates', 'plan-review.yaml'), 'utf8');
  const stepMatches = content.match(/^\s+- id: /gm) || [];
  assert(stepMatches.length === 5, `Expected 5 steps, found ${stepMatches.length}`);
});

test('plan-review.yaml: has guard_rails section', () => {
  const content = fs.readFileSync(path.join(ROOT, 'templates', 'plan-review.yaml'), 'utf8');
  assert(content.includes('guard_rails'), 'plan-review.yaml should have guard_rails');
});

test('plan-review.yaml: requires locked_before_execution', () => {
  const content = fs.readFileSync(path.join(ROOT, 'templates', 'plan-review.yaml'), 'utf8');
  assert(content.includes('require_locked_before_execution'), 'Should require locked plan before execution');
});

// ─── ezra-planner.js new functions ───────────────────────────────────────────

test('planner: lockPlan and unlockPlan exported', () => {
  const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));
  assert(typeof planner.lockPlan === 'function', 'lockPlan missing from exports');
  assert(typeof planner.unlockPlan === 'function', 'unlockPlan missing from exports');
});

test('planner: addPhaseGate exported', () => {
  const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));
  assert(typeof planner.addPhaseGate === 'function', 'addPhaseGate missing from exports');
});

test('planner: createPlanFromDefinition exported', () => {
  const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));
  assert(typeof planner.createPlanFromDefinition === 'function', 'createPlanFromDefinition missing from exports');
});

test('planner: createPlanFromDefinition fails gracefully without definition', () => {
  const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));
  const tmp = tmpDir();
  try {
    const result = planner.createPlanFromDefinition(tmp);
    assert(result === null || (result && result.success === false), 'Should fail gracefully without definition');
  } finally { rm(tmp); }
});

test('planner: lockPlan creates lock state', () => {
  const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, '.ezra', 'plans'), { recursive: true });
    // Create a minimal plan file
    fs.writeFileSync(path.join(tmp, '.ezra', 'plans', 'master-plan.yaml'),
      'id: plan-test\nstatus: draft\n');
    const result = planner.lockPlan(tmp);
    assert(result !== undefined, 'lockPlan should return a result');
  } finally { rm(tmp); }
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`  V7-PlanGenerator: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
