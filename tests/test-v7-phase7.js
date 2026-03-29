#!/usr/bin/env node
'use strict';

/**
 * test-v7-phase7.js — Phase 7 gamification test suite
 * Tests: achievement engine, achievements.yaml, workflow templates
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT   = path.resolve(__dirname, '..');
const engine = require(path.join(ROOT, 'hooks', 'ezra-achievement-engine'));

let passed = 0;
let failed = 0;
let tmpDir = null;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function setup() { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-ph7-')); }
function teardown() {
  if (tmpDir && fs.existsSync(tmpDir)) { fs.rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
}

// ── Achievement Engine Exports ────────────────────────────────────────────────

test('Achievement engine exports BUILT_IN_ACHIEVEMENTS', () => {
  assert(Array.isArray(engine.BUILT_IN_ACHIEVEMENTS), 'Not array');
  assert(engine.BUILT_IN_ACHIEVEMENTS.length >= 12, 'Expected >= 12 achievements');
});

test('Each built-in achievement has required fields', () => {
  for (const a of engine.BUILT_IN_ACHIEVEMENTS) {
    assert(a.id, 'Missing id');
    assert(a.name, 'Missing name');
    assert(a.description, 'Missing description');
    assert(a.icon, 'Missing icon');
    assert(typeof a.points === 'number', 'points must be number');
    assert(Array.isArray(a.rules), 'rules must be array');
    assert(a.rules.length > 0, 'rules must not be empty');
  }
});

test('Achievement IDs are unique', () => {
  const ids = engine.BUILT_IN_ACHIEVEMENTS.map(a => a.id);
  const unique = new Set(ids);
  assert(unique.size === ids.length, 'Duplicate achievement IDs found');
});

test('Achievement engine exports evaluate function', () => {
  assert(typeof engine.evaluate === 'function', 'Missing evaluate');
});

test('Achievement engine exports listAchievements function', () => {
  assert(typeof engine.listAchievements === 'function', 'Missing listAchievements');
});

test('Achievement engine exports collectMetrics function', () => {
  assert(typeof engine.collectMetrics === 'function', 'Missing collectMetrics');
});

test('Achievement engine exports checkAchievement function', () => {
  assert(typeof engine.checkAchievement === 'function', 'Missing checkAchievement');
});

// ── collectMetrics ────────────────────────────────────────────────────────────

test('collectMetrics returns metrics object', () => {
  setup();
  try {
    const m = engine.collectMetrics(tmpDir);
    assert(typeof m === 'object', 'Not object');
    assert('decisions' in m, 'Missing decisions');
    assert('scans' in m, 'Missing scans');
    assert('health_score' in m, 'Missing health_score');
    assert('gates_passed' in m, 'Missing gates_passed');
  } finally { teardown(); }
});

test('collectMetrics returns zeros for empty project', () => {
  setup();
  try {
    const m = engine.collectMetrics(tmpDir);
    assert(m.decisions === 0, 'decisions should be 0');
    assert(m.scans === 0, 'scans should be 0');
    assert(m.health_score === 0, 'health_score should be 0');
  } finally { teardown(); }
});

test('collectMetrics counts decision files', () => {
  setup();
  try {
    const decDir = path.join(tmpDir, '.ezra', 'decisions');
    fs.mkdirSync(decDir, { recursive: true });
    fs.writeFileSync(path.join(decDir, 'ADR-001.yaml'), 'id: ADR-001', 'utf8');
    fs.writeFileSync(path.join(decDir, 'ADR-002.yaml'), 'id: ADR-002', 'utf8');
    const m = engine.collectMetrics(tmpDir);
    assert(m.decisions === 2, 'Expected 2 decisions, got ' + m.decisions);
  } finally { teardown(); }
});

test('collectMetrics counts scan files', () => {
  setup();
  try {
    const scanDir = path.join(tmpDir, '.ezra', 'scans');
    fs.mkdirSync(scanDir, { recursive: true });
    fs.writeFileSync(path.join(scanDir, '2026-01.yaml'), 'status: complete', 'utf8');
    const m = engine.collectMetrics(tmpDir);
    assert(m.scans === 1, 'Expected 1 scan');
  } finally { teardown(); }
});

test('collectMetrics reads health_score from current.yaml', () => {
  setup();
  try {
    const versDir = path.join(tmpDir, '.ezra', 'versions');
    fs.mkdirSync(versDir, { recursive: true });
    fs.writeFileSync(path.join(versDir, 'current.yaml'), 'health_score: 82\nversion: 1.0.0', 'utf8');
    const m = engine.collectMetrics(tmpDir);
    assert(m.health_score === 82, 'Expected health_score 82, got ' + m.health_score);
  } finally { teardown(); }
});

// ── checkAchievement ──────────────────────────────────────────────────────────

test('checkAchievement returns true when all rules pass', () => {
  const a = { rules: [{ type: 'count', metric: 'decisions', operator: '>=', value: 1 }] };
  assert(engine.checkAchievement(a, { decisions: 5 }), 'Should pass');
});

test('checkAchievement returns false when rule fails', () => {
  const a = { rules: [{ type: 'score', metric: 'health_score', operator: '>=', value: 90 }] };
  assert(!engine.checkAchievement(a, { health_score: 70 }), 'Should fail');
});

test('checkAchievement handles === operator', () => {
  const a = { rules: [{ type: 'count', metric: 'stale_docs', operator: '===', value: 0 }] };
  assert(engine.checkAchievement(a, { stale_docs: 0 }), 'Should pass for === 0');
  assert(!engine.checkAchievement(a, { stale_docs: 1 }), 'Should fail for === 0 with 1');
});

test('checkAchievement returns false for missing metric', () => {
  const a = { rules: [{ type: 'count', metric: 'unknown_metric', operator: '>=', value: 0 }] };
  assert(!engine.checkAchievement(a, { decisions: 5 }), 'Missing metric should return false');
});

// ── evaluate ──────────────────────────────────────────────────────────────────

test('evaluate returns result object', () => {
  setup();
  try {
    const r = engine.evaluate(tmpDir, { decisions: 0, scans: 0, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    assert(typeof r === 'object', 'Not object');
    assert('newly_earned' in r, 'Missing newly_earned');
    assert('total_earned' in r, 'Missing total_earned');
    assert('total_points' in r, 'Missing total_points');
    assert(Array.isArray(r.newly_earned), 'newly_earned not array');
  } finally { teardown(); }
});

test('evaluate earns first_decision when decisions >= 1', () => {
  setup();
  try {
    const r = engine.evaluate(tmpDir, { decisions: 1, scans: 0, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    assert(r.newly_earned.some(a => a.id === 'first_decision'), 'Should earn first_decision');
  } finally { teardown(); }
});

test('evaluate earns health_a for score >= 90', () => {
  setup();
  try {
    const r = engine.evaluate(tmpDir, { decisions: 0, scans: 0, health_score: 95, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    assert(r.newly_earned.some(a => a.id === 'health_a'), 'Should earn health_a');
  } finally { teardown(); }
});

test('evaluate does not double-award already earned achievement', () => {
  setup();
  try {
    // First call earns it
    engine.evaluate(tmpDir, { decisions: 1, scans: 0, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    // Second call should not earn again
    const r2 = engine.evaluate(tmpDir, { decisions: 5, scans: 0, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    const firstDecisionEarns = r2.newly_earned.filter(a => a.id === 'first_decision');
    assert(firstDecisionEarns.length === 0, 'first_decision should not be awarded twice');
  } finally { teardown(); }
});

test('evaluate persists earned achievements to file', () => {
  setup();
  try {
    engine.evaluate(tmpDir, { decisions: 3, scans: 1, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    const earnedPath = path.join(tmpDir, '.ezra', 'achievements', 'earned.json');
    assert(fs.existsSync(earnedPath), 'earned.json should be created');
    const data = JSON.parse(fs.readFileSync(earnedPath, 'utf8'));
    assert(Array.isArray(data), 'earned.json should be array');
    assert(data.length > 0, 'Should have earned achievements');
  } finally { teardown(); }
});

test('evaluate returns total_points > 0 when achievements earned', () => {
  setup();
  try {
    const r = engine.evaluate(tmpDir, { decisions: 1, scans: 1, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    assert(r.total_points > 0, 'Should have positive points');
  } finally { teardown(); }
});

// ── listAchievements ──────────────────────────────────────────────────────────

test('listAchievements returns all achievements with earned status', () => {
  setup();
  try {
    const list = engine.listAchievements(tmpDir);
    assert(Array.isArray(list), 'Not array');
    assert(list.length >= 12, 'Expected >= 12');
    for (const a of list) {
      assert('earned' in a, 'Missing earned field');
      assert(typeof a.earned === 'boolean', 'earned should be boolean');
    }
  } finally { teardown(); }
});

test('listAchievements shows earned after evaluate', () => {
  setup();
  try {
    engine.evaluate(tmpDir, { decisions: 1, scans: 0, health_score: 0, gates_passed: 0,
      phases_completed: 0, commits: 0, documents: 0, security_score: 0, stale_docs: 0, library_entries: 0 });
    const list = engine.listAchievements(tmpDir);
    const firstDec = list.find(a => a.id === 'first_decision');
    assert(firstDec, 'first_decision should be in list');
    assert(firstDec.earned === true, 'first_decision should be earned');
    assert(firstDec.earned_at, 'earned_at should be set');
  } finally { teardown(); }
});

// ── loadEarned / saveEarned ───────────────────────────────────────────────────

test('loadEarned returns empty array for new project', () => {
  setup();
  try {
    const e = engine.loadEarned(tmpDir);
    assert(Array.isArray(e), 'Not array');
    assert(e.length === 0, 'Should be empty');
  } finally { teardown(); }
});

test('saveEarned and loadEarned round-trip', () => {
  setup();
  try {
    const data = [{ id: 'first_decision', earned_at: '2026-01-01T00:00:00.000Z' }];
    engine.saveEarned(tmpDir, data);
    const loaded = engine.loadEarned(tmpDir);
    assert(loaded.length === 1, 'Should load 1 achievement');
    assert(loaded[0].id === 'first_decision', 'ID mismatch');
  } finally { teardown(); }
});

// ── achievements.yaml ─────────────────────────────────────────────────────────

test('achievements.yaml template exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'templates', 'achievements.yaml')), 'Missing');
});

test('achievements.yaml has version field', () => {
  const c = fs.readFileSync(path.join(ROOT, 'templates', 'achievements.yaml'), 'utf8');
  assert(c.includes('version:'), 'Missing version');
});

test('achievements.yaml documents first_decision', () => {
  const c = fs.readFileSync(path.join(ROOT, 'templates', 'achievements.yaml'), 'utf8');
  assert(c.includes('first_decision'), 'Missing first_decision');
});

test('achievements.yaml documents security_clean', () => {
  const c = fs.readFileSync(path.join(ROOT, 'templates', 'achievements.yaml'), 'utf8');
  assert(c.includes('security_clean'), 'Missing security_clean');
});

// ── Workflow templates ────────────────────────────────────────────────────────

const WORKFLOW_TEMPLATES = ['release-prep', 'sprint-close', 'security-audit'];

for (const t of WORKFLOW_TEMPLATES) {
  test(`templates/workflows/${t}.yaml exists`, () => {
    assert(fs.existsSync(path.join(ROOT, 'templates', 'workflows', t + '.yaml')), 'Missing ' + t + '.yaml');
  });

  test(`templates/workflows/${t}.yaml has name field`, () => {
    const c = fs.readFileSync(path.join(ROOT, 'templates', 'workflows', t + '.yaml'), 'utf8');
    assert(c.includes('name:'), t + '.yaml missing name');
  });

  test(`templates/workflows/${t}.yaml has steps`, () => {
    const c = fs.readFileSync(path.join(ROOT, 'templates', 'workflows', t + '.yaml'), 'utf8');
    assert(c.includes('steps:'), t + '.yaml missing steps');
  });
}

// ── ezra-achievement-engine.js file structure ─────────────────────────────────

test('ezra-achievement-engine.js has shebang', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-achievement-engine.js'), 'utf8');
  assert(c.startsWith('#!/usr/bin/env node'), 'No shebang');
});

test('ezra-achievement-engine.js uses strict mode', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-achievement-engine.js'), 'utf8');
  assert(c.includes("'use strict'"), 'No strict mode');
});

// ── Report ────────────────────────────────────────────────────────────────────

console.log('  V7-Phase7: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
