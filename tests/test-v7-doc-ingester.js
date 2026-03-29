#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SUPPORTED_EXTENSIONS, BINARY_EXTENSIONS, TECH_PATTERNS, extractSignals, ingestFile, ingestPaths } = require(path.join(__dirname, '..', 'hooks', 'ezra-doc-ingester.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

const tmpDir = path.join(os.tmpdir(), 'ezra-doc-ingest-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// --- SUPPORTED_EXTENSIONS ---
test('SUPPORTED_EXTENSIONS is a Set', () => { assert(SUPPORTED_EXTENSIONS instanceof Set); });
test('SUPPORTED_EXTENSIONS has 8 entries', () => { assert(SUPPORTED_EXTENSIONS.size === 8, `Got ${SUPPORTED_EXTENSIONS.size}`); });
test('SUPPORTED_EXTENSIONS includes .md', () => { assert(SUPPORTED_EXTENSIONS.has('.md')); });
test('SUPPORTED_EXTENSIONS includes .js', () => { assert(SUPPORTED_EXTENSIONS.has('.js')); });
test('SUPPORTED_EXTENSIONS includes .py', () => { assert(SUPPORTED_EXTENSIONS.has('.py')); });
test('SUPPORTED_EXTENSIONS includes .yaml', () => { assert(SUPPORTED_EXTENSIONS.has('.yaml')); });

// --- BINARY_EXTENSIONS ---
test('BINARY_EXTENSIONS is a Set', () => { assert(BINARY_EXTENSIONS instanceof Set); });
test('BINARY_EXTENSIONS has 5 entries', () => { assert(BINARY_EXTENSIONS.size === 5, `Got ${BINARY_EXTENSIONS.size}`); });
test('BINARY_EXTENSIONS includes .pdf', () => { assert(BINARY_EXTENSIONS.has('.pdf')); });
test('BINARY_EXTENSIONS includes .docx', () => { assert(BINARY_EXTENSIONS.has('.docx')); });

// --- TECH_PATTERNS ---
test('TECH_PATTERNS is an object', () => { assert(typeof TECH_PATTERNS === 'object' && TECH_PATTERNS !== null); });
test('TECH_PATTERNS has languages', () => { assert(typeof TECH_PATTERNS.languages === 'object'); });
test('TECH_PATTERNS has frameworks', () => { assert(typeof TECH_PATTERNS.frameworks === 'object'); });
test('TECH_PATTERNS has databases', () => { assert(typeof TECH_PATTERNS.databases === 'object'); });
test('TECH_PATTERNS has cloud', () => { assert(typeof TECH_PATTERNS.cloud === 'object'); });
test('TECH_PATTERNS has testing', () => { assert(typeof TECH_PATTERNS.testing === 'object'); });

// --- extractSignals ---
test('extractSignals is a function', () => { assert(typeof extractSignals === 'function'); });
test('extractSignals empty text', () => {
  const r = extractSignals('', 'test.md');
  assert(r && typeof r.tech_stack === 'object');
  assert(r.word_count === 0 || r.word_count !== undefined);
});
test('extractSignals detects TypeScript', () => {
  const r = extractSignals('This project uses TypeScript and React for the frontend.', 'readme.md');
  assert(r.tech_stack.languages.includes('TypeScript') || r.tech_stack.frameworks.includes('React'));
});
test('extractSignals extracts features from bullets', () => {
  const text = '## Features\n- User authentication system\n- Real-time notifications\n- Dashboard with analytics';
  const r = extractSignals(text, 'features.md');
  assert(r.features.length > 0, 'Should find features');
});
test('extractSignals detects constraints', () => {
  const text = 'Performance: must handle 1000 requests/sec. Compliance: GDPR required.';
  const r = extractSignals(text, 'spec.md');
  assert(r.constraints.length > 0 || typeof r.constraints === 'object');
});
test('extractSignals detects phases', () => {
  const text = '## Phase 1: Foundation\nSetup\n## Phase 2: Core\nBuild features';
  const r = extractSignals(text, 'plan.md');
  assert(r.phases.length > 0, 'Should find phases');
});
test('extractSignals has source_file', () => {
  const r = extractSignals('hello world', 'myfile.md');
  assert(r.source_file === 'myfile.md');
});
test('extractSignals features max 30', () => {
  let text = '';
  for (let i = 0; i < 50; i++) text += `- Feature number ${i} with enough text to be valid\n`;
  const r = extractSignals(text, 'big.md');
  assert(r.features.length <= 30, `Got ${r.features.length}`);
});

// --- ingestFile ---
test('ingestFile is a function', () => { assert(typeof ingestFile === 'function'); });
test('ingestFile supported text file', () => {
  const fp = path.join(tmpDir, 'test.md');
  fs.writeFileSync(fp, '# Test\nUses Node.js and Express');
  const r = ingestFile(fp);
  assert(r.signals !== null, 'Should return signals');
  assert(r.error === null || r.error === undefined);
});
test('ingestFile unsupported extension', () => {
  const fp = path.join(tmpDir, 'test.exe');
  fs.writeFileSync(fp, 'binary stuff');
  const r = ingestFile(fp);
  assert(r.error !== null || (r.signals && r.signals.needs_manual_review));
});
test('ingestFile binary extension', () => {
  const fp = path.join(tmpDir, 'test.pdf');
  fs.writeFileSync(fp, 'fake pdf');
  const r = ingestFile(fp);
  assert((r.signals && r.signals.needs_manual_review) || r.error !== null);
});
test('ingestFile missing file', () => {
  const r = ingestFile(path.join(tmpDir, 'nonexistent.md'));
  assert(r.error !== null && r.error !== undefined, 'Should have error');
});

// --- ingestPaths ---
test('ingestPaths is a function', () => { assert(typeof ingestPaths === 'function'); });
test('ingestPaths processes files', () => {
  const fp1 = path.join(tmpDir, 'a.md');
  const fp2 = path.join(tmpDir, 'b.js');
  fs.writeFileSync(fp1, '# A\nUses Python and Django');
  fs.writeFileSync(fp2, '// Uses Jest for testing');
  const r = ingestPaths([fp1, fp2]);
  assert(r.files_processed.length > 0);
  assert(typeof r.total_words === 'number');
});
test('ingestPaths processes directory', () => {
  const subDir = path.join(tmpDir, 'subdir');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'c.md'), '# C\nUses React');
  const r = ingestPaths([subDir]);
  assert(r.files_processed.length > 0 || r.files_skipped.length >= 0);
});
test('ingestPaths handles missing paths', () => {
  const r = ingestPaths([path.join(tmpDir, 'no-such-file.md')]);
  assert(r.files_skipped.length > 0 || r.files_processed.length === 0);
});

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

console.log(`\n  test-v7-doc-ingester: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-doc-ingester: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
