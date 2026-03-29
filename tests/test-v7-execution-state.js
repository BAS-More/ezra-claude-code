#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-execution-state.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-exec-state-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- Constants ---
test('RUN_DIR is a string', () => { assert(typeof mod.RUN_DIR === 'string' && mod.RUN_DIR.includes('execution')); });
test('CURRENT_RUN_FILE is a string', () => { assert(typeof mod.CURRENT_RUN_FILE === 'string'); });
test('STATUSES is an array of 6', () => { assert(Array.isArray(mod.STATUSES) && mod.STATUSES.length === 6, `Got ${mod.STATUSES.length}`); });
test('STATUSES includes pending', () => { assert(mod.STATUSES.includes('pending')); });
test('STATUSES includes running', () => { assert(mod.STATUSES.includes('running')); });
test('STATUSES includes paused', () => { assert(mod.STATUSES.includes('paused')); });
test('STATUSES includes completed', () => { assert(mod.STATUSES.includes('completed')); });
test('STATUSES includes failed', () => { assert(mod.STATUSES.includes('failed')); });
test('STATUSES includes aborted', () => { assert(mod.STATUSES.includes('aborted')); });

// --- createRun ---
test('createRun is a function', () => { assert(typeof mod.createRun === 'function'); });
test('createRun returns state object', () => {
  const state = mod.createRun(tmpDir, 'plan-001');
  assert(state && typeof state.id === 'string', 'Missing id');
  assert(state.status === 'pending', `Status should be pending, got ${state.status}`);
  assert(state.plan_id === 'plan-001', `Plan id wrong`);
});

// --- loadRun ---
test('loadRun is a function', () => { assert(typeof mod.loadRun === 'function'); });
test('loadRun returns object after create', () => {
  mod.createRun(tmpDir, 'plan-002');
  const loaded = mod.loadRun(tmpDir);
  assert(loaded !== null, 'Should load run');
});
test('loadRun returns null for empty dir', () => {
  const emptyDir = path.join(os.tmpdir(), 'empty-exec-' + Date.now());
  fs.mkdirSync(emptyDir, { recursive: true });
  const r = mod.loadRun(emptyDir);
  assert(r === null, 'Should return null');
  fs.rmSync(emptyDir, { recursive: true, force: true });
});

// --- saveRun ---
test('saveRun is a function', () => { assert(typeof mod.saveRun === 'function'); });

// --- advanceTask ---
test('advanceTask is a function', () => { assert(typeof mod.advanceTask === 'function'); });

// --- advancePhase ---
test('advancePhase is a function', () => { assert(typeof mod.advancePhase === 'function'); });

// --- checkpoint ---
test('checkpoint is a function', () => { assert(typeof mod.checkpoint === 'function'); });
test('checkpoint saves data', () => {
  mod.createRun(tmpDir, 'plan-cp');
  const r = mod.checkpoint(tmpDir, { note: 'test checkpoint' });
  assert(r !== null);
});

// --- State transitions ---
test('pauseRun is a function', () => { assert(typeof mod.pauseRun === 'function'); });
test('resumeRun is a function', () => { assert(typeof mod.resumeRun === 'function'); });
test('abortRun is a function', () => { assert(typeof mod.abortRun === 'function'); });
test('completeRun is a function', () => { assert(typeof mod.completeRun === 'function'); });

test('pauseRun transitions status', () => {
  mod.createRun(tmpDir, 'plan-pause');
  // Set to running first by loading and saving
  const state = mod.loadRun(tmpDir);
  if (state) { state.status = 'running'; mod.saveRun(tmpDir, state); }
  const r = mod.pauseRun(tmpDir, 'test pause');
  assert(r === null || r.status === 'paused', `Got ${r ? r.status : 'null'}`);
});

test('abortRun transitions status', () => {
  mod.createRun(tmpDir, 'plan-abort');
  const state = mod.loadRun(tmpDir);
  if (state) { state.status = 'running'; mod.saveRun(tmpDir, state); }
  const r = mod.abortRun(tmpDir, 'test abort');
  assert(r === null || r.status === 'aborted', `Got ${r ? r.status : 'null'}`);
});

test('completeRun transitions status', () => {
  mod.createRun(tmpDir, 'plan-complete');
  const state = mod.loadRun(tmpDir);
  if (state) { state.status = 'running'; mod.saveRun(tmpDir, state); }
  const r = mod.completeRun(tmpDir);
  assert(r === null || r.status === 'completed', `Got ${r ? r.status : 'null'}`);
});

// --- recordTaskComplete / recordTaskFailed ---
test('recordTaskComplete is a function', () => { assert(typeof mod.recordTaskComplete === 'function'); });
test('recordTaskFailed is a function', () => { assert(typeof mod.recordTaskFailed === 'function'); });
test('recordTaskComplete does not throw', () => {
  mod.createRun(tmpDir, 'plan-rec');
  const r = mod.recordTaskComplete(tmpDir, 'task-1', { ok: true });
  // May return null or updated state
  assert(r === null || typeof r === 'object');
});
test('recordTaskFailed does not throw', () => {
  const r = mod.recordTaskFailed(tmpDir, 'task-1', 'some error');
  assert(r === null || typeof r === 'object');
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-execution-state: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-execution-state: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
