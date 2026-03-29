#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-settings.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-settings-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- DEFAULTS ---
test('DEFAULTS is an object', () => { assert(typeof mod.DEFAULTS === 'object' && mod.DEFAULTS !== null); });
test('DEFAULTS has standards', () => { assert(typeof mod.DEFAULTS.standards === 'object'); });
test('DEFAULTS has security', () => { assert(typeof mod.DEFAULTS.security === 'object'); });
test('DEFAULTS has oversight', () => { assert(typeof mod.DEFAULTS.oversight === 'object'); });
test('DEFAULTS has many sections', () => { assert(Object.keys(mod.DEFAULTS).length >= 15, `Got ${Object.keys(mod.DEFAULTS).length}`); });

// --- getDefault ---
test('getDefault returns deep clone', () => {
  const a = mod.getDefault();
  const b = mod.getDefault();
  assert(a !== b, 'Should be different objects');
  assert(JSON.stringify(a) === JSON.stringify(b), 'Should have same content');
});

// --- loadSettings ---
test('loadSettings returns object for empty dir', () => {
  if (mod._invalidateCache) mod._invalidateCache();
  const s = mod.loadSettings(tmpDir);
  assert(typeof s === 'object' && s !== null);
});
test('loadSettings returns defaults for empty dir', () => {
  if (mod._invalidateCache) mod._invalidateCache();
  const s = mod.loadSettings(tmpDir);
  assert(typeof s.standards === 'object');
});
test('loadSettings reads .ezra/settings.yaml', () => {
  const ezraDir = path.join(tmpDir, '.ezra');
  fs.mkdirSync(ezraDir, { recursive: true });
  fs.writeFileSync(path.join(ezraDir, 'settings.yaml'), 'standards:\n  level: strict\n');
  if (mod._invalidateCache) mod._invalidateCache();
  const s = mod.loadSettings(tmpDir);
  assert(s.standards.level === 'strict', `Got ${s.standards.level}`);
});

// --- _invalidateCache ---
test('_invalidateCache is a function', () => { assert(typeof mod._invalidateCache === 'function'); });
test('_invalidateCache does not throw', () => { mod._invalidateCache(); });

// --- Section accessors ---
const accessors = [
  'getStandards', 'getSecurity', 'getOversight', 'getBestPractices',
  'getLicensing', 'getPlanning', 'getMemory', 'getWorkflows',
  'getSelfLearning', 'getProjectManager', 'getAgents', 'getDashboard',
  'getCloudSync', 'getLibrary', 'getNotifications', 'getExecution', 'getQuiz2Build'
];

for (const name of accessors) {
  test(`${name} is a function`, () => { assert(typeof mod[name] === 'function'); });
  test(`${name} returns object`, () => {
    if (mod._invalidateCache) mod._invalidateCache();
    const r = mod[name](tmpDir);
    assert(typeof r === 'object' && r !== null, `${name} returned ${typeof r}`);
  });
}

// --- parseYamlSimple / parseValue / deepMerge (re-exports) ---
test('parseYamlSimple is a function', () => { assert(typeof mod.parseYamlSimple === 'function'); });
test('parseValue is a function', () => { assert(typeof mod.parseValue === 'function'); });
test('deepMerge is a function', () => { assert(typeof mod.deepMerge === 'function'); });

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-settings: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-settings: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
