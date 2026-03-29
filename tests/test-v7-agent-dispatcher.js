#!/usr/bin/env node
'use strict';
const path = require('path');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-agent-dispatcher.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- SPECIALIST_ROLES ---
test('SPECIALIST_ROLES is an array', () => { assert(Array.isArray(mod.SPECIALIST_ROLES)); });
test('SPECIALIST_ROLES has 5 entries', () => { assert(mod.SPECIALIST_ROLES.length === 5, `Got ${mod.SPECIALIST_ROLES.length}`); });
test('SPECIALIST_ROLES includes security-specialist', () => { assert(mod.SPECIALIST_ROLES.includes('security-specialist')); });
test('SPECIALIST_ROLES includes test-engineer', () => { assert(mod.SPECIALIST_ROLES.includes('test-engineer')); });

// --- DIRECT_ROLES ---
test('DIRECT_ROLES is an array', () => { assert(Array.isArray(mod.DIRECT_ROLES)); });
test('DIRECT_ROLES includes code-agent', () => { assert(mod.DIRECT_ROLES.includes('code-agent')); });

// --- getDispatchStrategy ---
test('getDispatchStrategy is a function', () => { assert(typeof mod.getDispatchStrategy === 'function'); });
test('getDispatchStrategy specialist role', () => {
  const r = mod.getDispatchStrategy('security-specialist');
  assert(r === 'specialist', `Got ${r}`);
});
test('getDispatchStrategy direct role', () => {
  const r = mod.getDispatchStrategy('code-agent');
  assert(r === 'direct', `Got ${r}`);
});
test('getDispatchStrategy unknown role', () => {
  const r = mod.getDispatchStrategy('unknown-role');
  assert(typeof r === 'string', 'Should return a string');
});

// --- buildTaskPrompt ---
test('buildTaskPrompt is a function', () => { assert(typeof mod.buildTaskPrompt === 'function'); });
test('buildTaskPrompt returns string', () => {
  const task = { title: 'Fix bug', description: 'Fix the login bug', acceptance_criteria: ['Tests pass'], file_targets: ['src/auth.js'] };
  const prompt = mod.buildTaskPrompt(task);
  assert(typeof prompt === 'string' && prompt.length > 0);
});
test('buildTaskPrompt includes title', () => {
  const task = { title: 'Fix bug', description: 'Fix it', acceptance_criteria: [], file_targets: [] };
  const prompt = mod.buildTaskPrompt(task);
  assert(prompt.includes('Fix bug'), 'Should include task title');
});
test('buildTaskPrompt includes file targets', () => {
  const task = { title: 'Task', description: 'Desc', acceptance_criteria: [], file_targets: ['hooks/main.js'] };
  const prompt = mod.buildTaskPrompt(task);
  assert(prompt.includes('hooks/main.js'));
});

// --- validateTaskResult ---
test('validateTaskResult is a function', () => { assert(typeof mod.validateTaskResult === 'function'); });
test('validateTaskResult returns valid shape', () => {
  const task = { acceptance_criteria: ['Tests pass'] };
  const result = { files_changed: ['a.js'] };
  const r = mod.validateTaskResult(task, result);
  assert(typeof r.valid === 'boolean');
  assert(Array.isArray(r.issues));
});

// --- dispatchTask ---
test('dispatchTask is a function', () => { assert(typeof mod.dispatchTask === 'function'); });
test('dispatchTask returns promise', () => {
  const task = { task_id: 't1', title: 'Test', agent_role: 'code-agent', description: 'X', acceptance_criteria: [] };
  const result = mod.dispatchTask('/tmp/test', task);
  assert(result && typeof result.then === 'function');
  result.catch(() => {}); // suppress
});

console.log(`\n  test-v7-agent-dispatcher: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-agent-dispatcher: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
