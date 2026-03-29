#!/usr/bin/env node

'use strict';

/**
 * EZRA Test Runner
 * Runs all test suites and reports results.
 */

const { execSync } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'Structure', script: 'test-structure.js' },
  { name: 'Commands', script: 'test-commands.js' },
  { name: 'Hooks', script: 'test-hooks.js' },
  { name: 'CLI', script: 'test-cli.js' },
  { name: 'Templates', script: 'test-templates.js' },
  { name: 'AVI-OS Bridge', script: 'test-avios-bridge.js' },
  { name: 'V6-Oversight', script: 'test-v6-oversight.js' },
  { name: 'V6-PM', script: 'test-v6-pm.js' },
  { name: 'V6-Settings-Writer', script: 'test-v6-settings-writer.js' },
  { name: 'V6-Settings-RoundTrip', script: 'test-v6-settings-roundtrip.js' },
  { name: 'V6-Library', script: 'test-v6-library.js' },
  { name: 'V6-Agents', script: 'test-v6-agents.js' },
  { name: 'V6-Dashboard', script: 'test-v6-dashboard-data.js' },
  { name: 'V6-Workflows', script: 'test-v6-workflows.js' },
  { name: 'V6-Memory', script: 'test-v6-memory.js' },
  { name: 'V6-Planner',  script: 'test-v6-planner.js' },
  { name: 'V6-Integration', script: 'test-v6-integration.js' },
  { name: 'V6-License',  script: 'test-v6-license.js' },
  { name: 'V6-Agents-Real', script: 'test-v6-agents-real.js' },
  { name: 'V6-HTTP', script: 'test-v6-http.js' },
  { name: 'V6-Hook-Logger', script: 'test-v6-hook-logger.js' },
  { name: 'V6-Error-Codes', script: 'test-v6-error-codes.js' },
  { name: 'V6-Cloud-Sync', script: 'test-v6-cloud-sync.js' },
  { name: 'V6-Dash-Hook', script: 'test-v6-dash-hook.js' },
  { name: 'V6-Drift-Hook', script: 'test-v6-drift-hook.js' },
  { name: 'V6-Guard', script: 'test-v6-guard.js' },
  { name: 'V6-Installer', script: 'test-v6-installer.js' },
  { name: 'V6-Memory-Hook', script: 'test-v6-memory-hook.js' },
  { name: 'V6-Progress-Hook', script: 'test-v6-progress-hook.js' },
  { name: 'V6-Tier-Gate', script: 'test-v6-tier-gate.js' },
  { name: 'V6-Version-Hook', script: 'test-v6-version-hook.js' },

  { name: 'V7-Interview', script: 'test-v7-interview.js' },
  { name: 'V7-PlanGenerator', script: 'test-v7-plan-generator.js' },
  { name: 'V7-Scraper', script: 'test-v7-scraper.js' },
  { name: 'V7-Execution', script: 'test-v7-execution.js' },

  { name: 'Lint', script: 'lint-all.js' },
  { name: 'E2E', script: 'test-e2e.js' },
  { name: 'UAT', script: 'test-uat.js' },
];

const testsDir = __dirname;
let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;
const results = [];

console.log('');
console.log('EZRA Test Runner');
console.log('═══════════════════════════════════════════');

for (const suite of SUITES) {
  const scriptPath = path.join(testsDir, suite.script);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf8',
      timeout: 30000,
      env: { ...process.env, EZRA_TEST: '1' },
    });

    // Parse output for pass/fail counts
    const passMatch = output.match(/PASSED:\s*(\d+)/);
    const failMatch = output.match(/FAILED:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;

    totalPassed += passed;
    totalFailed += failed;
    totalTests += passed + failed;

    const icon = failed === 0 ? '✅' : '❌';
    results.push({ name: suite.name, passed, failed, icon });
    console.log(`  ${icon} ${suite.name}: ${passed} passed, ${failed} failed`);
  } catch (err) {
    const output = err.stdout || '';
    const passMatch = output.match(/PASSED:\s*(\d+)/);
    const failMatch = output.match(/FAILED:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 1;

    totalPassed += passed;
    totalFailed += failed;
    totalTests += passed + failed;

    results.push({ name: suite.name, passed, failed, icon: '❌' });
    console.log(`  ❌ ${suite.name}: ${passed} passed, ${failed} failed`);
  }
}

console.log('═══════════════════════════════════════════');
console.log(`  Total: ${totalTests} tests │ ${totalPassed} passed │ ${totalFailed} failed`);
console.log(`  Result: ${totalFailed === 0 ? '✅ ALL GREEN' : '❌ FAILURES DETECTED'}`);
console.log('═══════════════════════════════════════════');
console.log('');

process.exit(totalFailed > 0 ? 1 : 0);
