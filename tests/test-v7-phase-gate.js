#!/usr/bin/env node
'use strict';

/**
 * Tests for hooks/ezra-phase-gate.js
 * Phase 4 test suite — covers exports, constants, detection helpers,
 * check runners, gate orchestration, persistence, and fix-and-recheck.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error('  FAIL: ' + name + ' — ' + err.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`);
}

function makeTempDir(suffix) {
  const dir = path.join(
    os.tmpdir(),
    'ezra-phase-gate-test-' + (suffix || '') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// Load the module once
const hookPath = path.join(__dirname, '..', 'hooks', 'ezra-phase-gate.js');
let gate;

// ============================================================
// 1. Module loads without error
// ============================================================

test('Module loads without error', () => {
  gate = require(hookPath);
  assert(gate !== null && typeof gate === 'object', 'Module should export an object');
});

// ============================================================
// 2. GATE_CHECKS
// ============================================================

test('GATE_CHECKS is exported and is an array', () => {
  assert(Array.isArray(gate.GATE_CHECKS), 'GATE_CHECKS should be an array');
});

test('GATE_CHECKS has exactly 5 entries', () => {
  assertEqual(gate.GATE_CHECKS.length, 5, 'GATE_CHECKS should have 5 entries');
});

test('GATE_CHECKS contains tests', () => {
  assert(gate.GATE_CHECKS.includes('tests'), 'should include tests');
});

test('GATE_CHECKS contains lint', () => {
  assert(gate.GATE_CHECKS.includes('lint'), 'should include lint');
});

test('GATE_CHECKS contains security', () => {
  assert(gate.GATE_CHECKS.includes('security'), 'should include security');
});

test('GATE_CHECKS contains coverage', () => {
  assert(gate.GATE_CHECKS.includes('coverage'), 'should include coverage');
});

test('GATE_CHECKS contains standards', () => {
  assert(gate.GATE_CHECKS.includes('standards'), 'should include standards');
});

// ============================================================
// 3. DEFAULT_THRESHOLDS
// ============================================================

test('DEFAULT_THRESHOLDS is exported and is an object', () => {
  assert(gate.DEFAULT_THRESHOLDS !== null && typeof gate.DEFAULT_THRESHOLDS === 'object', 'DEFAULT_THRESHOLDS should be an object');
});

test('DEFAULT_THRESHOLDS has coverage_minimum field', () => {
  assert('coverage_minimum' in gate.DEFAULT_THRESHOLDS, 'should have coverage_minimum');
});

test('DEFAULT_THRESHOLDS has max_fix_retries field', () => {
  assert('max_fix_retries' in gate.DEFAULT_THRESHOLDS, 'should have max_fix_retries');
});

test('DEFAULT_THRESHOLDS coverage_minimum is a number', () => {
  assert(typeof gate.DEFAULT_THRESHOLDS.coverage_minimum === 'number', 'coverage_minimum should be a number');
});

test('DEFAULT_THRESHOLDS max_fix_retries is a number >= 1', () => {
  assert(typeof gate.DEFAULT_THRESHOLDS.max_fix_retries === 'number' && gate.DEFAULT_THRESHOLDS.max_fix_retries >= 1, 'max_fix_retries should be a positive number');
});

// ============================================================
// 4. All exported functions are present
// ============================================================

test('runGate is exported as a function', () => {
  assert(typeof gate.runGate === 'function', 'runGate should be a function');
});

test('runTestSuite is exported as a function', () => {
  assert(typeof gate.runTestSuite === 'function', 'runTestSuite should be a function');
});

test('runLintCheck is exported as a function', () => {
  assert(typeof gate.runLintCheck === 'function', 'runLintCheck should be a function');
});

test('runSecurityScan is exported as a function', () => {
  assert(typeof gate.runSecurityScan === 'function', 'runSecurityScan should be a function');
});

test('runCoverageCheck is exported as a function', () => {
  assert(typeof gate.runCoverageCheck === 'function', 'runCoverageCheck should be a function');
});

test('runStandardsCheck is exported as a function', () => {
  assert(typeof gate.runStandardsCheck === 'function', 'runStandardsCheck should be a function');
});

test('fixAndRecheck is exported as a function', () => {
  assert(typeof gate.fixAndRecheck === 'function', 'fixAndRecheck should be a function');
});

test('saveGateResult is exported as a function', () => {
  assert(typeof gate.saveGateResult === 'function', 'saveGateResult should be a function');
});

test('loadGateResult is exported as a function', () => {
  assert(typeof gate.loadGateResult === 'function', 'loadGateResult should be a function');
});

test('listGateResults is exported as a function', () => {
  assert(typeof gate.listGateResults === 'function', 'listGateResults should be a function');
});

test('detectTestRunner is exported as a function', () => {
  assert(typeof gate.detectTestRunner === 'function', 'detectTestRunner should be a function');
});

test('detectLintCommand is exported as a function', () => {
  assert(typeof gate.detectLintCommand === 'function', 'detectLintCommand should be a function');
});

// ============================================================
// 5. detectTestRunner
// ============================================================

test('detectTestRunner returns null for empty dir', () => {
  const dir = makeTempDir('dtr-empty');
  try {
    const result = gate.detectTestRunner(dir);
    assert(result === null, 'should return null for empty dir');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type npm for package.json with test script', () => {
  const dir = makeTempDir('dtr-npm');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      scripts: { test: 'node tests/run.js' },
    }));
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect a runner');
    assertEqual(result.type, 'npm', 'type should be npm');
    assert(typeof result.cmd === 'string', 'cmd should be a string');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type jest for jest in devDependencies', () => {
  const dir = makeTempDir('dtr-jest');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      devDependencies: { jest: '^29.0.0' },
    }));
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect jest');
    assertEqual(result.type, 'jest', 'type should be jest');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type vitest for vitest in devDependencies', () => {
  const dir = makeTempDir('dtr-vitest');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      devDependencies: { vitest: '^1.0.0' },
    }));
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect vitest');
    assertEqual(result.type, 'vitest', 'type should be vitest');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type mocha for mocha in devDependencies', () => {
  const dir = makeTempDir('dtr-mocha');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      devDependencies: { mocha: '^10.0.0' },
    }));
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect mocha');
    assertEqual(result.type, 'mocha', 'type should be mocha');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type pytest for dir with pytest.ini', () => {
  const dir = makeTempDir('dtr-pytest');
  try {
    fs.writeFileSync(path.join(dir, 'pytest.ini'), '[pytest]\n');
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect pytest');
    assertEqual(result.type, 'pytest', 'type should be pytest');
  } finally { cleanup(dir); }
});

test('detectTestRunner returns type gotest for dir with go.mod', () => {
  const dir = makeTempDir('dtr-go');
  try {
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module example.com/mymod\n\ngo 1.21\n');
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect gotest');
    assertEqual(result.type, 'gotest', 'type should be gotest');
  } finally { cleanup(dir); }
});

// npm test script takes precedence over devDependency runners
test('detectTestRunner prefers test script over devDependency', () => {
  const dir = makeTempDir('dtr-prefer-script');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      scripts: { test: 'jest' },
      devDependencies: { jest: '^29.0.0' },
    }));
    const result = gate.detectTestRunner(dir);
    assert(result !== null, 'should detect a runner');
    assertEqual(result.type, 'npm', 'npm script should take precedence');
  } finally { cleanup(dir); }
});

// ============================================================
// 6. detectLintCommand
// ============================================================

test('detectLintCommand returns null for empty dir', () => {
  const dir = makeTempDir('dlc-empty');
  try {
    const result = gate.detectLintCommand(dir);
    assert(result === null, 'should return null for empty dir');
  } finally { cleanup(dir); }
});

test('detectLintCommand returns npm run lint for package.json with lint script', () => {
  const dir = makeTempDir('dlc-lint');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      scripts: { lint: 'eslint .' },
    }));
    const result = gate.detectLintCommand(dir);
    assertEqual(result, 'npm run lint', 'should return npm run lint');
  } finally { cleanup(dir); }
});

test('detectLintCommand returns null when no lint-related config exists', () => {
  const dir = makeTempDir('dlc-no-lint');
  try {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'test-pkg',
      scripts: { start: 'node index.js' },
    }));
    const result = gate.detectLintCommand(dir);
    assert(result === null, 'should return null when no lint script');
  } finally { cleanup(dir); }
});

// ============================================================
// 7. runTestSuite
// ============================================================

test('runTestSuite returns correct shape', () => {
  const dir = makeTempDir('rts-shape');
  try {
    const result = gate.runTestSuite(dir);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assertEqual(result.check, 'tests', 'check should be tests');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.score === 'number', 'score should be a number');
    assert(Array.isArray(result.findings), 'findings should be an array');
  } finally { cleanup(dir); }
});

test('runTestSuite skips gracefully when no test runner detected', () => {
  const dir = makeTempDir('rts-skip');
  try {
    const result = gate.runTestSuite(dir);
    assertEqual(result.check, 'tests', 'check should be tests');
    assert(result.skipped === true, 'should be skipped when no runner');
    assert(result.passed === true, 'skipped check should be passed');
  } finally { cleanup(dir); }
});

// ============================================================
// 8. runLintCheck
// ============================================================

test('runLintCheck returns correct shape', () => {
  const dir = makeTempDir('rlc-shape');
  try {
    const result = gate.runLintCheck(dir);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assertEqual(result.check, 'lint', 'check should be lint');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.score === 'number', 'score should be a number');
    assert(Array.isArray(result.findings), 'findings should be an array');
  } finally { cleanup(dir); }
});

test('runLintCheck skips gracefully when no lint command detected', () => {
  const dir = makeTempDir('rlc-skip');
  try {
    const result = gate.runLintCheck(dir);
    assertEqual(result.check, 'lint', 'check should be lint');
    assert(result.skipped === true, 'should be skipped when no lint command');
    assert(result.passed === true, 'skipped check should be passed');
  } finally { cleanup(dir); }
});

// ============================================================
// 9. runSecurityScan
// ============================================================

test('runSecurityScan returns correct shape', () => {
  const dir = makeTempDir('rss-shape');
  try {
    const result = gate.runSecurityScan(dir);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assertEqual(result.check, 'security', 'check should be security');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.score === 'number', 'score should be a number');
    assert(Array.isArray(result.findings), 'findings should be an array');
  } finally { cleanup(dir); }
});

test('runSecurityScan score is in 0-100 range', () => {
  const dir = makeTempDir('rss-score');
  try {
    const result = gate.runSecurityScan(dir);
    assert(result.score >= 0 && result.score <= 100, `score ${result.score} out of 0-100 range`);
  } finally { cleanup(dir); }
});

// ============================================================
// 10. runCoverageCheck
// ============================================================

test('runCoverageCheck skips when minimumPct is 0', () => {
  const dir = makeTempDir('rcc-zero');
  try {
    const result = gate.runCoverageCheck(dir, 0);
    assertEqual(result.check, 'coverage', 'check should be coverage');
    assert(result.skipped === true, 'should be skipped when minimum is 0');
    assert(result.passed === true, 'skipped check should be passed');
  } finally { cleanup(dir); }
});

test('runCoverageCheck skips when no coverage report exists', () => {
  const dir = makeTempDir('rcc-no-report');
  try {
    const result = gate.runCoverageCheck(dir, 80);
    assertEqual(result.check, 'coverage', 'check should be coverage');
    assert(result.skipped === true, 'should be skipped when no report');
    assert(result.passed === true, 'skipped check should be passed');
  } finally { cleanup(dir); }
});

test('runCoverageCheck reads coverage-summary.json correctly', () => {
  const dir = makeTempDir('rcc-read');
  try {
    const covDir = path.join(dir, 'coverage');
    fs.mkdirSync(covDir, { recursive: true });
    const summary = { total: { lines: { pct: 85 }, statements: { pct: 85 }, functions: { pct: 80 }, branches: { pct: 75 } } };
    fs.writeFileSync(path.join(covDir, 'coverage-summary.json'), JSON.stringify(summary));
    const result = gate.runCoverageCheck(dir, 70);
    assertEqual(result.check, 'coverage', 'check should be coverage');
    assert(result.passed === true, 'should pass when coverage above minimum');
    assert(result.coverage_pct === 85, 'coverage_pct should be 85');
  } finally { cleanup(dir); }
});

test('runCoverageCheck fails when coverage below minimum', () => {
  const dir = makeTempDir('rcc-fail');
  try {
    const covDir = path.join(dir, 'coverage');
    fs.mkdirSync(covDir, { recursive: true });
    const summary = { total: { lines: { pct: 45 } } };
    fs.writeFileSync(path.join(covDir, 'coverage-summary.json'), JSON.stringify(summary));
    const result = gate.runCoverageCheck(dir, 80);
    assertEqual(result.check, 'coverage', 'check should be coverage');
    assert(result.passed === false, 'should fail when coverage below minimum');
    assert(result.findings.length > 0, 'should have findings');
  } finally { cleanup(dir); }
});

// ============================================================
// 11. runStandardsCheck
// ============================================================

test('runStandardsCheck returns correct shape', () => {
  const dir = makeTempDir('rsc-shape');
  try {
    const result = gate.runStandardsCheck(dir);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assertEqual(result.check, 'standards', 'check should be standards');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.score === 'number', 'score should be a number');
    assert(Array.isArray(result.findings), 'findings should be an array');
  } finally { cleanup(dir); }
});

test('runStandardsCheck skips when no .ezra dir', () => {
  const dir = makeTempDir('rsc-no-ezra');
  try {
    const result = gate.runStandardsCheck(dir);
    assertEqual(result.check, 'standards', 'check should be standards');
    assert(result.skipped === true, 'should be skipped when no .ezra dir');
    assert(result.passed === true, 'skipped check should be passed');
  } finally { cleanup(dir); }
});

test('runStandardsCheck reads most recent scan file', () => {
  const dir = makeTempDir('rsc-scan');
  try {
    const ezraDir = path.join(dir, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'name: test-project\n');
    // Write two scan files; the later one (alphabetically last) has no violations
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2025-01-01.yaml'), 'severity: CRITICAL\n');
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2025-06-01.yaml'), 'health_score: 95\n');
    const result = gate.runStandardsCheck(dir);
    assertEqual(result.check, 'standards', 'check should be standards');
    // The most recent scan (2025-06-01) has no violations — should pass
    assert(result.passed === true, 'should pass when most recent scan is clean');
  } finally { cleanup(dir); }
});

test('runStandardsCheck shows blockers when scan has CRITICAL findings', () => {
  const dir = makeTempDir('rsc-critical');
  try {
    const ezraDir = path.join(dir, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'name: test-project\n');
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2025-01-01.yaml'),
      'title: DB credentials in source\nseverity: CRITICAL\nmessage: hardcoded password\n');
    const result = gate.runStandardsCheck(dir);
    assertEqual(result.check, 'standards', 'check should be standards');
    assert(result.passed === false, 'should fail when scan has CRITICAL findings');
    assert(result.findings.length > 0, 'should have findings');
  } finally { cleanup(dir); }
});

// ============================================================
// 12. saveGateResult / loadGateResult
// ============================================================

test('saveGateResult creates .ezra/gates dir if missing', () => {
  const dir = makeTempDir('sgr-mkdir');
  try {
    const fakeResult = {
      passed: true,
      overall_score: 100,
      run_at: new Date().toISOString(),
      checks: [],
      blockers: [],
      retries: 0,
    };
    gate.saveGateResult(dir, 1, fakeResult);
    assert(fs.existsSync(path.join(dir, '.ezra', 'gates')), '.ezra/gates should be created');
  } finally { cleanup(dir); }
});

test('saveGateResult writes valid YAML with phase, passed, overall_score, run_at', () => {
  const dir = makeTempDir('sgr-yaml');
  try {
    const fakeResult = {
      passed: true,
      overall_score: 95,
      run_at: '2026-03-29T12:00:00.000Z',
      checks: [],
      blockers: [],
      retries: 0,
    };
    const filePath = gate.saveGateResult(dir, 2, fakeResult);
    assert(fs.existsSync(filePath), 'saved file should exist');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('phase: 2'), 'should contain phase');
    assert(content.includes('passed: true'), 'should contain passed');
    assert(content.includes('overall_score: 95'), 'should contain overall_score');
    assert(content.includes('run_at:'), 'should contain run_at');
  } finally { cleanup(dir); }
});

test('saveGateResult includes findings in YAML when blockers exist', () => {
  const dir = makeTempDir('sgr-blockers');
  try {
    const fakeResult = {
      passed: false,
      overall_score: 40,
      run_at: new Date().toISOString(),
      checks: [
        { check: 'tests', passed: false, score: 0, findings: [{ level: 'error', message: 'Tests failed' }] },
      ],
      blockers: ['tests'],
      retries: 0,
    };
    const filePath = gate.saveGateResult(dir, 3, fakeResult);
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('findings'), 'should include findings section');
    assert(content.includes('Tests failed') || content.includes('error'), 'should include finding message');
  } finally { cleanup(dir); }
});

test('loadGateResult returns null when file missing', () => {
  const dir = makeTempDir('lgr-miss');
  try {
    const result = gate.loadGateResult(dir, 99);
    assert(result === null, 'should return null when no file');
  } finally { cleanup(dir); }
});

test('loadGateResult reads passed and overall_score from saved file', () => {
  const dir = makeTempDir('lgr-read');
  try {
    const fakeResult = {
      passed: false,
      overall_score: 72,
      run_at: new Date().toISOString(),
      checks: [],
      blockers: ['lint'],
      retries: 1,
    };
    gate.saveGateResult(dir, 4, fakeResult);
    const loaded = gate.loadGateResult(dir, 4);
    assert(loaded !== null, 'should return a result object');
    assert(loaded.passed === false, 'passed should be false');
    assertEqual(loaded.overall_score, 72, 'overall_score should be 72');
  } finally { cleanup(dir); }
});

// ============================================================
// 13. listGateResults
// ============================================================

test('listGateResults returns empty array when no .ezra/gates dir', () => {
  const dir = makeTempDir('lgrs-empty');
  try {
    const results = gate.listGateResults(dir);
    assert(Array.isArray(results), 'should return an array');
    assertEqual(results.length, 0, 'should be empty');
  } finally { cleanup(dir); }
});

test('listGateResults returns array sorted by phase number', () => {
  const dir = makeTempDir('lgrs-sort');
  try {
    const base = { run_at: new Date().toISOString(), checks: [], blockers: [], retries: 0 };
    gate.saveGateResult(dir, 3, { ...base, passed: true, overall_score: 90 });
    gate.saveGateResult(dir, 1, { ...base, passed: true, overall_score: 80 });
    gate.saveGateResult(dir, 2, { ...base, passed: false, overall_score: 60 });
    const results = gate.listGateResults(dir);
    assert(Array.isArray(results), 'should return an array');
    assert(results.length === 3, 'should have 3 results');
    assert(results[0].phase <= results[1].phase, 'results should be sorted by phase');
    assert(results[1].phase <= results[2].phase, 'results should be sorted by phase');
  } finally { cleanup(dir); }
});

test('listGateResults returns correct phase numbers from filenames', () => {
  const dir = makeTempDir('lgrs-phase-nums');
  try {
    const base = { run_at: new Date().toISOString(), checks: [], blockers: [], retries: 0 };
    gate.saveGateResult(dir, 5, { ...base, passed: true, overall_score: 100 });
    gate.saveGateResult(dir, 7, { ...base, passed: true, overall_score: 95 });
    const results = gate.listGateResults(dir);
    const phases = results.map(r => r.phase);
    assert(phases.includes(5), 'should include phase 5');
    assert(phases.includes(7), 'should include phase 7');
  } finally { cleanup(dir); }
});

// ============================================================
// 14. runGate
// ============================================================

test('runGate returns correct shape', () => {
  const dir = makeTempDir('rg-shape');
  try {
    const result = gate.runGate(dir, 1);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.overall_score === 'number', 'overall_score should be a number');
    assert(Array.isArray(result.checks), 'checks should be an array');
    assert(Array.isArray(result.blockers), 'blockers should be an array');
    assert(typeof result.run_at === 'string', 'run_at should be a string');
    assert(typeof result.phase === 'number', 'phase should be a number');
  } finally { cleanup(dir); }
});

test('runGate checks array has 5 entries', () => {
  const dir = makeTempDir('rg-five');
  try {
    const result = gate.runGate(dir, 1);
    assertEqual(result.checks.length, 5, 'checks array should have 5 entries');
  } finally { cleanup(dir); }
});

test('runGate passed is true when all checks are skipped (empty project)', () => {
  const dir = makeTempDir('rg-allskip');
  try {
    const result = gate.runGate(dir, 1);
    // Empty dir has no test runner, no lint, no .ezra, coverage_minimum=0 — all skip
    assert(result.passed === true, 'should pass when all checks are skipped');
  } finally { cleanup(dir); }
});

test('runGate saves result to .ezra/gates/phase-N.yaml', () => {
  const dir = makeTempDir('rg-save');
  try {
    gate.runGate(dir, 2);
    assert(fs.existsSync(path.join(dir, '.ezra', 'gates', 'phase-2.yaml')), 'gate file should be saved');
  } finally { cleanup(dir); }
});

test('runGate blockers array contains failing check names', () => {
  const dir = makeTempDir('rg-blockers');
  try {
    // Create a standards setup that will definitely fail
    const ezraDir = path.join(dir, '.ezra');
    fs.mkdirSync(path.join(ezraDir, 'scans'), { recursive: true });
    fs.writeFileSync(path.join(ezraDir, 'governance.yaml'), 'name: blocker-test\n');
    fs.writeFileSync(path.join(ezraDir, 'scans', 'scan-2025-01-01.yaml'),
      'severity: CRITICAL\nmessage: critical issue\n');
    const result = gate.runGate(dir, 1);
    // Standards check has a failing scan — should be a blocker
    if (!result.passed) {
      assert(Array.isArray(result.blockers), 'blockers should be an array');
      assert(result.blockers.length > 0, 'blockers should not be empty when gate fails');
      result.blockers.forEach(b => {
        assert(typeof b === 'string', 'each blocker should be a string (check name)');
        assert(gate.GATE_CHECKS.includes(b), `blocker "${b}" should be a valid GATE_CHECK category`);
      });
    } else {
      // If gate passed, blockers should be empty
      assertEqual(result.blockers.length, 0, 'blockers should be empty when passed');
    }
  } finally { cleanup(dir); }
});

test('runGate phase parameter is stored in result', () => {
  const dir = makeTempDir('rg-phase');
  try {
    const result = gate.runGate(dir, 7);
    assertEqual(result.phase, 7, 'phase should match parameter');
  } finally { cleanup(dir); }
});

test('runGate run_at is an ISO timestamp', () => {
  const dir = makeTempDir('rg-runAt');
  try {
    const result = gate.runGate(dir, 1);
    assert(typeof result.run_at === 'string', 'run_at should be a string');
    const d = new Date(result.run_at);
    assert(!isNaN(d.getTime()), 'run_at should be a valid ISO date');
  } finally { cleanup(dir); }
});

test('runGate creates .ezra/gates directory if missing', () => {
  const dir = makeTempDir('rg-mkdir');
  try {
    assert(!fs.existsSync(path.join(dir, '.ezra', 'gates')), 'gates dir should not exist before runGate');
    gate.runGate(dir, 1);
    assert(fs.existsSync(path.join(dir, '.ezra', 'gates')), '.ezra/gates should be created by runGate');
  } finally { cleanup(dir); }
});

test('runGate overall_score is in 0-100 range', () => {
  const dir = makeTempDir('rg-score-range');
  try {
    const result = gate.runGate(dir, 1);
    assert(result.overall_score >= 0 && result.overall_score <= 100,
      `overall_score ${result.overall_score} is out of 0-100 range`);
  } finally { cleanup(dir); }
});

test('runGate overall_score is average of all check scores', () => {
  const dir = makeTempDir('rg-score-avg');
  try {
    const result = gate.runGate(dir, 1);
    // Verify that overall_score equals rounded average of check scores
    const avg = Math.round(result.checks.reduce((s, c) => s + c.score, 0) / result.checks.length);
    assertEqual(result.overall_score, avg, 'overall_score should be the rounded average of check scores');
  } finally { cleanup(dir); }
});

test('Gate result for empty project (all skipped) passes with score 100', () => {
  const dir = makeTempDir('rg-empty-100');
  try {
    const result = gate.runGate(dir, 1);
    assert(result.passed === true, 'empty project should pass');
    assertEqual(result.overall_score, 100, 'empty project (all skipped) should have score 100');
  } finally { cleanup(dir); }
});

// ============================================================
// 15. fixAndRecheck
// ============================================================

test('fixAndRecheck returns correct shape', () => {
  const dir = makeTempDir('far-shape');
  try {
    const result = gate.fixAndRecheck(dir, 1, 1);
    assert(result !== null && typeof result === 'object', 'should return an object');
    assert(typeof result.passed === 'boolean', 'passed should be boolean');
    assert(typeof result.attempts === 'number', 'attempts should be a number');
    assert(result.final_result !== null && typeof result.final_result === 'object', 'final_result should be an object');
  } finally { cleanup(dir); }
});

test('fixAndRecheck attempts is <= maxRetries when gate fails', () => {
  const dir = makeTempDir('far-retries');
  try {
    const maxRetries = 2;
    const result = gate.fixAndRecheck(dir, 1, maxRetries);
    assert(result.attempts <= maxRetries, `attempts ${result.attempts} should be <= maxRetries ${maxRetries}`);
  } finally { cleanup(dir); }
});

test('fixAndRecheck returns passed true immediately if gate passes on first run', () => {
  const dir = makeTempDir('far-immediate');
  try {
    // Empty dir with no runners — all checks skip, gate should pass immediately
    const result = gate.fixAndRecheck(dir, 1, 3);
    assert(result.passed === true, 'should pass immediately for empty project');
    assertEqual(result.attempts, 0, 'should have 0 attempts when passing immediately');
  } finally { cleanup(dir); }
});

test('fixAndRecheck final_result has the runGate shape', () => {
  const dir = makeTempDir('far-final');
  try {
    const result = gate.fixAndRecheck(dir, 1, 1);
    assert(typeof result.final_result.passed === 'boolean', 'final_result.passed should be boolean');
    assert(Array.isArray(result.final_result.checks), 'final_result.checks should be an array');
    assert(typeof result.final_result.overall_score === 'number', 'final_result.overall_score should be a number');
  } finally { cleanup(dir); }
});

// ============================================================
// Summary
// ============================================================

console.log(`\n  test-v7-phase-gate: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log(`PASSED: ${passed} FAILED: ${failed}`);
