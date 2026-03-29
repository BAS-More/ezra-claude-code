#!/usr/bin/env node
'use strict';
const path = require('path');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-quiz2build-client.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- Q2B_DOCUMENT_TYPES ---
test('Q2B_DOCUMENT_TYPES is an array', () => { assert(Array.isArray(mod.Q2B_DOCUMENT_TYPES)); });
test('Q2B_DOCUMENT_TYPES has 8 entries', () => { assert(mod.Q2B_DOCUMENT_TYPES.length === 8, `Got ${mod.Q2B_DOCUMENT_TYPES.length}`); });
test('Q2B_DOCUMENT_TYPES entries are strings', () => { assert(mod.Q2B_DOCUMENT_TYPES.every(t => typeof t === 'string')); });

// --- Q2B_DIMENSIONS ---
test('Q2B_DIMENSIONS is an array', () => { assert(Array.isArray(mod.Q2B_DIMENSIONS)); });
test('Q2B_DIMENSIONS has 7 entries', () => { assert(mod.Q2B_DIMENSIONS.length === 7, `Got ${mod.Q2B_DIMENSIONS.length}`); });

// --- EZRA_DOMAIN_MAP ---
test('EZRA_DOMAIN_MAP is an object', () => { assert(typeof mod.EZRA_DOMAIN_MAP === 'object' && mod.EZRA_DOMAIN_MAP !== null); });
test('EZRA_DOMAIN_MAP has 7 keys', () => { assert(Object.keys(mod.EZRA_DOMAIN_MAP).length === 7, `Got ${Object.keys(mod.EZRA_DOMAIN_MAP).length}`); });
test('EZRA_DOMAIN_MAP values are arrays', () => {
  assert(Object.values(mod.EZRA_DOMAIN_MAP).every(v => Array.isArray(v)));
});

// --- API functions are exported ---
const apiFns = [
  'login', 'refreshToken', 'getSession', 'importScore', 'importHeatmap',
  'importFacts', 'submitFacts', 'calculateScore', 'generateDocument',
  'downloadDocument', 'importDocuments', 'getNextQuestions',
  'registerGithubAdapter', 'syncAdapter'
];
for (const fn of apiFns) {
  test(`${fn} is a function`, () => { assert(typeof mod[fn] === 'function', `${fn} is ${typeof mod[fn]}`); });
}

// --- heatmapToRiskRegister ---
test('heatmapToRiskRegister is a function', () => { assert(typeof mod.heatmapToRiskRegister === 'function'); });
test('heatmapToRiskRegister with empty → []', () => {
  const r = mod.heatmapToRiskRegister({});
  assert(Array.isArray(r) && r.length === 0);
});
test('heatmapToRiskRegister with red cells', () => {
  // Heatmap expects dimension keys from Q2B_DIMENSIONS with cell arrays
  const dim = mod.Q2B_DIMENSIONS[0];
  const heatmap = { [dim]: [{ colour: 'red', gap: 'Missing coverage' }] };
  const r = mod.heatmapToRiskRegister(heatmap);
  assert(Array.isArray(r));
  assert(r.length > 0, 'Should flag red cells as risks');
});
test('heatmapToRiskRegister with green cells → no risks', () => {
  const dim = mod.Q2B_DIMENSIONS[0];
  const heatmap = { [dim]: [{ colour: 'green', gap: 'All good' }] };
  const r = mod.heatmapToRiskRegister(heatmap);
  assert(Array.isArray(r));
  assert(r.length === 0, 'Green should not create risks');
});
test('heatmapToRiskRegister risk shape', () => {
  const dim = mod.Q2B_DIMENSIONS[0];
  const heatmap = { [dim]: [{ colour: 'amber', gap: 'Partial coverage' }] };
  const r = mod.heatmapToRiskRegister(heatmap);
  if (r.length > 0) {
    assert(typeof r[0].dimension === 'string', 'Risk should have dimension');
    assert(typeof r[0].severity === 'string', 'Risk should have severity');
    assert(typeof r[0].id === 'string', 'Risk should have id');
  }
});

// --- submitFacts validation ---
test('submitFacts returns promise', () => {
  const r = mod.submitFacts(os.tmpdir(), 'proj-1', [{ key: 'val' }]);
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

// --- generateDocument validation ---
test('generateDocument returns promise', () => {
  const docType = mod.Q2B_DOCUMENT_TYPES[0];
  const r = mod.generateDocument(os.tmpdir(), 'proj-1', docType);
  assert(r && typeof r.then === 'function');
  r.catch(() => {});
});

console.log(`\n  test-v7-quiz2build-client: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-quiz2build-client: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
