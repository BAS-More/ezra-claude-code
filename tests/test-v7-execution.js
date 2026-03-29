#!/usr/bin/env node
'use strict';

/**
 * EZRA v7 Phase 3 Test Suite — Autonomous Execution Loop
 * Tests: ezra-mah-client.js, ezra-execution-state.js, ezra-agent-dispatcher.js, ezra-task-verifier.js
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
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v7-exec-')); }
function rm(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

// ─── Load modules ─────────────────────────────────────────────────────────────

const mahClient = require(path.join(ROOT, 'hooks', 'ezra-mah-client.js'));
const execState = require(path.join(ROOT, 'hooks', 'ezra-execution-state.js'));
const dispatcher = require(path.join(ROOT, 'hooks', 'ezra-agent-dispatcher.js'));
const verifier = require(path.join(ROOT, 'hooks', 'ezra-task-verifier.js'));

// ─── ezra-mah-client.js ───────────────────────────────────────────────────────

test('mah-client: exports required functions', () => {
  assert(typeof mahClient.getMahEndpoint === 'function', 'getMahEndpoint missing');
  assert(typeof mahClient.routeTask === 'function', 'routeTask missing');
  assert(typeof mahClient.routeSecurityAudit === 'function', 'routeSecurityAudit missing');
  assert(typeof mahClient.routeArchitectureReview === 'function', 'routeArchitectureReview missing');
  assert(typeof mahClient.routeDocumentParse === 'function', 'routeDocumentParse missing');
});

test('mah-client: exports MAH_ENDPOINT_DEFAULT', () => {
  assert(typeof mahClient.MAH_ENDPOINT_DEFAULT === 'string', 'MAH_ENDPOINT_DEFAULT should be string');
  assert(mahClient.MAH_ENDPOINT_DEFAULT.startsWith('http'), 'Should be HTTP URL');
});

test('mah-client: getMahEndpoint returns string for any dir', () => {
  const tmp = tmpDir();
  try {
    const ep = mahClient.getMahEndpoint(tmp);
    assert(typeof ep === 'string', 'Should return string');
    assert(ep.startsWith('http'), 'Should return HTTP URL');
  } finally { rm(tmp); }
});

test('mah-client: getMahEndpoint defaults when no settings', () => {
  const tmp = tmpDir();
  try {
    const ep = mahClient.getMahEndpoint(tmp);
    assert(ep === mahClient.MAH_ENDPOINT_DEFAULT, 'Should default to MAH_ENDPOINT_DEFAULT');
  } finally { rm(tmp); }
});

test('mah-client: routeTask returns promise', () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'Test', agent_role: 'code-agent', description: 'desc', acceptance_criteria: 'criteria' };
    const result = mahClient.routeTask(tmp, task);
    assert(typeof result.then === 'function', 'routeTask should return Promise');
    return result.catch(() => {}); // expected to fail — no MAH server
  } finally { rm(tmp); }
});

test('mah-client: routeTask fails gracefully when MAH not available', async () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'Test', agent_role: 'code-agent', description: 'desc', acceptance_criteria: 'criteria' };
    const result = await mahClient.routeTask(tmp, task).catch(e => ({ routed: false, error: e.message }));
    assert(typeof result === 'object', 'Should return result object on failure');
    assert(result.routed === false || typeof result.error === 'string', 'Should indicate failure');
  } finally { rm(tmp); }
});

// ─── ezra-execution-state.js ──────────────────────────────────────────────────

test('execution-state: exports required functions', () => {
  assert(typeof execState.createRun === 'function', 'createRun missing');
  assert(typeof execState.loadRun === 'function', 'loadRun missing');
  assert(typeof execState.saveRun === 'function', 'saveRun missing');
  assert(typeof execState.advanceTask === 'function', 'advanceTask missing');
  assert(typeof execState.advancePhase === 'function', 'advancePhase missing');
  assert(typeof execState.checkpoint === 'function', 'checkpoint missing');
  assert(typeof execState.abortRun === 'function', 'abortRun missing');
  assert(typeof execState.pauseRun === 'function', 'pauseRun missing');
  assert(typeof execState.resumeRun === 'function', 'resumeRun missing');
  assert(typeof execState.completeRun === 'function', 'completeRun missing');
  assert(typeof execState.recordTaskComplete === 'function', 'recordTaskComplete missing');
  assert(typeof execState.recordTaskFailed === 'function', 'recordTaskFailed missing');
});

test('execution-state: exports constants', () => {
  assert(typeof execState.RUN_DIR === 'string', 'RUN_DIR missing');
  assert(typeof execState.CURRENT_RUN_FILE === 'string', 'CURRENT_RUN_FILE missing');
  assert(Array.isArray(execState.STATUSES), 'STATUSES should be array');
  assert(execState.STATUSES.includes('running'), 'STATUSES missing running');
  assert(execState.STATUSES.includes('completed'), 'STATUSES missing completed');
  assert(execState.STATUSES.includes('aborted'), 'STATUSES missing aborted');
});

test('execution-state: createRun creates run with required fields', () => {
  const tmp = tmpDir();
  try {
    const state = execState.createRun(tmp, 'plan-abc123');
    assert(typeof state === 'object', 'createRun should return object');
    assert(typeof state.id === 'string', 'state.id missing');
    assert(state.id.startsWith('run-'), 'id should start with run-');
    assert(state.plan_id === 'plan-abc123', 'plan_id should be stored');
    assert(state.status === 'pending', 'initial status should be pending');
    assert(state.current_phase === 1, 'initial phase should be 1');
    assert(state.current_task_index === 0, 'initial task index should be 0');
    assert(state.tasks_completed === 0, 'initial tasks_completed should be 0');
    assert(state.tasks_failed === 0, 'initial tasks_failed should be 0');
  } finally { rm(tmp); }
});

test('execution-state: createRun writes to disk', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const runFile = path.join(tmp, execState.RUN_DIR, execState.CURRENT_RUN_FILE);
    assert(fs.existsSync(runFile), 'Run file should be created on disk');
  } finally { rm(tmp); }
});

test('execution-state: loadRun returns null for missing run', () => {
  const tmp = tmpDir();
  try {
    const state = execState.loadRun(tmp);
    assert(state === null, 'loadRun should return null for missing run');
  } finally { rm(tmp); }
});

test('execution-state: loadRun reads back created run', () => {
  const tmp = tmpDir();
  try {
    const created = execState.createRun(tmp, 'plan-xyz');
    const loaded = execState.loadRun(tmp);
    assert(loaded !== null, 'loadRun should find the run');
    assert(loaded.id === created.id, 'Loaded id should match created id');
    assert(loaded.plan_id === 'plan-xyz', 'plan_id should be preserved');
  } finally { rm(tmp); }
});

test('execution-state: advanceTask increments task index', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const updated = execState.advanceTask(tmp);
    assert(updated.current_task_index === 1, `Expected task index 1, got ${updated.current_task_index}`);
  } finally { rm(tmp); }
});

test('execution-state: advancePhase increments phase and resets task', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    execState.advanceTask(tmp);
    execState.advanceTask(tmp);
    const updated = execState.advancePhase(tmp);
    assert(updated.current_phase === 2, `Expected phase 2, got ${updated.current_phase}`);
    assert(updated.current_task_index === 0, 'Task index should reset to 0');
  } finally { rm(tmp); }
});

test('execution-state: abortRun sets aborted status', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const updated = execState.abortRun(tmp, 'test abort');
    assert(updated.status === 'aborted', `Expected aborted, got ${updated.status}`);
    assert(typeof updated.aborted_reason === 'string', 'aborted_reason should be string');
  } finally { rm(tmp); }
});

test('execution-state: pauseRun and resumeRun work correctly', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const paused = execState.pauseRun(tmp, 'waiting for decision');
    assert(paused.status === 'paused', 'Should be paused');
    const resumed = execState.resumeRun(tmp);
    assert(resumed.status === 'running', 'Should be running after resume');
  } finally { rm(tmp); }
});

test('execution-state: completeRun sets completed status', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const completed = execState.completeRun(tmp);
    assert(completed.status === 'completed', `Expected completed, got ${completed.status}`);
    assert(typeof completed.completed_at === 'string', 'completed_at should be set');
  } finally { rm(tmp); }
});

test('execution-state: recordTaskComplete increments counter', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const updated = execState.recordTaskComplete(tmp, 't1', { ok: true });
    assert(updated.tasks_completed === 1, `Expected 1, got ${updated.tasks_completed}`);
  } finally { rm(tmp); }
});

test('execution-state: recordTaskFailed increments failure counter', () => {
  const tmp = tmpDir();
  try {
    execState.createRun(tmp, 'plan-test');
    const updated = execState.recordTaskFailed(tmp, 't1', 'test error');
    assert(updated.tasks_failed === 1, `Expected 1, got ${updated.tasks_failed}`);
  } finally { rm(tmp); }
});

// ─── ezra-agent-dispatcher.js ────────────────────────────────────────────────

test('dispatcher: exports required functions', () => {
  assert(typeof dispatcher.getDispatchStrategy === 'function', 'getDispatchStrategy missing');
  assert(typeof dispatcher.buildTaskPrompt === 'function', 'buildTaskPrompt missing');
  assert(typeof dispatcher.dispatchTask === 'function', 'dispatchTask missing');
  assert(typeof dispatcher.validateTaskResult === 'function', 'validateTaskResult missing');
});

test('dispatcher: exports role arrays', () => {
  assert(Array.isArray(dispatcher.SPECIALIST_ROLES), 'SPECIALIST_ROLES should be array');
  assert(Array.isArray(dispatcher.DIRECT_ROLES), 'DIRECT_ROLES should be array');
  assert(dispatcher.SPECIALIST_ROLES.length > 0, 'SPECIALIST_ROLES should not be empty');
  assert(dispatcher.DIRECT_ROLES.includes('code-agent'), 'code-agent should be a direct role');
});

test('dispatcher: getDispatchStrategy returns direct for code-agent', () => {
  const strategy = dispatcher.getDispatchStrategy('code-agent');
  assert(strategy === 'direct', `Expected direct, got ${strategy}`);
});

test('dispatcher: getDispatchStrategy returns specialist for security-specialist', () => {
  const strategy = dispatcher.getDispatchStrategy('security-specialist');
  assert(strategy === 'specialist', `Expected specialist, got ${strategy}`);
});

test('dispatcher: getDispatchStrategy returns specialist for test-engineer', () => {
  const strategy = dispatcher.getDispatchStrategy('test-engineer');
  assert(strategy === 'specialist', `Expected specialist, got ${strategy}`);
});

test('dispatcher: buildTaskPrompt returns non-empty string', () => {
  const task = {
    id: 't1',
    title: 'Implement auth',
    description: 'Create JWT auth',
    acceptance_criteria: 'Users can login',
    file_targets: ['src/auth.ts'],
  };
  const prompt = dispatcher.buildTaskPrompt(task);
  assert(typeof prompt === 'string', 'buildTaskPrompt should return string');
  assert(prompt.length > 0, 'prompt should not be empty');
  assert(prompt.includes('Implement auth'), 'prompt should include task title');
  assert(prompt.includes('Users can login'), 'prompt should include acceptance criteria');
});

test('dispatcher: buildTaskPrompt includes file targets', () => {
  const task = { id: 't1', title: 'T', description: 'D', acceptance_criteria: 'A', file_targets: ['src/foo.ts', 'src/bar.ts'] };
  const prompt = dispatcher.buildTaskPrompt(task);
  assert(prompt.includes('src/foo.ts') || prompt.includes('foo'), 'prompt should mention file targets');
});

test('dispatcher: dispatchTask for direct role returns dispatch result', async () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'Code task', agent_role: 'code-agent', description: 'desc', acceptance_criteria: 'ac', file_targets: [] };
    const result = await dispatcher.dispatchTask(tmp, task);
    assert(typeof result === 'object', 'Should return result');
    assert(result.dispatched === true, 'direct task should be dispatched');
    assert(result.strategy === 'direct', 'strategy should be direct');
    assert(typeof result.prompt === 'string', 'Should include task prompt');
  } finally { rm(tmp); }
});

test('dispatcher: validateTaskResult passes for valid result', () => {
  const task = { id: 't1', title: 'T' };
  const result = { dispatched: true, strategy: 'direct', prompt: 'do stuff' };
  const validation = dispatcher.validateTaskResult(task, result);
  assert(typeof validation === 'object', 'Should return object');
  assert(typeof validation.valid === 'boolean', 'Should have valid field');
  assert(Array.isArray(validation.issues), 'issues should be array');
  assert(validation.valid === true, 'Should be valid');
});

test('dispatcher: validateTaskResult fails for null result', () => {
  const task = { id: 't1', title: 'T' };
  const validation = dispatcher.validateTaskResult(task, null);
  assert(validation.valid === false, 'Should be invalid for null result');
  assert(validation.issues.length > 0, 'Should have issues');
});

// ─── ezra-task-verifier.js ───────────────────────────────────────────────────

test('verifier: exports required functions', () => {
  assert(typeof verifier.checkFileTargetsExist === 'function', 'checkFileTargetsExist missing');
  assert(typeof verifier.checkAcceptanceCriteria === 'function', 'checkAcceptanceCriteria missing');
  assert(typeof verifier.runLintCheck === 'function', 'runLintCheck missing');
  assert(typeof verifier.verifyTask === 'function', 'verifyTask missing');
});

test('verifier: exports VERIFICATION_LEVELS', () => {
  assert(Array.isArray(verifier.VERIFICATION_LEVELS), 'VERIFICATION_LEVELS should be array');
  assert(verifier.VERIFICATION_LEVELS.includes('basic'), 'Should include basic');
  assert(verifier.VERIFICATION_LEVELS.includes('standard'), 'Should include standard');
});

test('verifier: checkFileTargetsExist passes when no file_targets', () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'T', file_targets: [] };
    const result = verifier.checkFileTargetsExist(task, tmp);
    assert(result.passed === true, 'Empty file_targets should pass');
    assert(Array.isArray(result.missing), 'missing should be array');
  } finally { rm(tmp); }
});

test('verifier: checkFileTargetsExist detects missing files', () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'T', file_targets: ['src/nonexistent.ts'] };
    const result = verifier.checkFileTargetsExist(task, tmp);
    assert(result.passed === false, 'Should fail when files missing');
    assert(result.missing.length > 0, 'Should list missing files');
  } finally { rm(tmp); }
});

test('verifier: checkFileTargetsExist passes when files exist', () => {
  const tmp = tmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'existing.ts'), '// file');
    const task = { id: 't1', title: 'T', file_targets: ['src/existing.ts'] };
    const result = verifier.checkFileTargetsExist(task, tmp);
    assert(result.passed === true, 'Should pass when files exist');
    assert(result.missing.length === 0, 'Should have no missing files');
  } finally { rm(tmp); }
});

test('verifier: checkAcceptanceCriteria returns result object', () => {
  const task = { id: 't1', acceptance_criteria: 'Users can login. Sessions are secure.' };
  const result = verifier.checkAcceptanceCriteria(task, 'login session implemented');
  assert(typeof result === 'object', 'Should return object');
  assert(typeof result.passed === 'boolean', 'Should have passed field');
  assert(Array.isArray(result.unchecked), 'Should have unchecked array');
});

test('verifier: runLintCheck returns result object', () => {
  const tmp = tmpDir();
  try {
    const result = verifier.runLintCheck(tmp, []);
    assert(typeof result === 'object', 'Should return object');
    assert(typeof result.passed === 'boolean', 'Should have passed field');
  } finally { rm(tmp); }
});

test('verifier: runLintCheck skips gracefully when no lint script', () => {
  const tmp = tmpDir();
  try {
    // No package.json → should skip gracefully
    const result = verifier.runLintCheck(tmp, []);
    assert(result.passed === true, 'Should pass when no lint script');
    assert(result.skipped === true || result.output.toLowerCase().includes('skip'), 'Should indicate skip');
  } finally { rm(tmp); }
});

test('verifier: verifyTask returns VerificationResult structure', () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'T', file_targets: [], acceptance_criteria: 'Done' };
    const result = verifier.verifyTask(tmp, task, { dispatched: true });
    assert(typeof result === 'object', 'Should return object');
    assert(result.task_id === 't1', 'task_id should be set');
    assert(typeof result.passed === 'boolean', 'Should have passed field');
    assert(Array.isArray(result.findings), 'Should have findings array');
    assert(Array.isArray(result.remediation_hints), 'Should have remediation_hints');
    assert(typeof result.verified_at === 'string', 'verified_at should be ISO string');
  } finally { rm(tmp); }
});

test('verifier: verifyTask passes for task with no file targets', () => {
  const tmp = tmpDir();
  try {
    const task = { id: 't1', title: 'T', file_targets: [], acceptance_criteria: 'Done' };
    const result = verifier.verifyTask(tmp, task, { dispatched: true });
    // No missing files → should pass
    const errors = result.findings.filter(f => f.level === 'error');
    assert(errors.length === 0, `Should have no errors for empty file_targets, got: ${JSON.stringify(errors)}`);
  } finally { rm(tmp); }
});

// ─── oversight phase-gate level ──────────────────────────────────────────────

test('oversight: phase-gate level is supported', () => {
  const oversight = require(path.join(ROOT, 'hooks', 'ezra-oversight.js'));
  assert(typeof oversight.decide === 'function', 'decide function missing');
  const result = oversight.decide([{ severity: 'high', code: 'T001', message: 'test violation' }], 'phase-gate');
  assert(result.decision === 'deny', 'phase-gate should deny on violations');
  assert(result.message.toLowerCase().includes('phase'), 'message should mention phase');
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`  V7-Execution: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
