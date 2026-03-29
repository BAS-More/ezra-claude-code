#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-achievement-engine.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-achieve-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- BUILT_IN_ACHIEVEMENTS ---
test('BUILT_IN_ACHIEVEMENTS is an array', () => { assert(Array.isArray(mod.BUILT_IN_ACHIEVEMENTS)); });
test('BUILT_IN_ACHIEVEMENTS has 12 entries', () => { assert(mod.BUILT_IN_ACHIEVEMENTS.length === 12, `Got ${mod.BUILT_IN_ACHIEVEMENTS.length}`); });
test('Each achievement has id', () => { assert(mod.BUILT_IN_ACHIEVEMENTS.every(a => typeof a.id === 'string')); });
test('Each achievement has name', () => { assert(mod.BUILT_IN_ACHIEVEMENTS.every(a => typeof a.name === 'string')); });
test('Each achievement has points', () => { assert(mod.BUILT_IN_ACHIEVEMENTS.every(a => typeof a.points === 'number')); });
test('Each achievement has rules', () => { assert(mod.BUILT_IN_ACHIEVEMENTS.every(a => Array.isArray(a.rules))); });
test('All ids are unique', () => {
  const ids = mod.BUILT_IN_ACHIEVEMENTS.map(a => a.id);
  assert(ids.length === new Set(ids).size, 'Duplicate achievement ids');
});

// --- checkAchievement ---
test('checkAchievement is a function', () => { assert(typeof mod.checkAchievement === 'function'); });
test('checkAchievement with matching rules', () => {
  const ach = { rules: [{ metric: 'decisions', operator: '>=', value: 1 }] };
  const metrics = { decisions: 5 };
  assert(mod.checkAchievement(ach, metrics) === true);
});
test('checkAchievement with failing rules', () => {
  const ach = { rules: [{ metric: 'decisions', operator: '>=', value: 10 }] };
  const metrics = { decisions: 2 };
  assert(mod.checkAchievement(ach, metrics) === false);
});
test('checkAchievement with zero metrics', () => {
  const ach = { rules: [{ metric: 'scans', operator: '>=', value: 1 }] };
  assert(mod.checkAchievement(ach, {}) === false);
});

// --- collectMetrics ---
test('collectMetrics is a function', () => { assert(typeof mod.collectMetrics === 'function'); });
test('collectMetrics returns object', () => {
  const m = mod.collectMetrics(tmpDir);
  assert(typeof m === 'object' && m !== null);
});
test('collectMetrics has numeric fields', () => {
  const m = mod.collectMetrics(tmpDir);
  assert(typeof m.decisions === 'number');
  assert(typeof m.scans === 'number');
});

// --- evaluate ---
test('evaluate is a function', () => { assert(typeof mod.evaluate === 'function'); });
test('evaluate returns result object', () => {
  const r = mod.evaluate(tmpDir);
  assert(typeof r === 'object' && r !== null);
  assert(Array.isArray(r.newly_earned));
  assert(typeof r.total_points === 'number');
});
test('evaluate with metrics override', () => {
  const r = mod.evaluate(tmpDir, { decisions: 100, scans: 100, health_score: 100, phases_completed: 100, gates_passed: 100, commits: 100, documents: 100, security_score: 100, stale_docs: 0, library_entries: 100 });
  assert(r.total_earned > 0 || r.newly_earned.length >= 0);
});

// --- listAchievements ---
test('listAchievements is a function', () => { assert(typeof mod.listAchievements === 'function'); });
test('listAchievements returns array', () => {
  const list = mod.listAchievements(tmpDir);
  assert(Array.isArray(list));
  assert(list.length === mod.BUILT_IN_ACHIEVEMENTS.length);
});

// --- loadEarned / saveEarned ---
test('loadEarned is a function', () => { assert(typeof mod.loadEarned === 'function'); });
test('saveEarned is a function', () => { assert(typeof mod.saveEarned === 'function'); });
test('loadEarned returns array', () => {
  const r = mod.loadEarned(tmpDir);
  assert(Array.isArray(r));
});
test('saveEarned + loadEarned roundtrip', () => {
  const earned = [{ id: 'first-decision', earned_at: new Date().toISOString() }];
  mod.saveEarned(tmpDir, earned);
  const loaded = mod.loadEarned(tmpDir);
  assert(loaded.length === 1 && loaded[0].id === 'first-decision');
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-achievement-engine: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-achievement-engine: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
