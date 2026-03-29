#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { FREQUENCIES, getSchedulerState, isDue, getPendingEntries, approveEntry, rejectEntry } = require(path.join(__dirname, '..', 'hooks', 'ezra-bp-scheduler.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-bp-sched-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- FREQUENCIES ---
test('FREQUENCIES is an array', () => { assert(Array.isArray(FREQUENCIES)); });
test('FREQUENCIES has 3 entries', () => { assert(FREQUENCIES.length === 3, `Got ${FREQUENCIES.length}`); });
test('FREQUENCIES includes daily', () => { assert(FREQUENCIES.includes('daily')); });
test('FREQUENCIES includes weekly', () => { assert(FREQUENCIES.includes('weekly')); });
test('FREQUENCIES includes manual', () => { assert(FREQUENCIES.includes('manual')); });

// --- getSchedulerState ---
test('getSchedulerState is a function', () => { assert(typeof getSchedulerState === 'function'); });
test('getSchedulerState returns defaults for missing dir', () => {
  const s = getSchedulerState(path.join(os.tmpdir(), 'nonexist-' + Date.now()));
  assert(typeof s === 'object' && s !== null);
  assert(s.last_run === null || s.last_run === undefined || s.last_run === '');
  assert(typeof s.frequency === 'string');
  assert(typeof s.auto_add === 'boolean');
});
test('getSchedulerState defaults frequency is weekly', () => {
  const s = getSchedulerState(path.join(os.tmpdir(), 'nonexist2-' + Date.now()));
  assert(s.frequency === 'weekly', `Got ${s.frequency}`);
});

// --- isDue ---
test('isDue is a function', () => { assert(typeof isDue === 'function'); });
test('isDue manual → false', () => { assert(isDue({ frequency: 'manual', last_run: null }) === false); });
test('isDue daily no last_run → true', () => { assert(isDue({ frequency: 'daily', last_run: null }) === true); });
test('isDue weekly no last_run → true', () => { assert(isDue({ frequency: 'weekly', last_run: null }) === true); });
test('isDue daily recent → false', () => {
  assert(isDue({ frequency: 'daily', last_run: new Date().toISOString() }) === false);
});
test('isDue daily old → true', () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  assert(isDue({ frequency: 'daily', last_run: old }) === true);
});
test('isDue weekly old → true', () => {
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  assert(isDue({ frequency: 'weekly', last_run: old }) === true);
});
test('isDue weekly recent → false', () => {
  assert(isDue({ frequency: 'weekly', last_run: new Date().toISOString() }) === false);
});

// --- getPendingEntries ---
test('getPendingEntries is a function', () => { assert(typeof getPendingEntries === 'function'); });
test('getPendingEntries returns [] for missing dir', () => {
  const r = getPendingEntries(path.join(os.tmpdir(), 'nonexist-' + Date.now()));
  assert(Array.isArray(r) && r.length === 0);
});

// --- approveEntry / rejectEntry ---
test('approveEntry is a function', () => { assert(typeof approveEntry === 'function'); });
test('rejectEntry is a function', () => { assert(typeof rejectEntry === 'function'); });
test('approveEntry throws for missing file', () => {
  let threw = false;
  try { approveEntry(tmpDir, 'nonexistent.yaml'); } catch (e) { threw = true; assert(e.message.includes('not found')); }
  assert(threw, 'Should have thrown');
});
test('rejectEntry throws for missing file', () => {
  let threw = false;
  try { rejectEntry(tmpDir, 'nonexistent.yaml'); } catch (e) { threw = true; assert(e.message.includes('not found')); }
  assert(threw, 'Should have thrown');
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-bp-scheduler: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-bp-scheduler: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
