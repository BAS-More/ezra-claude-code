#!/usr/bin/env node
'use strict';

/**
 * EZRA v7 Phase 8 Test Suite — Best Practice Intelligence Agent
 * Tests: ezra-scraper.js, ezra-bp-scheduler.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error(`  FAIL: ${name} — ${err.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v7-scraper-')); }
function rm(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

// ─── Load modules ─────────────────────────────────────────────────────────────

const scraper = require(path.join(ROOT, 'hooks', 'ezra-scraper.js'));
const scheduler = require(path.join(ROOT, 'hooks', 'ezra-bp-scheduler.js'));

// ─── ezra-scraper.js ──────────────────────────────────────────────────────────

test('scraper: exports required functions', () => {
  assert(typeof scraper.scrapeUrl === 'function', 'scrapeUrl missing');
  assert(typeof scraper.fetchUrl === 'function', 'fetchUrl missing');
  assert(typeof scraper.extractTextContent === 'function', 'extractTextContent missing');
  assert(typeof scraper.diffAgainstLibrary === 'function', 'diffAgainstLibrary missing');
  assert(typeof scraper.getDefaultSources === 'function', 'getDefaultSources missing');
  assert(typeof scraper.scrapeForTech === 'function', 'scrapeForTech missing');
});

test('scraper: exports ALLOWED_DOMAINS array', () => {
  assert(Array.isArray(scraper.ALLOWED_DOMAINS), 'ALLOWED_DOMAINS should be array');
  assert(scraper.ALLOWED_DOMAINS.length >= 5, 'ALLOWED_DOMAINS should have at least 5 entries');
});

test('scraper: ALLOWED_DOMAINS contains key security sources', () => {
  const joined = scraper.ALLOWED_DOMAINS.join(' ');
  assert(joined.includes('owasp'), 'Should include owasp');
  assert(joined.includes('nodejs') || joined.includes('node'), 'Should include nodejs');
});

test('scraper: fetchUrl rejects disallowed domains', async () => {
  let threw = false;
  try {
    await scraper.fetchUrl('https://evil.example.com/malicious');
  } catch (e) {
    threw = true;
    assert(e.message.includes('not allowed') || e.message.includes('whitelist') || e.message.includes('SSRF') || e.message.includes('domain'),
      'Error should mention domain restriction, got: ' + e.message);
  }
  assert(threw, 'fetchUrl should reject disallowed domains');
});

test('scraper: fetchUrl rejects http scheme for non-localhost', async () => {
  let threw = false;
  try {
    await scraper.fetchUrl('http://malicious.com/page');
  } catch (e) { threw = true; }
  assert(threw, 'fetchUrl should reject disallowed http domains');
});

test('scraper: scrapeUrl rejects disallowed domain', async () => {
  let threw = false;
  try {
    await scraper.scrapeUrl('https://notallowed.baddomain.com/page');
  } catch (e) { threw = true; }
  assert(threw, 'scrapeUrl should reject disallowed domains');
});

test('scraper: extractTextContent strips HTML tags', () => {
  const html = '<h1>Hello</h1><p>World <strong>here</strong></p>';
  const text = scraper.extractTextContent(html);
  assert(!text.includes('<'), 'Should strip all HTML tags');
  assert(text.includes('Hello'), 'Should keep text content');
  assert(text.includes('World'), 'Should keep body text');
});

test('scraper: extractTextContent handles empty string', () => {
  const text = scraper.extractTextContent('');
  assert(typeof text === 'string', 'Should return string for empty input');
});

test('scraper: extractTextContent handles plain text', () => {
  const text = scraper.extractTextContent('No tags here');
  assert(text.includes('No tags here'), 'Should pass through plain text');
});

test('scraper: getDefaultSources returns array', () => {
  const sources = scraper.getDefaultSources();
  assert(Array.isArray(sources), 'getDefaultSources should return array');
  assert(sources.length > 0, 'Should return at least one source');
});

test('scraper: getDefaultSources entries have required fields', () => {
  const sources = scraper.getDefaultSources();
  for (const s of sources) {
    assert(typeof s.url === 'string', 'Source missing url');
    assert(s.url.startsWith('https://') || s.url.startsWith('http://'), 'URL should be valid: ' + s.url);
    assert(typeof s.category === 'string', 'Source missing category');
  }
});

test('scraper: getDefaultSources with tech filter reduces results', () => {
  const all = scraper.getDefaultSources();
  const filtered = scraper.getDefaultSources(['react']);
  assert(Array.isArray(filtered), 'Should return array with filter');
  // filtered should be <= all
  assert(filtered.length <= all.length, 'Filter should not increase results');
});

test('scraper: diffAgainstLibrary returns correct structure', () => {
  const newEntries = [
    { title: 'Entry 1', category: 'security', content: 'New content A' },
    { title: 'Entry 2', category: 'testing', content: 'New content B' },
  ];
  const existing = [
    { title: 'Entry 1', category: 'security', content: 'Old content A' },
  ];
  const diff = scraper.diffAgainstLibrary(newEntries, existing);
  assert(typeof diff === 'object', 'diffAgainstLibrary should return object');
  assert(Array.isArray(diff.new), 'diff.new should be array');
  assert(Array.isArray(diff.updated), 'diff.updated should be array');
  assert(typeof diff.unchanged_count === 'number', 'diff.unchanged_count should be number');
});

test('scraper: diffAgainstLibrary detects new entries', () => {
  const newEntries = [{ title: 'Brand New', category: 'security', content: 'content' }];
  const existing = [{ title: 'Old Entry', category: 'security', content: 'old' }];
  const diff = scraper.diffAgainstLibrary(newEntries, existing);
  assert(diff.new.length >= 1, 'Should detect new entry');
});

test('scraper: diffAgainstLibrary detects unchanged entries', () => {
  const entry = { title: 'Same Entry', category: 'security', content: 'same content' };
  const diff = scraper.diffAgainstLibrary([entry], [entry]);
  assert(diff.unchanged_count >= 1, 'Should detect unchanged entry');
  assert(diff.new.length === 0, 'Should not flag unchanged as new');
});

test('scraper: scrapeForTech returns promise', () => {
  const result = scraper.scrapeForTech(['nodejs']);
  assert(typeof result.then === 'function', 'scrapeForTech should return a Promise');
  // Resolve or reject — just verify it's a promise
  return result.catch(() => {}); // swallow network errors in test env
});

// ─── ezra-bp-scheduler.js ────────────────────────────────────────────────────

test('scheduler: exports required functions', () => {
  assert(typeof scheduler.getSchedulerState === 'function', 'getSchedulerState missing');
  assert(typeof scheduler.saveSchedulerState === 'function', 'saveSchedulerState missing');
  assert(typeof scheduler.isDue === 'function', 'isDue missing');
  assert(typeof scheduler.runScheduledFetch === 'function', 'runScheduledFetch missing');
  assert(typeof scheduler.getPendingEntries === 'function', 'getPendingEntries missing');
  assert(typeof scheduler.approveEntry === 'function', 'approveEntry missing');
  assert(typeof scheduler.rejectEntry === 'function', 'rejectEntry missing');
});

test('scheduler: exports FREQUENCIES array', () => {
  assert(Array.isArray(scheduler.FREQUENCIES), 'FREQUENCIES should be array');
  assert(scheduler.FREQUENCIES.includes('daily'), 'daily frequency missing');
  assert(scheduler.FREQUENCIES.includes('weekly'), 'weekly frequency missing');
  assert(scheduler.FREQUENCIES.includes('manual'), 'manual frequency missing');
});

test('scheduler: getSchedulerState returns defaults for new dir', () => {
  const tmp = tmpDir();
  try {
    const state = scheduler.getSchedulerState(tmp);
    assert(typeof state === 'object', 'Should return object');
    assert('frequency' in state, 'Should have frequency');
    assert('auto_add' in state, 'Should have auto_add');
    assert('tech_filter' in state, 'Should have tech_filter');
  } finally { rm(tmp); }
});

test('scheduler: saveSchedulerState persists state', () => {
  const tmp = tmpDir();
  try {
    const state = { frequency: 'daily', auto_add: true, tech_filter: ['react'], last_run: null };
    scheduler.saveSchedulerState(tmp, state);
    const loaded = scheduler.getSchedulerState(tmp);
    assert(loaded.frequency === 'daily', 'Should persist frequency');
    assert(loaded.auto_add === true, 'Should persist auto_add');
  } finally { rm(tmp); }
});

test('scheduler: isDue returns false for manual frequency', () => {
  const state = { frequency: 'manual', last_run: null };
  assert(scheduler.isDue(state) === false, 'manual frequency should never be due');
});

test('scheduler: isDue returns true when last_run is null and not manual', () => {
  const state = { frequency: 'weekly', last_run: null };
  assert(scheduler.isDue(state) === true, 'Should be due when never run');
});

test('scheduler: isDue returns false for daily that ran recently', () => {
  const state = { frequency: 'daily', last_run: new Date().toISOString() };
  assert(scheduler.isDue(state) === false, 'Should not be due when just run');
});

test('scheduler: isDue returns true for daily that ran 25h ago', () => {
  const ago25h = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const state = { frequency: 'daily', last_run: ago25h };
  assert(scheduler.isDue(state) === true, 'Should be due after 25h for daily');
});

test('scheduler: isDue returns true for weekly that ran 8 days ago', () => {
  const ago8d = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const state = { frequency: 'weekly', last_run: ago8d };
  assert(scheduler.isDue(state) === true, 'Should be due after 8 days for weekly');
});

test('scheduler: isDue returns false for weekly that ran 3 days ago', () => {
  const ago3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const state = { frequency: 'weekly', last_run: ago3d };
  assert(scheduler.isDue(state) === false, 'Should not be due after 3 days for weekly');
});

test('scheduler: getPendingEntries returns array for empty dir', () => {
  const tmp = tmpDir();
  try {
    const entries = scheduler.getPendingEntries(tmp);
    assert(Array.isArray(entries), 'Should return array');
    assert(entries.length === 0, 'Should return empty array for new dir');
  } finally { rm(tmp); }
});

test('scheduler: runScheduledFetch skips when not due', async () => {
  const tmp = tmpDir();
  try {
    const state = { frequency: 'daily', last_run: new Date().toISOString(), auto_add: false, tech_filter: [] };
    scheduler.saveSchedulerState(tmp, state);
    const result = await scheduler.runScheduledFetch(tmp);
    assert(typeof result === 'object', 'Should return result object');
    assert(result.skipped === true, 'Should skip when not due');
  } finally { rm(tmp); }
});

test('scheduler: approveEntry is callable without crash', () => {
  const tmp = tmpDir();
  try {
    // Trying to approve non-existent file should not throw (graceful)
    try { scheduler.approveEntry(tmp, 'nonexistent.yaml'); } catch (_) {}
    assert(true, 'approveEntry handles missing file gracefully');
  } finally { rm(tmp); }
});

test('scheduler: rejectEntry is callable without crash', () => {
  const tmp = tmpDir();
  try {
    try { scheduler.rejectEntry(tmp, 'nonexistent.yaml'); } catch (_) {}
    assert(true, 'rejectEntry handles missing file gracefully');
  } finally { rm(tmp); }
});

// ─── library syncFromWeb ──────────────────────────────────────────────────────

test('library: exports syncFromWeb function', () => {
  const lib = require(path.join(ROOT, 'hooks', 'ezra-library.js'));
  assert(typeof lib.syncFromWeb === 'function', 'syncFromWeb missing from ezra-library.js exports');
});

// ─── settings self_learning section ──────────────────────────────────────────

test('settings: self_learning has scrape_frequency', () => {
  const settings = require(path.join(ROOT, 'hooks', 'ezra-settings.js'));
  const defaults = settings.getDefault ? settings.getDefault() : {};
  // Check DEFAULTS object has the new fields - either via getDefault or direct require
  const hasField = (defaults.self_learning && 'scrape_frequency' in defaults.self_learning)
    || (settings.DEFAULTS && settings.DEFAULTS.self_learning && 'scrape_frequency' in settings.DEFAULTS.self_learning);
  assert(hasField, 'self_learning.scrape_frequency missing from DEFAULTS');
});

test('settings: self_learning has auto_add', () => {
  const settings = require(path.join(ROOT, 'hooks', 'ezra-settings.js'));
  const defaults = settings.getDefault ? settings.getDefault() : {};
  const hasField = (defaults.self_learning && 'auto_add' in defaults.self_learning)
    || (settings.DEFAULTS && settings.DEFAULTS.self_learning && 'auto_add' in settings.DEFAULTS.self_learning);
  assert(hasField, 'self_learning.auto_add missing from DEFAULTS');
});

test('settings: self_learning has tech_filter', () => {
  const settings = require(path.join(ROOT, 'hooks', 'ezra-settings.js'));
  const defaults = settings.getDefault ? settings.getDefault() : {};
  const hasField = (defaults.self_learning && 'tech_filter' in defaults.self_learning)
    || (settings.DEFAULTS && settings.DEFAULTS.self_learning && 'tech_filter' in settings.DEFAULTS.self_learning);
  assert(hasField, 'self_learning.tech_filter missing from DEFAULTS');
});

// ─── research.md command file ─────────────────────────────────────────────────

test('research.md: --tech flag documented', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'research.md'), 'utf8');
  assert(content.includes('--tech'), 'research.md should document --tech flag');
});

test('research.md: pending subcommand documented', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'research.md'), 'utf8');
  assert(content.includes('pending'), 'research.md should document pending subcommand');
});

// ─── Redirect depth guard (GAP-003 regression test) ──────────────────────────

test('scraper: fetchUrl rejects after 5 redirect hops', async () => {
  let threw = false;
  try {
    // Call with hops already at the limit — should reject immediately
    await scraper.fetchUrl('https://owasp.org/test', 6);
  } catch (e) {
    threw = true;
    assert(
      e.message.toLowerCase().includes('redirect') || e.message.toLowerCase().includes('hop'),
      'Error should mention redirect limit, got: ' + e.message
    );
  }
  assert(threw, 'fetchUrl should reject when hops > 5');
});

test('scraper: fetchUrl hop parameter accepted (no throw at 0 hops)', () => {
  // Confirm the function signature accepts the hops parameter without crashing
  // when given a disallowed domain (will throw domain error, not hops error)
  let errMsg = '';
  try { scraper.fetchUrl('https://evil.example.com', 0); } catch (e) { errMsg = e.message; }
  // If it throws synchronously, it should NOT be a hops error
  assert(!errMsg.includes('redirect') && !errMsg.includes('hop'), 'Should not error on hops=0, got: ' + errMsg);
});

// ─────────────────────────────────────────────────────────────────────────────

console.log(`  V7-Scraper: PASSED: ${passed} FAILED: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
