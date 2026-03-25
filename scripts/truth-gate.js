#!/usr/bin/env node
'use strict';

/**
 * TRUTH GATE — Verification system for AI agent claims
 * 
 * Before any agent reports "done", this script verifies every claim
 * against filesystem reality. No claim without proof.
 * 
 * Usage:
 *   node scripts/truth-gate.js verify-file <path>           — Verify file exists and has content
 *   node scripts/truth-gate.js verify-committed <repo> <file> — Verify file is git-tracked
 *   node scripts/truth-gate.js verify-pushed <repo>          — Verify local=remote
 *   node scripts/truth-gate.js verify-deliverables <manifest> — Verify all deliverables in a JSON manifest
 *   node scripts/truth-gate.js full-audit <manifest>          — Run all checks on a manifest
 */

var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

function run(cmd) {
  try {
    var result = execSync(cmd, { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    return { ok: true, output: (result || '').trim() };
  } catch (e) {
    var stdout = (e.stdout || '').trim();
    var stderr = (e.stderr || '').trim();
    return { ok: false, output: stdout, error: stderr || e.message };
  }
}

var PASS = '\u2705 PASS';
var FAIL = '\u274C FAIL';
var results = [];

function assert(label, condition, evidence) {
  var status = condition ? PASS : FAIL;
  var line = status + ' | ' + label + ' | Evidence: ' + evidence;
  console.log(line);
  results.push({ label: label, passed: condition, evidence: evidence });
  return condition;
}

// ═══════════════════════════════════════════
// VERIFY: File exists and has content
// ═══════════════════════════════════════════

function verifyFile(filePath) {
  var absPath = path.resolve(filePath);
  var exists = fs.existsSync(absPath);
  if (!exists) {
    assert('File exists: ' + absPath, false, 'File not found on disk');
    return false;
  }
  var stats = fs.statSync(absPath);
  var sizeOk = stats.size > 0;
  assert('File exists: ' + absPath, true, stats.size + ' bytes');
  assert('File has content: ' + absPath, sizeOk, sizeOk ? stats.size + ' bytes > 0' : 'FILE IS EMPTY (0 bytes)');
  return sizeOk;
}

// ═══════════════════════════════════════════
// VERIFY: File is tracked in git
// ═══════════════════════════════════════════

function verifyCommitted(repoPath, filePath) {
  var absRepo = path.resolve(repoPath);
  var relFile = path.relative(absRepo, path.resolve(repoPath, filePath)).replace(/\\/g, '/');
  
  var r = run('cd /d "' + absRepo + '" && git ls-files "' + relFile + '"');
  var tracked = r.ok && r.output === relFile;
  assert('Git tracked: ' + relFile + ' in ' + path.basename(absRepo), tracked,
    tracked ? 'git ls-files returned "' + r.output + '"' : 'NOT TRACKED — git ls-files returned empty');
  
  // Also check it's not in staged-for-delete
  var r2 = run('cd /d "' + absRepo + '" && git status --short "' + relFile + '"');
  var deleted = r2.ok && r2.output.indexOf('D ') === 0;
  if (deleted) {
    assert('Not staged for deletion: ' + relFile, false, 'File is marked for deletion in git');
    return false;
  }
  
  return tracked;
}

// ═══════════════════════════════════════════
// VERIFY: Local HEAD matches remote HEAD
// ═══════════════════════════════════════════

function verifyPushed(repoPath, remoteBranch) {
  var absRepo = path.resolve(repoPath);
  if (!remoteBranch) {
    // Auto-detect: try origin/main, origin/master, github/main
    var candidates = ['origin/main', 'origin/master', 'github/main'];
    for (var i = 0; i < candidates.length; i++) {
      var test = run('cd /d "' + absRepo + '" && git rev-parse ' + candidates[i] + ' 2>&1');
      if (test.ok && test.output.length === 40) { remoteBranch = candidates[i]; break; }
    }
    if (!remoteBranch) {
      assert('Remote branch found for ' + path.basename(absRepo), false, 'Could not detect remote branch');
      return false;
    }
  }

  var local = run('cd /d "' + absRepo + '" && git rev-parse HEAD');
  var remote = run('cd /d "' + absRepo + '" && git rev-parse ' + remoteBranch);
  
  if (!local.ok || !remote.ok) {
    assert('SHA readable: ' + path.basename(absRepo), false, 'git rev-parse failed');
    return false;
  }

  var match = local.output === remote.output;
  assert('Pushed: ' + path.basename(absRepo) + ' (' + remoteBranch + ')', match,
    match
      ? 'local=' + local.output.slice(0, 7) + ' remote=' + remote.output.slice(0, 7) + ' MATCH'
      : 'local=' + local.output.slice(0, 7) + ' remote=' + remote.output.slice(0, 7) + ' MISMATCH — UNPUSHED COMMITS EXIST');
  
  return match;
}

// ═══════════════════════════════════════════
// VERIFY: No dirty files in repo
// ═══════════════════════════════════════════

function verifyClean(repoPath) {
  var absRepo = path.resolve(repoPath);
  var r = run('cd /d "' + absRepo + '" && git status --short --untracked-files=all');
  var clean = r.ok && r.output === '';
  assert('Git clean: ' + path.basename(absRepo), clean,
    clean ? 'No dirty or untracked files' : 'DIRTY FILES: ' + r.output.split('\n').length + ' file(s)');
  return clean;
}

// ═══════════════════════════════════════════
// VERIFY: Deliverables manifest
// ═══════════════════════════════════════════

function verifyDeliverables(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    console.log(FAIL + ' | Manifest not found: ' + manifestPath);
    return false;
  }

  var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('\n\u2550\u2550\u2550 DELIVERABLES VERIFICATION \u2550\u2550\u2550\n');
  console.log('Manifest: ' + manifestPath);
  console.log('Deliverables: ' + manifest.deliverables.length);
  console.log('');

  var allPassed = true;

  for (var i = 0; i < manifest.deliverables.length; i++) {
    var d = manifest.deliverables[i];
    console.log('\n--- Deliverable ' + (i + 1) + ': ' + d.description + ' ---');

    // Check file exists and has content
    var fileOk = verifyFile(path.join(d.repo_path, d.file_path));
    if (!fileOk) allPassed = false;

    // Check it's tracked in git
    var trackedOk = verifyCommitted(d.repo_path, d.file_path);
    if (!trackedOk) allPassed = false;

    // Check repo is pushed
    var pushedOk = verifyPushed(d.repo_path);
    if (!pushedOk) allPassed = false;
  }

  return allPassed;
}

// ═══════════════════════════════════════════
// FULL AUDIT: Everything at once
// ═══════════════════════════════════════════

function fullAudit(manifestPath) {
  console.log('\n' + Array(60).join('\u2550'));
  console.log('  TRUTH GATE — Full Audit');
  console.log(Array(60).join('\u2550') + '\n');

  var deliverablesOk = verifyDeliverables(manifestPath);

  // Also verify all repos mentioned in manifest are clean
  var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  var repos = {};
  for (var i = 0; i < manifest.deliverables.length; i++) {
    repos[manifest.deliverables[i].repo_path] = true;
  }
  
  console.log('\n--- Repo cleanliness ---');
  var repoKeys = Object.keys(repos);
  var reposOk = true;
  for (var j = 0; j < repoKeys.length; j++) {
    if (!verifyClean(repoKeys[j])) reposOk = false;
  }

  // Summary
  console.log('\n' + Array(60).join('\u2550'));
  var totalPassed = results.filter(function(r) { return r.passed; }).length;
  var totalFailed = results.filter(function(r) { return !r.passed; }).length;
  console.log('  Results: ' + totalPassed + ' passed, ' + totalFailed + ' failed');
  
  if (totalFailed === 0) {
    console.log('  \u2705 TRUTH GATE: ALL CLAIMS VERIFIED');
  } else {
    console.log('  \u274C TRUTH GATE: ' + totalFailed + ' CLAIM(S) FAILED VERIFICATION');
    console.log('  DO NOT REPORT SUCCESS. Fix failures first.');
  }
  console.log(Array(60).join('\u2550'));

  // Exit with code 1 if anything failed — this blocks CI pipelines
  if (totalFailed > 0) process.exit(1);
}

// ═══════════════════════════════════════════
// CLI ROUTER
// ═══════════════════════════════════════════

var command = process.argv[2];
var arg1 = process.argv[3];
var arg2 = process.argv[4];

if (command === 'verify-file') verifyFile(arg1);
else if (command === 'verify-committed') verifyCommitted(arg1, arg2);
else if (command === 'verify-pushed') verifyPushed(arg1, arg2);
else if (command === 'verify-deliverables') verifyDeliverables(arg1);
else if (command === 'full-audit') fullAudit(arg1);
else {
  console.log('TRUTH GATE — Verification system');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/truth-gate.js verify-file <path>');
  console.log('  node scripts/truth-gate.js verify-committed <repo-path> <relative-file>');
  console.log('  node scripts/truth-gate.js verify-pushed <repo-path> [remote/branch]');
  console.log('  node scripts/truth-gate.js verify-deliverables <manifest.json>');
  console.log('  node scripts/truth-gate.js full-audit <manifest.json>');
  console.log('');
  console.log('Manifest format (JSON):');
  console.log('{');
  console.log('  "deliverables": [');
  console.log('    {');
  console.log('      "description": "What this deliverable is",');
  console.log('      "repo_path": "C:\\\\Dev\\\\my-repo",');
  console.log('      "file_path": "docs/my-file.md"');
  console.log('    }');
  console.log('  ]');
  console.log('}');
}
