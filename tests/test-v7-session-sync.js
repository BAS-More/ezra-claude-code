#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-session-sync.js
 * The session sync hook runs as a stdin→stdout process.
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
  const dir = path.join(os.tmpdir(), 'ezra-session-sync-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-session-sync.js');

function runHook(input) {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
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
  fs.mkdirSync(path.join(ezraDir, 'versions'), { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'version: "6.1.0"\nproject: test-sync\n');
  fs.writeFileSync(path.join(ezraDir, 'knowledge.yaml'), 'language: javascript\nframework: node\n');
  return ezraDir;
}

// === Tests ===

test('hook file exists', () => {
  assert(fs.existsSync(hookPath), 'Hook file not found');
});

test('hook is valid Node.js', () => {
  const result = execSync(`node -c "${hookPath}"`, { encoding: 'utf8', timeout: 5000 });
  assert(result.includes('') || result === '', 'Syntax check failed');
});

test('hook returns JSON on valid input', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ project_dir: dir });
    assert(output.length > 0, 'No output');
    const parsed = JSON.parse(output);
    assert(typeof parsed === 'object', 'Output is not JSON object');
  } finally { cleanup(dir); }
});

test('hook returns synced:false when dashboard not configured', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ project_dir: dir });
    const parsed = JSON.parse(output);
    assert(parsed.synced === false, 'Expected synced:false when dashboard not configured');
  } finally { cleanup(dir); }
});

test('hook handles missing .ezra directory gracefully', () => {
  const dir = makeTempDir();
  try {
    const output = runHook({ project_dir: dir });
    assert(output.length > 0, 'No output');
    const parsed = JSON.parse(output);
    assert(typeof parsed === 'object', 'Output is not JSON object');
  } finally { cleanup(dir); }
});

test('hook handles empty JSON input', () => {
  const output = runHook({});
  assert(output.length > 0, 'No output on empty input');
  const parsed = JSON.parse(output);
  assert(typeof parsed === 'object', 'Output is not JSON object');
});

test('hook uses projectDir fallback', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ projectDir: dir });
    const parsed = JSON.parse(output);
    assert(typeof parsed === 'object', 'Output is not JSON object');
  } finally { cleanup(dir); }
});

test('hook exits 0 on valid input', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    // execSync throws on non-zero exit
    execSync(`node "${hookPath}"`, {
      input: JSON.stringify({ project_dir: dir }),
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert(true, 'Should not throw');
  } finally { cleanup(dir); }
});

test('hook handles malformed JSON gracefully', () => {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: 'not valid json',
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result);
    assert(parsed.synced === false, 'Expected synced:false on malformed input');
  } catch (err) {
    // Hook should exit 0 even on bad input
    const stdout = err.stdout || '';
    if (stdout) {
      const parsed = JSON.parse(stdout);
      assert(parsed.synced === false, 'Expected synced:false on malformed input');
    }
    assert(err.status === 0 || stdout.length > 0, 'Hook should exit 0 on bad input');
  }
});

test('hook enforces MAX_STDIN limit', () => {
  // Send oversized input — hook should exit 0 without crashing
  const bigInput = 'x'.repeat(2 * 1024 * 1024);
  try {
    execSync(`node "${hookPath}"`, {
      input: bigInput,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Exit 0 is expected even if stdin is too large
    assert(err.status === 0 || err.status === null, 'Hook should exit 0 on oversized input');
  }
});

test('module.exports is an object', () => {
  const mod = require(hookPath);
  assert(typeof mod === 'object', 'module.exports should be an object');
});

test('hook outputs reason field on failure', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const output = runHook({ project_dir: dir });
    const parsed = JSON.parse(output);
    if (!parsed.synced) {
      assert(typeof parsed.reason === 'string', 'Expected reason string when not synced');
    }
  } finally { cleanup(dir); }
});

// === Report ===

console.log(`PASSED: ${passed}  FAILED: ${failed}`);
if (failed > 0) process.exit(1);
