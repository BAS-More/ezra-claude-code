#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-execution-state.js — Persistent run state manager.
 * Uses built-in fs/path/crypto modules. ZERO external dependencies.
 * Hook protocol: reads JSON from stdin, writes JSON to stdout, exits 0.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_STDIN = 1024 * 1024; // 1 MB

const RUN_DIR = '.ezra/execution';
const CURRENT_RUN_FILE = 'current-run.yaml';
const STATUSES = ['pending', 'running', 'paused', 'completed', 'failed', 'aborted'];

// ─── YAML Helpers ─────────────────────────────────────────────────

function stateToYaml(state) {
  return Object.entries(state).map(([k, v]) =>
    k + ': ' + (v === null || v === undefined ? 'null'
      : (Array.isArray(v) || typeof v === 'object') ? JSON.stringify(v) : v)
  ).join('\n') + '\n';
}

function yamlToState(text) {
  const state = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const ci = line.indexOf(':');
    if (ci < 1) continue;
    const key = line.slice(0, ci).trim();
    const val = line.slice(ci + 1).trim();
    if (!val || val === 'null') { state[key] = null; }
    else if (val === 'true') { state[key] = true; }
    else if (val === 'false') { state[key] = false; }
    else if (/^-?\d+$/.test(val)) { state[key] = parseInt(val, 10); }
    else if (val.startsWith('[') || val.startsWith('{')) {
      try { state[key] = JSON.parse(val); } catch (_) { state[key] = val; }
    } else { state[key] = val; }
  }
  return state;
}

// ─── File Helpers ─────────────────────────────────────────────────

function runFilePath(projectDir) {
  return path.join(projectDir, RUN_DIR, CURRENT_RUN_FILE);
}

function ensureRunDir(projectDir) {
  const dir = path.join(projectDir, RUN_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadRun(projectDir) {
  const fp = runFilePath(projectDir);
  if (!fs.existsSync(fp)) return null;
  try { return yamlToState(fs.readFileSync(fp, 'utf8')); } catch (_) { return null; }
}

function saveRun(projectDir, state) {
  ensureRunDir(projectDir);
  fs.writeFileSync(runFilePath(projectDir), stateToYaml(state), 'utf8');
}

/** Load, apply mutator fn, save, return updated state. */
function mutateRun(projectDir, fn) {
  const state = loadRun(projectDir);
  if (!state) return null;
  fn(state);
  saveRun(projectDir, state);
  return state;
}

// ─── Exported Functions ───────────────────────────────────────────

function createRun(projectDir, planId) {
  ensureRunDir(projectDir);
  const state = {
    id: 'run-' + crypto.randomBytes(4).toString('hex'),
    plan_id: planId || null, status: 'pending',
    current_phase: 1, current_task_index: 0,
    started_at: null, completed_at: null,
    checkpoint_data: '{}', tasks_completed: 0, tasks_failed: 0,
    errors: '[]', completed_tasks: '[]',
  };
  saveRun(projectDir, state);
  return state;
}

function advanceTask(projectDir) {
  return mutateRun(projectDir, (s) => { s.current_task_index = (parseInt(s.current_task_index, 10) || 0) + 1; });
}

function advancePhase(projectDir) {
  return mutateRun(projectDir, (s) => { s.current_phase = (parseInt(s.current_phase, 10) || 1) + 1; s.current_task_index = 0; });
}

function checkpoint(projectDir, data) {
  return mutateRun(projectDir, (s) => { s.checkpoint_data = JSON.stringify({ ...data, timestamp: new Date().toISOString() }); });
}

function abortRun(projectDir, reason) {
  return mutateRun(projectDir, (s) => { s.status = 'aborted'; s.aborted_reason = reason || ''; });
}

function pauseRun(projectDir, reason) {
  return mutateRun(projectDir, (s) => { s.status = 'paused'; s.pause_reason = reason || ''; });
}

function resumeRun(projectDir) {
  return mutateRun(projectDir, (s) => { s.status = 'running'; });
}

function completeRun(projectDir) {
  return mutateRun(projectDir, (s) => { s.status = 'completed'; s.completed_at = new Date().toISOString(); });
}

function recordTaskComplete(projectDir, taskId, result) {
  return mutateRun(projectDir, (s) => {
    s.tasks_completed = (parseInt(s.tasks_completed, 10) || 0) + 1;
    let arr = []; try { arr = JSON.parse(s.completed_tasks || '[]'); } catch (_) { arr = []; }
    arr.push({ task_id: taskId, result, completed_at: new Date().toISOString() });
    s.completed_tasks = JSON.stringify(arr);
  });
}

function recordTaskFailed(projectDir, taskId, error) {
  return mutateRun(projectDir, (s) => {
    s.tasks_failed = (parseInt(s.tasks_failed, 10) || 0) + 1;
    let arr = []; try { arr = JSON.parse(s.errors || '[]'); } catch (_) { arr = []; }
    arr.push({ task_id: taskId, error, failed_at: new Date().toISOString() });
    s.errors = JSON.stringify(arr);
  });
}

// ─── Hook Protocol ────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; if (raw.length > MAX_STDIN) raw = raw.slice(0, MAX_STDIN); });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch (_) { input = {}; }
    const action = input.action || '';
    const pd = input.project_dir || process.cwd();
    let out = {};
    try {
      if (action === 'create')  out = createRun(pd, input.plan_id) || {};
      else if (action === 'load' || action === 'status') out = loadRun(pd) || { status: 'no_run' };
      else if (action === 'advance') out = advanceTask(pd) || { error: 'No active run' };
      else if (action === 'abort')   out = abortRun(pd, input.reason) || { error: 'No active run' };
      else out = { ok: false, error: 'Unknown action: ' + action };
    } catch (e) { out = { ok: false, error: e.message }; }
    process.stdout.write(JSON.stringify(out) + '\n');
    process.exit(0);
  });
}

// ─── Exports ──────────────────────────────────────────────────────

module.exports = {
  RUN_DIR, CURRENT_RUN_FILE, STATUSES,
  createRun, loadRun, saveRun, advanceTask, advancePhase,
  checkpoint, abortRun, pauseRun, resumeRun, completeRun,
  recordTaskComplete, recordTaskFailed,
};
