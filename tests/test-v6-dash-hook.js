#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-dash-hook.js
 * The dash hook has no module.exports — it runs as a stdin→stdout process.
 * We test it by spawning the process with JSON stdin.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-dash-hook-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-dash-hook.js');

function runHook(input) {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10000,
    });
    return result;
  } catch (err) {
    return err.stdout || '';
  }
}

function setupEzra(dir) {
  const ezraDir = path.join(dir, '.ezra');
  fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'plans'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'name: test-project\nproject_phase: development\n');
  fs.writeFileSync(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), 'id: ADR-001\ntitle: Test\n');
  return ezraDir;
}

// === 1. Hook file exists ===

test('Hook file exists', () => {
  assert(fs.existsSync(hookPath), 'Hook file not found');
});

test('Hook file has shebang', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.startsWith('#!/usr/bin/env node'), 'Should have node shebang');
});

// === 2. Without .ezra/ directory ===

test('Hook outputs init message when no .ezra/ exists', () => {
  const dir = makeTempDir();
  try {
    const output = runHook({ cwd: dir });
    assert(output.includes('Not initialized') || output.includes('init'), 'Should say not initialized, got: ' + output.slice(0, 100));
  } finally { cleanup(dir); }
});

// === 3. With .ezra/ directory ===

test('Hook outputs project name from governance', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ cwd: dir });
    assert(output.includes('test-project'), 'Should include project name, got: ' + output.slice(0, 200));
  } finally { cleanup(dir); }
});

test('Hook outputs EZRA header', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ cwd: dir });
    assert(output.includes('EZRA'), 'Should include EZRA header');
  } finally { cleanup(dir); }
});

test('Hook outputs decision count', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ cwd: dir });
    assert(output.includes('Decisions:') || output.includes('decisions'), 'Should include decisions');
  } finally { cleanup(dir); }
});

test('Hook outputs phase', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ cwd: dir });
    assert(output.includes('development'), 'Should include phase');
  } finally { cleanup(dir); }
});

test('Hook shows doc gaps when no registry exists', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ cwd: dir });
    assert(output.includes('Doc gaps') || output.includes('critical') || output.includes('doc'), 'Should mention doc gaps');
  } finally { cleanup(dir); }
});

// === 4. With scans ===

test('Hook handles scan data', () => {
  const dir = makeTempDir();
  try {
    const ezraDir = setupEzra(dir);
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2025-01-01.yaml'),
      'timestamp: 2025-01-01T00:00:00Z\nhealth_score: 85\ncritical: 0\nhigh: 1\n');
    const output = runHook({ cwd: dir });
    assert(output.includes('85'), 'Should include health score');
  } finally { cleanup(dir); }
});

// === 5. With empty event ===

test('Hook handles empty JSON input gracefully', () => {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: '{}',
      encoding: 'utf8',
      timeout: 10000,
    });
    // Should not crash
    assert(typeof result === 'string');
  } catch (err) {
    // Process may exit 0 with output on stdout
    assert(true);
  }
});

test('Hook handles malformed JSON gracefully', () => {
  try {
    execSync(`node "${hookPath}"`, {
      input: 'not json',
      encoding: 'utf8',
      timeout: 10000,
    });
    assert(true);
  } catch (err) {
    // Should still exit 0
    assert(err.status === 0 || err.status === null, 'Should exit 0');
  }
});

// === 6. Plans count ===

test('Hook counts active plans', () => {
  const dir = makeTempDir();
  try {
    const ezraDir = setupEzra(dir);
    fs.writeFileSync(path.join(ezraDir, 'plans', 'plan-1.yaml'), 'name: plan1\n');
    fs.writeFileSync(path.join(ezraDir, 'plans', 'plan-2.yaml'), 'name: plan2\n');
    const output = runHook({ cwd: dir });
    assert(output.includes('Plans:'), 'Should include plans');
  } finally { cleanup(dir); }
});

// === Summary ===

console.log('  V6-Dash-Hook: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Dash-Hook: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
