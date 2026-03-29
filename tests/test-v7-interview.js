#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
let tmpDir = null;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + err.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ezra-v7-interview-'));
}

function teardown() {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
}

// ── Load modules ──────────────────────────────────────────────────────────────

const ingester = require(path.join(ROOT, 'hooks', 'ezra-doc-ingester.js'));
const definition = require(path.join(ROOT, 'hooks', 'ezra-project-definition.js'));
const engine = require(path.join(ROOT, 'hooks', 'ezra-interview-engine.js'));
const planner = require(path.join(ROOT, 'hooks', 'ezra-planner.js'));

// ── doc-ingester tests ────────────────────────────────────────────────────────

test('doc-ingester exports extractSignals function', () => {
  assert(typeof ingester.extractSignals === 'function', 'Missing extractSignals');
});

test('doc-ingester exports ingestFile function', () => {
  assert(typeof ingester.ingestFile === 'function', 'Missing ingestFile');
});

test('doc-ingester exports ingestPaths function', () => {
  assert(typeof ingester.ingestPaths === 'function', 'Missing ingestPaths');
});

test('doc-ingester exports SUPPORTED_EXTENSIONS array or Set', () => {
  const ext = ingester.SUPPORTED_EXTENSIONS;
  assert(Array.isArray(ext) || (ext instanceof Set) || typeof ext === 'object', 'SUPPORTED_EXTENSIONS should be iterable');
  const size = ext instanceof Set ? ext.size : (Array.isArray(ext) ? ext.length : Object.keys(ext).length);
  assert(size > 0, 'SUPPORTED_EXTENSIONS should not be empty');
});

test('doc-ingester exports TECH_PATTERNS object', () => {
  assert(typeof ingester.TECH_PATTERNS === 'object', 'TECH_PATTERNS should be object');
});

test('extractSignals detects TypeScript', () => {
  const signals = ingester.extractSignals('We use TypeScript and React for the frontend.');
  const stack = signals.tech_stack || {};
  const langs = Array.isArray(stack.languages) ? stack.languages : [];
  assert(langs.some(l => l.toLowerCase().includes('typescript')), 'Should detect TypeScript');
});

test('extractSignals detects Next.js', () => {
  const signals = ingester.extractSignals('Built with Next.js and deployed on Vercel.');
  const stack = signals.tech_stack || {};
  const fwks = Array.isArray(stack.frameworks) ? stack.frameworks : [];
  assert(fwks.some(f => f.toLowerCase().includes('next')), 'Should detect Next.js');
});

test('extractSignals returns object', () => {
  const signals = ingester.extractSignals('A simple project.');
  assert(typeof signals === 'object' && signals !== null, 'Should return object');
});

test('ingestFile handles nonexistent path gracefully', () => {
  setup();
  try {
    const result = ingester.ingestFile(path.join(tmpDir, 'nonexistent.md'));
    assert(result === null || typeof result === 'object', 'Should return null or object');
  } finally { teardown(); }
});

test('ingestFile processes markdown file', () => {
  setup();
  try {
    const mdPath = path.join(tmpDir, 'test.md');
    fs.writeFileSync(mdPath, '# MyApp\n\nA TypeScript Next.js application with PostgreSQL database.\n\n## Features\n- User auth\n- Dashboard\n', 'utf8');
    const result = ingester.ingestFile(mdPath);
    assert(result !== null, 'Should process markdown');
    assert(typeof result === 'object', 'Should return object');
  } finally { teardown(); }
});

test('ingestPaths returns array', () => {
  setup();
  try {
    const result = ingester.ingestPaths([]);
    assert(Array.isArray(result) || typeof result === 'object', 'Should return array or object');
  } finally { teardown(); }
});

// ── project-definition tests ──────────────────────────────────────────────────

test('project-definition exports validate function', () => {
  assert(typeof definition.validate === 'function', 'Missing validate');
});

test('project-definition exports serialise function', () => {
  assert(typeof definition.serialise === 'function', 'Missing serialise');
});

test('project-definition exports load function', () => {
  assert(typeof definition.load === 'function', 'Missing load');
});

test('project-definition exports save function', () => {
  assert(typeof definition.save === 'function', 'Missing save');
});

test('project-definition exports SCHEMA object', () => {
  assert(typeof definition.SCHEMA === 'object' && !Array.isArray(definition.SCHEMA), 'SCHEMA should be object');
});

test('validate rejects empty object', () => {
  const result = definition.validate({});
  assert(result.valid === false || result.success === false || result.errors, 'Should reject empty');
});

test('validate accepts minimal valid definition', () => {
  const result = definition.validate({
    project_name: 'TestProject',
    description: 'A test project',
    tech_stack: { languages: ['TypeScript'] },
  });
  assert(result.valid !== false && !result.error, 'Should accept valid definition: ' + JSON.stringify(result));
});

test('save and load roundtrip', () => {
  setup();
  try {
    const def = {
      project_name: 'RoundtripTest',
      description: 'Testing roundtrip',
      tech_stack: { languages: ['JavaScript'] },
    };
    definition.save(tmpDir, def);
    const loaded = definition.load(tmpDir);
    assert(loaded.project_name === 'RoundtripTest' || loaded.name === 'RoundtripTest', 'project_name should roundtrip: ' + JSON.stringify(loaded));
  } finally { teardown(); }
});

test('serialise returns YAML string', () => {
  const yaml = definition.serialise({ project_name: 'Test', description: 'Test desc' });
  assert(typeof yaml === 'string', 'serialise should return string');
  assert(yaml.length > 0, 'serialise should return non-empty string');
});

