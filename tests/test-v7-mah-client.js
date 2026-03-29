#!/usr/bin/env node
'use strict';
const path = require('path');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-mah-client.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- MAH_ENDPOINT_DEFAULT ---
test('MAH_ENDPOINT_DEFAULT is a string', () => { assert(typeof mod.MAH_ENDPOINT_DEFAULT === 'string'); });
test('MAH_ENDPOINT_DEFAULT is localhost', () => { assert(mod.MAH_ENDPOINT_DEFAULT.includes('localhost')); });

// --- getMahEndpoint ---
test('getMahEndpoint is a function', () => { assert(typeof mod.getMahEndpoint === 'function'); });
test('getMahEndpoint returns string', () => {
  const ep = mod.getMahEndpoint(os.tmpdir());
  assert(typeof ep === 'string' && ep.startsWith('http'));
});

// --- Async functions exist ---
test('routeTask is a function', () => { assert(typeof mod.routeTask === 'function'); });
test('routeSecurityAudit is a function', () => { assert(typeof mod.routeSecurityAudit === 'function'); });
test('routeArchitectureReview is a function', () => { assert(typeof mod.routeArchitectureReview === 'function'); });
test('routeDocumentParse is a function', () => { assert(typeof mod.routeDocumentParse === 'function'); });

// --- routeTask returns promise ---
test('routeTask returns promise', () => {
  const task = { task_id: 't1', title: 'Test', agent_role: 'code-agent', description: 'X', acceptance_criteria: [] };
  const r = mod.routeTask(os.tmpdir(), task);
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

// --- routeSecurityAudit returns promise ---
test('routeSecurityAudit returns promise', () => {
  const r = mod.routeSecurityAudit(os.tmpdir(), { scope: 'full' });
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

// --- routeArchitectureReview returns promise ---
test('routeArchitectureReview returns promise', () => {
  const r = mod.routeArchitectureReview(os.tmpdir(), { scope: 'full' });
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

// --- routeDocumentParse returns promise ---
test('routeDocumentParse returns promise', () => {
  const r = mod.routeDocumentParse(os.tmpdir(), '/tmp/test.pdf', 'application/pdf');
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

console.log(`\n  test-v7-mah-client: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-mah-client: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
