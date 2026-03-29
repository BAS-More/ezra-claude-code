#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  processEvent,
  hookOutput,
  parseCheckInterval,
  getActivityCount,
  logActivity,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-progress-hook.js'));

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// --- Exports exist ---
test('processEvent is a function', () => {
  assert(typeof processEvent === 'function');
});

test('hookOutput is a function', () => {
  assert(typeof hookOutput === 'function');
});

test('parseCheckInterval is a function', () => {
  assert(typeof parseCheckInterval === 'function');
});

test('getActivityCount is a function', () => {
  assert(typeof getActivityCount === 'function');
});

test('logActivity is a function', () => {
  assert(typeof logActivity === 'function');
});

// --- parseCheckInterval ---
test('parseCheckInterval parses every_N_tasks', () => {
  const n = parseCheckInterval('every_10_tasks');
  assert(n === 10, `expected 10, got ${n}`);
});

test('parseCheckInterval parses every_1_tasks', () => {
  const n = parseCheckInterval('every_1_tasks');
  assert(n === 1, `expected 1, got ${n}`);
});

test('parseCheckInterval passes through numbers', () => {
  const n = parseCheckInterval(42);
  assert(n === 42, `expected 42, got ${n}`);
});

test('parseCheckInterval returns default for invalid input', () => {
  const ms = parseCheckInterval('invalid');
  assert(typeof ms === 'number' && ms > 0, 'should return a positive number');
});

test('parseCheckInterval handles null', () => {
  const ms = parseCheckInterval(null);
  assert(typeof ms === 'number' && ms > 0, 'should return default');
});

// --- getActivityCount ---
test('getActivityCount returns a number', () => {
  const count = getActivityCount();
  assert(typeof count === 'number');
});

// --- hookOutput ---
test('hookOutput returns an object', () => {
  const out = hookOutput({ tool: 'test', event: 'test' });
  assert(typeof out === 'object' && out !== null, `expected object, got ${typeof out}`);
  assert(out.hookSpecificOutput, 'should have hookSpecificOutput');
});

// --- Report ---
console.log(`\n  test-v6-progress-hook: ${passed} passed, ${failed} failed`);
console.log(`  test-v6-progress-hook: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) {
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
}
module.exports = { passed, failed, results };