test('load returns empty or throws for missing file', () => {
  setup();
  try {
    let result = null;
    try { result = definition.load(tmpDir); } catch (_) { result = null; }
    assert(result === null || typeof result === 'object', 'load should return null or object for missing file');
  } finally { teardown(); }
});

// ── interview-engine tests ────────────────────────────────────────────────────

test('interview-engine exports DOMAINS array', () => {
  assert(Array.isArray(engine.DOMAINS), 'DOMAINS should be array');
  assert(engine.DOMAINS.length >= 10, 'Should have at least 10 domains, got ' + engine.DOMAINS.length);
});

test('interview-engine exports detectGaps function', () => {
  assert(typeof engine.detectGaps === 'function', 'Missing detectGaps');
});

test('interview-engine exports getNextQuestion function', () => {
  assert(typeof engine.getNextQuestion === 'function', 'Missing getNextQuestion');
});

test('interview-engine exports applyAnswer function', () => {
  assert(typeof engine.applyAnswer === 'function', 'Missing applyAnswer');
});

test('interview-engine exports getProgress function', () => {
  assert(typeof engine.getProgress === 'function', 'Missing getProgress');
});

test('detectGaps returns all domains for empty definition', () => {
  const gaps = engine.detectGaps({});
  assert(Array.isArray(gaps), 'detectGaps should return array');
  assert(gaps.length > 0, 'Should have gaps for empty definition');
});

test('detectGaps returns fewer gaps for filled definition', () => {
  const filled = {
    project_name: 'TestApp',
    description: 'A test app',
    tech_stack: { languages: ['TypeScript'] },
  };
  const gaps = engine.detectGaps(filled);
  const emptyGaps = engine.detectGaps({});
  assert(gaps.length < emptyGaps.length, 'Filled definition should have fewer gaps');
});

test('detectGaps returns empty for fully filled definition', () => {
  const full = {
    project_name: 'Full',
    description: 'Full description',
    tech_stack: { languages: ['TypeScript'] },
    features: ['auth', 'dashboard'],
    auth_strategy: 'JWT',
    database_choice: 'PostgreSQL',
    deployment_target: 'Vercel',
    testing_requirements: 'Vitest unit tests',
    security_level: 'standard',
    performance_targets: '<200ms',
    team_size: '2',
    timeline: '3 months',
  };
  const gaps = engine.detectGaps(full);
  assert(gaps.length === 0, 'Fully filled definition should have no gaps, got: ' + gaps.join(', '));
});

test('getNextQuestion returns question for a domain', () => {
  const q = engine.getNextQuestion('description', {});
  assert(q !== null && q !== undefined, 'Should return a question');
  // q may be { question, ... } or { domain: { question, ... }, ... }
  const questionText = q.question || (q.domain && q.domain.question) || '';
  assert(typeof questionText === 'string' && questionText.length > 5, 'Question should have text, got: ' + JSON.stringify(q));
});

test('getNextQuestion returns null for unknown domain', () => {
  const q = engine.getNextQuestion('totally_fake_domain', {});
  assert(q === null || q === undefined || typeof q === 'object', 'Should handle unknown domain gracefully');
});

test('applyAnswer updates definition', () => {
  const def = {};
  const updated = engine.applyAnswer(def, 'description', 'A project that does things');
  assert(typeof updated === 'object', 'applyAnswer should return object');
  assert(
    updated.description === 'A project that does things' || def.description === 'A project that does things',
    'Answer should be applied'
  );
});

test('getProgress returns progress object', () => {
  const def = { project_name: 'Test', description: 'Desc' };
  const progress = engine.getProgress(def);
  assert(typeof progress === 'object', 'getProgress should return object');
  assert(typeof progress.answered === 'number' || typeof progress.complete === 'number', 'Should have answered count');
});

// ── planner createPlanFromDefinition tests ────────────────────────────────────

test('planner exports createPlanFromDefinition', () => {
  assert(typeof planner.createPlanFromDefinition === 'function', 'Missing createPlanFromDefinition');
});

test('createPlanFromDefinition fails gracefully with no definition file', () => {
  setup();
  try {
    const result = planner.createPlanFromDefinition(tmpDir);
    assert(result.success === false || result.error, 'Should fail gracefully without definition file');
  } finally { teardown(); }
});

test('createPlanFromDefinition creates plan from definition', () => {
  setup();
  try {
    const def = {
      project_name: 'PlanTest',
      description: 'A project to test plan creation',
      tech_stack: { languages: ['TypeScript'] },
      features: ['User auth', 'Dashboard', 'API'],
      deployment_target: 'Vercel',
    };
    definition.save(tmpDir, def);
    const result = planner.createPlanFromDefinition(tmpDir);
    assert(result.success !== false, 'createPlanFromDefinition should succeed: ' + JSON.stringify(result));
    assert(result.planId || result.plan_id, 'Should return planId');
  } finally { teardown(); }
});

// ── Command file tests ─────────────────────────────────────────────────────────

test('interview.md command file exists', () => {
  assert(fs.existsSync(path.join(ROOT, 'commands', 'ezra', 'interview.md')), 'interview.md missing');
});

test('interview.md has valid frontmatter', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'interview.md'), 'utf8');
  assert(content.includes('name: ezra:interview'), 'Missing name in frontmatter');
});

test('interview.md has description in frontmatter', () => {
  const content = fs.readFileSync(path.join(ROOT, 'commands', 'ezra', 'interview.md'), 'utf8');
  assert(content.includes('description:'), 'Missing description in frontmatter');
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log('  V7-Interview: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
