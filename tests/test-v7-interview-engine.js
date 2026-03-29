#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-interview-engine.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- DOMAINS ---
test('DOMAINS is an array', () => { assert(Array.isArray(mod.DOMAINS)); });
test('DOMAINS has 12 entries', () => { assert(mod.DOMAINS.length === 12, `Got ${mod.DOMAINS.length}`); });
test('Each domain has id', () => { assert(mod.DOMAINS.every(d => typeof d.id === 'string')); });
test('Each domain has question', () => { assert(mod.DOMAINS.every(d => typeof d.question === 'string')); });
test('Each domain has type', () => { assert(mod.DOMAINS.every(d => typeof d.type === 'string')); });
test('All domain ids unique', () => {
  const ids = mod.DOMAINS.map(d => d.id);
  assert(ids.length === new Set(ids).size, 'Duplicate domain ids');
});
test('Required domains exist', () => {
  const req = mod.DOMAINS.filter(d => d.required === true);
  assert(req.length > 0, 'Should have some required domains');
});

// --- detectGaps ---
test('detectGaps is a function', () => { assert(typeof mod.detectGaps === 'function'); });
test('detectGaps empty object returns all domains', () => {
  const gaps = mod.detectGaps({});
  assert(Array.isArray(gaps) && gaps.length === mod.DOMAINS.length, `Got ${gaps.length}`);
});
test('detectGaps with filled fields returns fewer', () => {
  const filled = { project_name: 'Test', tech_stack: 'Node.js', description: 'A project' };
  const gaps = mod.detectGaps(filled);
  assert(gaps.length < mod.DOMAINS.length, `Should be fewer gaps: ${gaps.length}`);
});

// --- getNextQuestion ---
test('getNextQuestion is a function', () => { assert(typeof mod.getNextQuestion === 'function'); });
test('getNextQuestion returns question for empty', () => {
  const q = mod.getNextQuestion({});
  assert(q !== null && q.domain, 'Should return a domain');
  assert(typeof q.remaining === 'number');
});
test('getNextQuestion returns null when complete', () => {
  const full = {};
  for (const d of mod.DOMAINS) full[d.id] = 'some value';
  const q = mod.getNextQuestion(full);
  assert(q === null, 'Should return null when all answered');
});

// --- applyAnswer ---
test('applyAnswer is a function', () => { assert(typeof mod.applyAnswer === 'function'); });
test('applyAnswer sets field', () => {
  const def = {};
  const updated = mod.applyAnswer(def, 'project_name', 'MyProject');
  assert(updated.project_name === 'MyProject');
});
test('applyAnswer preserves existing fields', () => {
  const def = { tech_stack: 'Node.js' };
  const updated = mod.applyAnswer(def, 'project_name', 'MyProject');
  assert(updated.tech_stack === 'Node.js');
});

// --- getProgress ---
test('getProgress is a function', () => { assert(typeof mod.getProgress === 'function'); });
test('getProgress empty → 0%', () => {
  const p = mod.getProgress({});
  assert(p.answered === 0);
  assert(p.total === mod.DOMAINS.length);
  assert(p.pct === 0);
});
test('getProgress partial', () => {
  const def = { project_name: 'Test', tech_stack: 'Node.js' };
  const p = mod.getProgress(def);
  assert(p.answered === 2, `Got ${p.answered}`);
  assert(p.pct > 0 && p.pct < 100);
});
test('getProgress full → 100%', () => {
  const full = {};
  for (const d of mod.DOMAINS) full[d.id] = 'val';
  const p = mod.getProgress(full);
  assert(p.pct === 100, `Got ${p.pct}%`);
});

// --- fromQuiz2BuildSession ---
test('fromQuiz2BuildSession is a function', () => { assert(typeof mod.fromQuiz2BuildSession === 'function'); });

// --- runInterviewCLI ---
test('runInterviewCLI is a function', () => { assert(typeof mod.runInterviewCLI === 'function'); });

console.log(`\n  test-v7-interview-engine: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-interview-engine: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
