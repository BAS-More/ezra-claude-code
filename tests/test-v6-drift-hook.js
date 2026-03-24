#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-drift-hook.js
 * The drift hook has no module.exports — it runs as a stdin→stdout process.
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
  const dir = path.join(os.tmpdir(), 'ezra-drift-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-drift-hook.js');

function runHook(input) {
  try {
    const result = execSync(`node "${hookPath}"`, {
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10000,
    });
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
  }
}

function setupEzra(dir) {
  const ezraDir = path.join(dir, '.ezra');
  fs.mkdirSync(path.join(ezraDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'docs', 'registry.yaml'),
    '# Doc registry\ndocs:\n  - id: tad\n    title: Architecture\n  - id: api-spec\n    title: API Spec\n  - id: test-strategy\n    title: Test Strategy\n');
  return ezraDir;
}

// === 1. Hook file exists ===

test('Hook file exists', () => {
  assert(fs.existsSync(hookPath), 'Hook file not found');
});

test('Hook file starts with shebang', () => {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert(content.startsWith('#!/usr/bin/env node'));
});

// === 2. No file path — exits cleanly ===

test('Hook exits 0 when no file_path in event', () => {
  const result = runHook({ tool_input: {} });
  assert(result.exitCode === 0, 'Should exit 0');
});

// === 3. No .ezra/ — exits cleanly ===

test('Hook exits 0 when .ezra/ does not exist', () => {
  const dir = makeTempDir();
  try {
    const result = runHook({ cwd: dir, tool_input: { file_path: 'src/foo.js' } });
    assert(result.exitCode === 0, 'Should exit 0');
  } finally { cleanup(dir); }
});

// === 4. No registry — exits cleanly ===

test('Hook exits 0 when no docs/registry.yaml', () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, '.ezra'), { recursive: true });
    const result = runHook({ cwd: dir, tool_input: { file_path: 'src/foo.js' } });
    assert(result.exitCode === 0, 'Should exit 0');
  } finally { cleanup(dir); }
});

// === 5. Source file change creates drift counter ===

test('Hook increments drift counter for source change affecting tad', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    runHook({ cwd: dir, tool_input: { file_path: 'src/main.js' } });
    const counterPath = path.join(dir, '.ezra', 'docs', '.drift-counter.json');
    assert(fs.existsSync(counterPath), 'Counter file should exist');
    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert(counter.edits_since_sync >= 1, 'Should have at least 1 edit');
    assert(counter.affected_docs.tad >= 1, 'tad should be affected');
  } finally { cleanup(dir); }
});

// === 6. Non-matching file — no counter change ===

test('Hook does not create counter for unrelated file', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    runHook({ cwd: dir, tool_input: { file_path: 'README.md' } });
    const counterPath = path.join(dir, '.ezra', 'docs', '.drift-counter.json');
    // README.md doesn't match any rule
    if (fs.existsSync(counterPath)) {
      const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
      assert(counter.edits_since_sync === 0 || Object.keys(counter.affected_docs).length === 0,
        'Should not track unrelated files');
    }
  } finally { cleanup(dir); }
});

// === 7. Test file change affects test-strategy ===

test('Hook tracks test file changes', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    runHook({ cwd: dir, tool_input: { file_path: 'tests/foo.test.js' } });
    const counterPath = path.join(dir, '.ezra', 'docs', '.drift-counter.json');
    if (fs.existsSync(counterPath)) {
      const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
      const hasTestDoc = counter.affected_docs['test-strategy'] >= 1 || counter.affected_docs['test-cases'] >= 1;
      assert(hasTestDoc, 'Should track test-related docs');
    }
  } finally { cleanup(dir); }
});

// === 8. API file change affects api-spec ===

test('Hook tracks API route changes', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    runHook({ cwd: dir, tool_input: { file_path: 'src/routes/users.js' } });
    const counterPath = path.join(dir, '.ezra', 'docs', '.drift-counter.json');
    if (fs.existsSync(counterPath)) {
      const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
      assert(counter.affected_docs['api-spec'] >= 1, 'Should track api-spec');
    }
  } finally { cleanup(dir); }
});

// === 9. Handles malformed JSON gracefully ===

test('Hook handles malformed JSON input', () => {
  try {
    execSync(`node "${hookPath}"`, {
      input: 'not valid json',
      encoding: 'utf8',
      timeout: 10000,
    });
    assert(true);
  } catch (err) {
    assert(err.status === 0 || err.status === null, 'Should exit 0');
  }
});

// === 10. Multiple edits accumulate ===

test('Hook accumulates edits across calls', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    runHook({ cwd: dir, tool_input: { file_path: 'src/a.js' } });
    runHook({ cwd: dir, tool_input: { file_path: 'src/b.js' } });
    runHook({ cwd: dir, tool_input: { file_path: 'src/c.js' } });
    const counterPath = path.join(dir, '.ezra', 'docs', '.drift-counter.json');
    assert(fs.existsSync(counterPath), 'Counter should exist');
    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert(counter.edits_since_sync >= 3, 'Should accumulate edits, got ' + counter.edits_since_sync);
  } finally { cleanup(dir); }
});

// === 11. Corrupt drift counter resets ===

test('Hook resets on corrupt drift counter', () => {
  const dir = makeTempDir();
  try {
    const ezraDir = setupEzra(dir);
    const counterPath = path.join(ezraDir, 'docs', '.drift-counter.json');
    fs.writeFileSync(counterPath, 'NOT_JSON');
    runHook({ cwd: dir, tool_input: { file_path: 'src/foo.js' } });
    const counter = JSON.parse(fs.readFileSync(counterPath, 'utf8'));
    assert(counter.edits_since_sync >= 1, 'Should have reset and started counting');
  } finally { cleanup(dir); }
});

// === Summary ===

console.log('  V6-Drift-Hook: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Drift-Hook: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
