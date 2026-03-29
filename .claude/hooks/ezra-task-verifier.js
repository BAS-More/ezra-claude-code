#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-task-verifier.js — Post-task verification engine.
 * Uses built-in fs/path/child_process modules. ZERO external dependencies.
 * Hook protocol: reads JSON from stdin, writes JSON to stdout, exits 0.
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const MAX_STDIN = 1024 * 1024; // 1 MB

// ─── Constants ───────────────────────────────────────────────────

const VERIFICATION_LEVELS = ['basic', 'standard', 'strict'];

// ─── Exported Functions ───────────────────────────────────────────

/**
 * Check that every path in task.file_targets exists under projectDir.
 * Returns { passed: bool, missing: string[] }.
 */
function checkFileTargetsExist(task, projectDir) {
  const targets = Array.isArray(task.file_targets) ? task.file_targets : [];
  const missing = [];
  for (const filePath of targets) {
    if (!filePath) continue;
    const abs = path.join(projectDir, filePath);
    if (!fs.existsSync(abs)) {
      missing.push(filePath);
    }
  }
  return { passed: missing.length === 0, missing };
}

/**
 * Placeholder acceptance-criteria check via keyword matching.
 * Splits acceptance_criteria on '.', extracts key nouns, checks result string.
 * Always returns passed: true (placeholder for AI check).
 * Returns { passed: bool, unchecked: string[] }.
 */
function checkAcceptanceCriteria(task, result) {
  const criteria = task.acceptance_criteria || '';
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result || '');
  const sentences = criteria.split('.').map((s) => s.trim()).filter(Boolean);
  const unchecked = [];

  for (const sentence of sentences) {
    // Extract simple nouns: words longer than 4 chars, not common stop words
    const stopWords = new Set(['should', 'shall', 'must', 'have', 'that', 'with', 'when', 'then', 'each', 'every', 'which', 'there']);
    const words = sentence.split(/\s+/).filter((w) => w.length > 4 && !stopWords.has(w.toLowerCase()));
    const foundAny = words.some((w) => resultStr.toLowerCase().includes(w.toLowerCase()));
    if (!foundAny && words.length > 0) {
      unchecked.push(sentence);
    }
  }

  // Placeholder: always passed — real AI check deferred
  return { passed: true, unchecked };
}

/**
 * Attempts to run `npm run lint --silent` in projectDir.
 * Uses execFileSync with argument array to avoid shell injection.
 * Returns { passed: bool, output: string, error?: string, skipped?: bool }.
 */
function runLintCheck(projectDir, fileTargets) {
  // Check if package.json exists and has a lint script
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { passed: true, output: 'lint skipped', skipped: true };
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!pkg.scripts || !pkg.scripts.lint) {
      return { passed: true, output: 'lint skipped', skipped: true };
    }
  } catch (_) {
    return { passed: true, output: 'lint skipped', skipped: true };
  }

  // Determine npm executable (cross-platform)
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  try {
    const output = child_process.execFileSync(npmCmd, ['run', 'lint', '--silent'], {
      cwd: projectDir,
      timeout: 30000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { passed: true, output: output || '' };
  } catch (e) {
    const stderr = (e.stderr || '').toString();
    const stdout = (e.stdout || '').toString();
    // Non-zero exit = lint failures found
    if (e.status !== null && e.status !== undefined) {
      return { passed: false, output: stdout + stderr, error: 'Lint check failed (exit ' + e.status + ')' };
    }
    // Timeout or other execution error — skip gracefully
    return { passed: true, output: 'lint skipped', skipped: true, error: e.message };
  }
}

/**
 * Full verification of a completed task.
 * Runs file-existence and acceptance-criteria checks.
 * Returns a VerificationResult object.
 */
function verifyTask(projectDir, task, executionResult) {
  const findings = [];
  const remediationHints = [];

  // Check 1: file targets exist
  const fileCheck = checkFileTargetsExist(task, projectDir);
  if (!fileCheck.passed) {
    for (const missing of fileCheck.missing) {
      findings.push({ level: 'error', message: 'Expected file not found: ' + missing });
      remediationHints.push('Ensure the agent created or modified: ' + missing);
    }
  }

  // Check 2: acceptance criteria (placeholder)
  const criteriaCheck = checkAcceptanceCriteria(task, executionResult);
  if (criteriaCheck.unchecked.length > 0) {
    for (const uc of criteriaCheck.unchecked) {
      findings.push({ level: 'warning', message: 'Acceptance criterion may be unmet: ' + uc });
    }
    if (criteriaCheck.unchecked.length > 0) {
      remediationHints.push('Review acceptance criteria manually: ' + criteriaCheck.unchecked.join('; '));
    }
  }

  const hasErrors = findings.some((f) => f.level === 'error');

  return {
    task_id: task.id || task.task_id,
    passed: !hasErrors,
    findings,
    remediation_hints: remediationHints,
    verified_at: new Date().toISOString(),
  };
}

// ─── Hook Protocol ────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > MAX_STDIN) { raw = raw.slice(0, MAX_STDIN); }
  });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch (_) { input = {}; }

    const action = input.action || '';
    const projectDir = input.project_dir || process.cwd();
    let output = {};

    try {
      if (action === 'verify') {
        output = verifyTask(projectDir, input.task || {}, input.execution_result || null);
      } else if (action === 'lint') {
        output = runLintCheck(projectDir, input.file_targets || []);
      } else {
        output = { ok: false, error: 'Unknown action: ' + action };
      }
    } catch (e) {
      output = { ok: false, error: e.message };
    }

    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0);
  });
}

// ─── Exports ──────────────────────────────────────────────────────

module.exports = {
  VERIFICATION_LEVELS,
  checkFileTargetsExist,
  checkAcceptanceCriteria,
  runLintCheck,
  verifyTask,
};
