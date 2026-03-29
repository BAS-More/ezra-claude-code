#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SCHEMA, validate, serialise, load, save } = require(path.join(__dirname, '..', 'hooks', 'ezra-project-definition.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-proj-def-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const validDef = { project_name: 'TestProject', tech_stack: 'Node.js', description: 'A test project' };

// --- SCHEMA ---
test('SCHEMA is an object', () => { assert(typeof SCHEMA === 'object' && SCHEMA !== null); });
test('SCHEMA has required array', () => { assert(Array.isArray(SCHEMA.required)); });
test('SCHEMA required includes project_name', () => { assert(SCHEMA.required.includes('project_name')); });
test('SCHEMA required includes tech_stack', () => { assert(SCHEMA.required.includes('tech_stack')); });
test('SCHEMA required includes description', () => { assert(SCHEMA.required.includes('description')); });
test('SCHEMA has domains array', () => { assert(Array.isArray(SCHEMA.domains)); });
test('SCHEMA domains has 21 entries', () => { assert(SCHEMA.domains.length === 21, `Got ${SCHEMA.domains.length}`); });

// --- validate ---
test('validate is a function', () => { assert(typeof validate === 'function'); });
test('validate valid def', () => {
  const r = validate(validDef);
  assert(r.valid === true, `Expected valid, got errors: ${(r.errors || []).join(', ')}`);
  assert(Array.isArray(r.errors) && r.errors.length === 0);
});
test('validate missing project_name', () => {
  const r = validate({ tech_stack: 'Node.js', description: 'test' });
  assert(r.valid === false);
  assert(r.errors.some(e => e.includes('project_name')));
});
test('validate missing all required', () => {
  const r = validate({});
  assert(r.valid === false);
  assert(r.errors.length === 3, `Expected 3 errors, got ${r.errors.length}`);
});
test('validate with extra fields is valid', () => {
  const r = validate({ ...validDef, auth_strategy: 'JWT', phases: [] });
  assert(r.valid === true);
});

// --- serialise ---
test('serialise is a function', () => { assert(typeof serialise === 'function'); });
test('serialise returns string', () => {
  const s = serialise(validDef);
  assert(typeof s === 'string' && s.length > 0);
});
test('serialise includes project_name', () => {
  const s = serialise(validDef);
  assert(s.includes('project_name') || s.includes('TestProject'));
});

// --- save / load ---
test('save is a function', () => { assert(typeof save === 'function'); });
test('load is a function', () => { assert(typeof load === 'function'); });
test('save returns file path', () => {
  const p = save(tmpDir, validDef);
  assert(typeof p === 'string' && p.includes('project-definition'));
});
test('load reads saved def', () => {
  save(tmpDir, validDef);
  const loaded = load(tmpDir);
  assert(loaded !== null, 'load returned null');
  assert(loaded.project_name === 'TestProject');
});
test('load returns null for missing dir', () => {
  const r = load(path.join(os.tmpdir(), 'nonexistent-' + Date.now()));
  assert(r === null);
});
test('save + load roundtrip preserves fields', () => {
  const def = { ...validDef, auth_strategy: 'JWT', security_level: 'high' };
  save(tmpDir, def);
  const loaded = load(tmpDir);
  assert(loaded && loaded.auth_strategy === 'JWT');
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-project-definition: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-project-definition: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
