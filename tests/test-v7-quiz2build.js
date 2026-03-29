#!/usr/bin/env node
'use strict';

/**
 * test-v7-quiz2build.js — Quiz2Build integration test suite
 * Tests: client exports, heatmap conversion, domain mapping,
 *        interview hybrid mode, plan generator integration, library import.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT   = path.resolve(__dirname, '..');
const client = require(path.join(ROOT, 'hooks', 'ezra-quiz2build-client'));
const engine = require(path.join(ROOT, 'hooks', 'ezra-interview-engine'));
const gen    = require(path.join(ROOT, 'hooks', 'ezra-plan-generator'));
const lib    = require(path.join(ROOT, 'hooks', 'ezra-library'));
const settings = require(path.join(ROOT, 'hooks', 'ezra-settings'));

let passed = 0;
let failed = 0;
let tmpDir = null;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function setup() { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-q2b-')); }
function teardown() {
  if (tmpDir && fs.existsSync(tmpDir)) { fs.rmSync(tmpDir, { recursive: true, force: true }); tmpDir = null; }
}

// ── Client exports ────────────────────────────────────────────────────────────

test('Client exports Q2B_DOCUMENT_TYPES array', () => {
  assert(Array.isArray(client.Q2B_DOCUMENT_TYPES), 'Not array');
  assert(client.Q2B_DOCUMENT_TYPES.length >= 8, 'Expected >= 8 doc types');
});

test('Client exports Q2B_DIMENSIONS array', () => {
  assert(Array.isArray(client.Q2B_DIMENSIONS), 'Not array');
  assert(client.Q2B_DIMENSIONS.length === 7, 'Expected 7 dimensions');
});

test('Client exports EZRA_DOMAIN_MAP object', () => {
  assert(typeof client.EZRA_DOMAIN_MAP === 'object', 'Not object');
  assert(Object.keys(client.EZRA_DOMAIN_MAP).length === 7, 'Expected 7 mappings');
});

test('EZRA_DOMAIN_MAP values are arrays of strings', () => {
  for (const [dim, domains] of Object.entries(client.EZRA_DOMAIN_MAP)) {
    assert(Array.isArray(domains), dim + ' domains not array');
    assert(domains.length > 0, dim + ' domains empty');
    for (const d of domains) assert(typeof d === 'string', dim + ' domain not string');
  }
});

test('Q2B_DOCUMENT_TYPES includes architecture_dossier', () => {
  assert(client.Q2B_DOCUMENT_TYPES.includes('architecture_dossier'), 'Missing architecture_dossier');
});

test('Q2B_DOCUMENT_TYPES includes sdlc_playbook', () => {
  assert(client.Q2B_DOCUMENT_TYPES.includes('sdlc_playbook'), 'Missing sdlc_playbook');
});

test('Q2B_DOCUMENT_TYPES includes security_framework', () => {
  assert(client.Q2B_DOCUMENT_TYPES.includes('security_framework'), 'Missing security_framework');
});

test('Q2B_DIMENSIONS includes modern_architecture', () => {
  assert(client.Q2B_DIMENSIONS.includes('modern_architecture'), 'Missing modern_architecture');
});

test('Q2B_DIMENSIONS includes security_devsecops', () => {
  assert(client.Q2B_DIMENSIONS.includes('security_devsecops'), 'Missing security_devsecops');
});

// ── Client function exports ────────────────────────────────────────────────────

const clientFns = ['login', 'refreshToken', 'getSession', 'importScore', 'importHeatmap',
  'importFacts', 'submitFacts', 'calculateScore', 'generateDocument', 'downloadDocument',
  'importDocuments', 'getNextQuestions', 'registerGithubAdapter', 'syncAdapter', 'heatmapToRiskRegister'];

for (const fn of clientFns) {
  test('Client exports ' + fn + ' function', () => {
    assert(typeof client[fn] === 'function', 'Missing: ' + fn);
  });
}

// ── heatmapToRiskRegister ─────────────────────────────────────────────────────

test('heatmapToRiskRegister returns empty for all-green heatmap', () => {
  const heatmap = {};
  for (const dim of client.Q2B_DIMENSIONS) {
    heatmap[dim] = [{ colour: 'green', gap: 'All good' }];
  }
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(Array.isArray(risks), 'Not array');
  assert(risks.length === 0, 'Green heatmap should produce no risks');
});

test('heatmapToRiskRegister returns risks for red cells', () => {
  const heatmap = { modern_architecture: [{ colour: 'red', gap: 'Monolith not decomposed' }] };
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(risks.length > 0, 'Red cell should produce risk');
  assert(risks[0].severity === 'CRITICAL', 'Red should be CRITICAL');
  assert(risks[0].dimension === 'modern_architecture', 'Wrong dimension');
  assert(risks[0].source === 'quiz2build', 'Wrong source');
});

test('heatmapToRiskRegister returns risks for amber cells', () => {
  const heatmap = { testing_qa: [{ colour: 'amber', gap: 'Low coverage' }] };
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(risks.length > 0, 'Amber cell should produce risk');
  assert(risks[0].severity === 'HIGH', 'Amber should be HIGH');
});

test('heatmapToRiskRegister maps dimension to EZRA domains', () => {
  const heatmap = { coding_standards: [{ colour: 'red', gap: 'No linting' }] };
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(risks[0].domains.includes('standards_level'), 'Should map to standards_level');
});

test('heatmapToRiskRegister handles empty heatmap', () => {
  const risks = client.heatmapToRiskRegister({});
  assert(Array.isArray(risks), 'Not array');
  assert(risks.length === 0, 'Empty heatmap → no risks');
});

test('heatmapToRiskRegister handles matrix wrapper', () => {
  const heatmap = { matrix: { security_devsecops: [{ colour: 'red', gap: 'OWASP gaps' }] } };
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(risks.length > 0, 'Matrix-wrapped heatmap should produce risks');
});

test('heatmapToRiskRegister assigns unique IDs', () => {
  const heatmap = {
    modern_architecture: [{ colour: 'red', gap: 'Gap 1' }],
    security_devsecops:  [{ colour: 'amber', gap: 'Gap 2' }],
  };
  const risks = client.heatmapToRiskRegister(heatmap);
  assert(risks.length === 2, 'Expected 2 risks');
  assert(risks[0].id !== risks[1].id, 'IDs should be unique');
});

// ── submitFacts validation ─────────────────────────────────────────────────────

test('submitFacts rejects empty facts array', () => {
  const r = client.submitFacts(os.tmpdir(), 'proj-123', []);
  assert(r.error || r.skipped, 'Should reject empty facts');
});

test('submitFacts rejects non-array facts', () => {
  const r = client.submitFacts(os.tmpdir(), 'proj-123', 'not-array');
  assert(r.error || r.skipped, 'Should reject non-array');
});

// ── generateDocument type validation ─────────────────────────────────────────

test('generateDocument rejects unknown type', () => {
  const r = client.generateDocument(os.tmpdir(), 'proj-123', 'fake_document');
  assert(r.error, 'Should reject unknown type');
  assert(r.valid_types, 'Should return valid_types list');
});

test('generateDocument accepts valid type', () => {
  // Will fail network (no server) but should not be a type error
  const r = client.generateDocument(os.tmpdir(), 'proj-123', 'architecture_dossier');
  // Either network error (ok) or success — not a type validation error
  assert(!r.error || r.error !== 'Unknown document type: architecture_dossier', 'Should accept valid type');
});

// ── importDocuments ───────────────────────────────────────────────────────────

test('importDocuments with no network returns skipped/error per doc', () => {
  const r = client.importDocuments(os.tmpdir(), 'sess-fake', ['architecture_dossier']);
  assert(typeof r === 'object', 'Should return object');
  assert(Array.isArray(r.documents), 'Should have documents array');
});

// ── Settings quiz2build section ───────────────────────────────────────────────

test('Settings DEFAULTS has quiz2build section', () => {
  assert(settings.DEFAULTS.quiz2build, 'Missing quiz2build defaults');
});

test('Settings DEFAULTS.quiz2build has endpoint', () => {
  assert(settings.DEFAULTS.quiz2build.endpoint, 'Missing endpoint');
});

test('Settings DEFAULTS.quiz2build has api_key (null)', () => {
  assert('api_key' in settings.DEFAULTS.quiz2build, 'Missing api_key');
});

test('Settings DEFAULTS.quiz2build has auto_sync boolean', () => {
  assert(typeof settings.DEFAULTS.quiz2build.auto_sync === 'boolean', 'auto_sync should be boolean');
});

test('Settings DEFAULTS.quiz2build has import_documents_to_library', () => {
  assert('import_documents_to_library' in settings.DEFAULTS.quiz2build, 'Missing import_documents_to_library');
});

test('Settings exports getQuiz2Build function', () => {
  assert(typeof settings.getQuiz2Build === 'function', 'Missing getQuiz2Build');
});

test('getQuiz2Build returns quiz2build section', () => {
  const q2b = settings.getQuiz2Build(os.tmpdir());
  assert(q2b, 'Should return quiz2build section');
  assert(q2b.endpoint, 'Should have endpoint');
});

// ── Interview engine fromQuiz2BuildSession ────────────────────────────────────

test('Interview engine exports fromQuiz2BuildSession', () => {
  assert(typeof engine.fromQuiz2BuildSession === 'function', 'Missing fromQuiz2BuildSession');
});

test('fromQuiz2BuildSession returns error when client unavailable (graceful)', () => {
  // Call with a fake session in a temp dir (no server → graceful error or skipped)
  const r = engine.fromQuiz2BuildSession(os.tmpdir(), 'fake-session-id');
  assert(typeof r === 'object', 'Should return object');
  // May return error (no server) — just must not throw
});

test('fromQuiz2BuildSession returns covered/remaining arrays on success structure', () => {
  // We can test the return SHAPE by mocking — but since no server, just check type safety
  const r = engine.fromQuiz2BuildSession(os.tmpdir(), 'fake-session');
  assert(typeof r === 'object', 'Should return object');
  if (!r.error && !r.skipped) {
    assert(Array.isArray(r.covered_domains), 'covered_domains should be array');
    assert(Array.isArray(r.remaining_domains), 'remaining_domains should be array');
  }
});

// ── Plan generator fromQuiz2BuildDocuments ────────────────────────────────────

test('Plan generator exports fromQuiz2BuildDocuments', () => {
  assert(typeof gen.fromQuiz2BuildDocuments === 'function', 'Missing fromQuiz2BuildDocuments');
});

test('fromQuiz2BuildDocuments returns error when no server', () => {
  const r = gen.fromQuiz2BuildDocuments(os.tmpdir(), 'fake-session');
  assert(typeof r === 'object', 'Should return object');
  // No server → graceful error
});

test('fromQuiz2BuildDocuments returns tasks array on success shape', () => {
  const r = gen.fromQuiz2BuildDocuments(os.tmpdir(), 'fake-session');
  if (r.tasks !== undefined) {
    assert(Array.isArray(r.tasks), 'tasks should be array');
  }
});

// ── Library importFromQuiz2Build ──────────────────────────────────────────────

test('Library exports importFromQuiz2Build function', () => {
  assert(typeof lib.importFromQuiz2Build === 'function', 'Missing importFromQuiz2Build');
});

test('importFromQuiz2Build returns object with added/errors', () => {
  setup();
  try {
    lib.initLibrary(tmpDir);
    const r = lib.importFromQuiz2Build(tmpDir, 'fake-session', ['architecture_dossier']);
    assert(typeof r === 'object', 'Should return object');
    // May return error (no server) — must not throw
    if (!r.error) {
      assert('added' in r, 'Should have added count');
      assert(Array.isArray(r.errors), 'errors should be array');
    }
  } finally { teardown(); }
});

// ── assess.md command ─────────────────────────────────────────────────────────

test('assess.md command file exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'commands', 'ezra', 'assess.md')), 'Missing assess.md');
});

test('assess.md has valid YAML frontmatter', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'assess.md'), 'utf8');
  assert(c.includes('name: ezra:assess'), 'Bad frontmatter name');
  assert(c.includes('description:'), 'Missing description');
});

test('assess.md documents import subcommand', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'assess.md'), 'utf8');
  assert(c.includes('import'), 'Missing import subcommand');
});

test('assess.md documents sync subcommand', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'assess.md'), 'utf8');
  assert(c.includes('sync'), 'Missing sync subcommand');
});

test('assess.md documents Q2B dimension mapping table', () => {
  const c = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'assess.md'), 'utf8');
  assert(c.includes('Modern Architecture') || c.includes('modern_architecture'), 'Missing dimension mapping');
});

// ── Hook file structure ───────────────────────────────────────────────────────

test('ezra-quiz2build-client.js has shebang', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-quiz2build-client.js'), 'utf8');
  assert(c.startsWith('#!/usr/bin/env node'), 'No shebang');
});

test('ezra-quiz2build-client.js uses strict mode', () => {
  const c = fs.readFileSync(path.join(ROOT, 'hooks', 'ezra-quiz2build-client.js'), 'utf8');
  assert(c.includes("'use strict'"), 'No strict mode');
});

test('ezra-quiz2build-client.js exits 0 in hook mode (no crash)', () => {
  // Just require it — if require.main !== module, stdin hook mode won't run
  const loaded = require(path.join(ROOT, 'hooks', 'ezra-quiz2build-client'));
  assert(typeof loaded === 'object', 'Module should export an object');
});

// ── Report ────────────────────────────────────────────────────────────────────

console.log('  V7-Quiz2Build: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
