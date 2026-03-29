#!/usr/bin/env node
'use strict';
const path = require('path');
const { DEPLOY_TARGETS, triggerDeploy, triggerVercel, triggerRailway, triggerCustom } = require(path.join(__dirname, '..', 'hooks', 'ezra-deploy-trigger.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- DEPLOY_TARGETS ---
test('DEPLOY_TARGETS is an array', () => { assert(Array.isArray(DEPLOY_TARGETS)); });
test('DEPLOY_TARGETS has 4 entries', () => { assert(DEPLOY_TARGETS.length === 4, `Got ${DEPLOY_TARGETS.length}`); });
test('DEPLOY_TARGETS includes vercel', () => { assert(DEPLOY_TARGETS.includes('vercel')); });
test('DEPLOY_TARGETS includes railway', () => { assert(DEPLOY_TARGETS.includes('railway')); });
test('DEPLOY_TARGETS includes netlify', () => { assert(DEPLOY_TARGETS.includes('netlify')); });
test('DEPLOY_TARGETS includes custom', () => { assert(DEPLOY_TARGETS.includes('custom')); });

// --- Functions exist ---
test('triggerDeploy is a function', () => { assert(typeof triggerDeploy === 'function'); });
test('triggerVercel is a function', () => { assert(typeof triggerVercel === 'function'); });
test('triggerRailway is a function', () => { assert(typeof triggerRailway === 'function'); });
test('triggerCustom is a function', () => { assert(typeof triggerCustom === 'function'); });

// --- triggerVercel returns graceful error without http ---
test('triggerVercel returns promise', () => {
  const result = triggerVercel('https://example.com/hook');
  assert(result && typeof result.then === 'function', 'Should return promise');
  result.catch(() => {}); // suppress unhandled rejection
});
test('triggerRailway returns promise', () => {
  const result = triggerRailway('https://example.com/hook');
  assert(result && typeof result.then === 'function', 'Should return promise');
  result.catch(() => {}); // suppress unhandled rejection
});
test('triggerCustom returns promise', () => {
  const result = triggerCustom('https://example.com/hook', { data: 1 });
  assert(result && typeof result.then === 'function', 'Should return promise');
  result.catch(() => {}); // suppress unhandled rejection
});

console.log(`\n  test-v7-deploy-trigger: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-deploy-trigger: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
