#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-task-verifier.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-task-verify-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- VERIFICATION_LEVELS ---
test('VERIFICATION_LEVELS is an array', () => { assert(Array.isArray(mod.VERIFICATION_LEVELS)); });
test('VERIFICATION_LEVELS has 3 entries', () => { assert(mod.VERIFICATION_LEVELS.length === 3, `Got ${mod.VERIFICATION_LEVELS.length}`); });
test('VERIFICATION_LEVELS includes basic', () => { assert(mod.VERIFICATION_LEVELS.includes('basic')); });
test('VERIFICATION_LEVELS includes standard', () => { assert(mod.VERIFICATION_LEVELS.includes('standard')); });
test('VERIFICATION_LEVELS includes strict', () => { assert(mod.VERIFICATION_LEVELS.includes('strict')); });

// --- checkFileTargetsExist ---
test('checkFileTargetsExist is a function', () => { assert(typeof mod.checkFileTargetsExist === 'function'); });
test('checkFileTargetsExist with existing file', () => {
  const fp = path.join(tmpDir, 'existing.js');
  fs.writeFileSync(fp, '// test');
  const r = mod.checkFileTargetsExist({ file_targets: ['existing.js'] }, tmpDir);
  assert(r.passed === true, `Should pass, missing: ${(r.missing || []).join(', ')}`);
  assert(Array.isArray(r.missing) && r.missing.length === 0);
});
test('checkFileTargetsExist with missing file', () => {
  const r = mod.checkFileTargetsExist({ file_targets: ['nonexistent.js'] }, tmpDir);
  assert(r.passed === false, 'Should fail');
  assert(r.missing.length > 0);
});
test('checkFileTargetsExist with no targets', () => {
  const r = mod.checkFileTargetsExist({ file_targets: [] }, tmpDir);
  assert(r.passed === true);
});
test('checkFileTargetsExist with undefined targets', () => {
  const r = mod.checkFileTargetsExist({}, tmpDir);
  assert(r.passed === true);
});

// --- checkAcceptanceCriteria ---
test('checkAcceptanceCriteria is a function', () => { assert(typeof mod.checkAcceptanceCriteria === 'function'); });
test('checkAcceptanceCriteria returns passed', () => {
  const r = mod.checkAcceptanceCriteria({ acceptance_criteria: 'Tests should pass. Lint should be clean.' }, 'All tests passed and lint is clean');
  assert(r.passed === true);
});
test('checkAcceptanceCriteria lists unchecked', () => {
  const r = mod.checkAcceptanceCriteria({ acceptance_criteria: 'Database migration complete. Performance benchmarks pass.' }, 'nothing here');
  assert(Array.isArray(r.unchecked));
  assert(r.unchecked.length > 0, 'Should have unchecked criteria');
});

// --- runLintCheck ---
test('runLintCheck is a function', () => { assert(typeof mod.runLintCheck === 'function'); });
test('runLintCheck with no files', () => {
  const r = mod.runLintCheck(tmpDir, []);
  assert(typeof r.passed === 'boolean' || r.skipped === true);
});

// --- verifyTask ---
test('verifyTask is a function', () => { assert(typeof mod.verifyTask === 'function'); });
test('verifyTask returns result object', () => {
  const task = { id: 'task-1', file_targets: [], acceptance_criteria: '' };
  const r = mod.verifyTask(tmpDir, task, { ok: true });
  assert(typeof r === 'object' && r !== null);
  assert(typeof r.passed === 'boolean');
  assert(Array.isArray(r.findings));
});
test('verifyTask includes task_id', () => {
  const task = { id: 'task-42', file_targets: [], acceptance_criteria: '' };
  const r = mod.verifyTask(tmpDir, task, {});
  assert(r.task_id === 'task-42', `Got ${r.task_id}`);
});
test('verifyTask includes verified_at', () => {
  const task = { id: 't', file_targets: [], acceptance_criteria: '' };
  const r = mod.verifyTask(tmpDir, task, {});
  assert(typeof r.verified_at === 'string');
});
test('verifyTask with missing file targets fails', () => {
  const task = { id: 't-miss', file_targets: ['ghost.js'], acceptance_criteria: '' };
  const r = mod.verifyTask(tmpDir, task, {});
  assert(r.passed === false || r.findings.length > 0);
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-task-verifier: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-task-verifier: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
