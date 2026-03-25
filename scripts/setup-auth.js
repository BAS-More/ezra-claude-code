#!/usr/bin/env node
'use strict';

/**
 * EZRA Auth Setup — Interactive credential walkthrough
 * Sets up authentication for platforms that don't have MCP servers:
 *   1. npm (for core + mcp-server publishing)
 *   2. vsce (for VS Code Marketplace publishing)
 *   3. JetBrains (for JetBrains Marketplace publishing)
 *
 * Zero dependencies — uses only Node.js built-ins.
 *
 * Usage:
 *   node scripts/setup-auth.js           # interactive setup for all platforms
 *   node scripts/setup-auth.js status    # check current auth status only
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Paths ────────────────────────────────────────────────────────────────────
const JETBRAINS_ROOT = path.join('C:', 'Dev', 'ezra-jetbrains');
const GRADLE_PROPS   = path.join(JETBRAINS_ROOT, 'gradle.properties');

// ── Helpers ──────────────────────────────────────────────────────────────────
function run(cmd, opts) {
  var timeout = (opts && opts.timeout) || 30000;
  try {
    var result = execSync(cmd, { encoding: 'utf-8', timeout: timeout, stdio: 'pipe' });
    return { ok: true, output: (result || '').trim() };
  } catch (e) {
    var msg = (e.stderr || e.message || '').trim();
    return { ok: false, output: msg };
  }
}

function ask(rl, question) {
  return new Promise(function (resolve) {
    rl.question(question, function (answer) {
      resolve((answer || '').trim());
    });
  });
}

function heading(title) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

function ok(msg) { console.log('  \x1b[32m✓\x1b[0m ' + msg); }
function warn(msg) { console.log('  \x1b[33m⚠\x1b[0m ' + msg); }
function fail(msg) { console.log('  \x1b[31m✗\x1b[0m ' + msg); }
function info(msg) { console.log('  \x1b[36mℹ\x1b[0m ' + msg); }

// ── Platform Checks ─────────────────────────────────────────────────────────

function checkNpm() {
  heading('1/3  npm Registry');
  var result = run('npm whoami');
  if (result.ok && result.output && !result.output.includes('ERR')) {
    ok('Logged in as: ' + result.output);
    return { platform: 'npm', status: 'authenticated', user: result.output };
  }
  fail('Not authenticated');
  info('Run: npm login');
  info('Then re-run this script to verify.');
  return { platform: 'npm', status: 'not-authenticated' };
}

function checkVsce() {
  heading('2/3  VS Code Marketplace (vsce)');

  // Check if vsce is available
  var versionResult = run('npx --yes @vscode/vsce --version');
  if (!versionResult.ok) {
    fail('vsce not available');
    info('Run: npm install -g @vscode/vsce');
    info('Then get a PAT from: https://dev.azure.com → User Settings → Personal Access Tokens');
    info('Scope: Marketplace (Manage), Organization: All accessible organizations');
    info('Then run: vsce login BAS-More');
    return { platform: 'vsce', status: 'not-installed' };
  }
  ok('vsce version: ' + versionResult.output);

  // Check if PAT is configured by trying to verify
  var patResult = run('npx --yes @vscode/vsce verify-pat BAS-More', { timeout: 15000 });
  if (patResult.ok && !patResult.output.includes('Error') && !patResult.output.includes('error')) {
    ok('PAT verified for publisher: BAS-More');
    return { platform: 'vsce', status: 'authenticated' };
  }
  fail('PAT not configured or invalid for BAS-More');
  info('Get a PAT from: https://dev.azure.com → User Settings → Personal Access Tokens');
  info('  Scope: Marketplace (Manage)');
  info('  Organization: All accessible organizations');
  info('Then run: vsce login BAS-More');
  return { platform: 'vsce', status: 'not-authenticated' };
}

function checkJetBrains() {
  heading('3/3  JetBrains Marketplace');

  if (!fs.existsSync(GRADLE_PROPS)) {
    fail('gradle.properties not found at: ' + GRADLE_PROPS);
    info('Expected at: ' + GRADLE_PROPS);
    return { platform: 'jetbrains', status: 'missing-config' };
  }

  var content = fs.readFileSync(GRADLE_PROPS, 'utf-8');
  if (content.includes('intellijPublishToken=') && !content.includes('intellijPublishToken=\n') && !content.includes('intellijPublishToken=\r')) {
    // Token exists and is non-empty
    var lines = content.split('\n');
    var tokenLine = lines.find(function (l) { return l.trim().startsWith('intellijPublishToken='); });
    if (tokenLine) {
      var tokenValue = tokenLine.split('=')[1];
      if (tokenValue && tokenValue.trim().length > 0) {
        ok('intellijPublishToken is set in gradle.properties');
        return { platform: 'jetbrains', status: 'authenticated' };
      }
    }
  }

  fail('intellijPublishToken not found in gradle.properties');
  info('Get a token from: https://plugins.jetbrains.com/author/me/tokens');
  info('Then add to ' + GRADLE_PROPS + ':');
  info('  intellijPublishToken=<your-token>');
  return { platform: 'jetbrains', status: 'not-authenticated' };
}

// ── Interactive Setup ────────────────────────────────────────────────────────

async function interactiveSetup(rl, results) {
  var needsSetup = results.filter(function (r) { return r.status !== 'authenticated'; });
  if (needsSetup.length === 0) {
    heading('All Platforms Authenticated');
    ok('Ready to deploy!');
    return results;
  }

  console.log('\n' + needsSetup.length + ' platform(s) need authentication.');
  var proceed = await ask(rl, '\nWould you like to set them up now? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    info('Skipped. Run this script again when ready.');
    return results;
  }

  // npm interactive
  if (results[0].status !== 'authenticated') {
    heading('Setting up npm');
    info('Opening npm login in your terminal...');
    info('Please complete the login in your browser or terminal.');
    try {
      execSync('npm login', { stdio: 'inherit', timeout: 120000 });
      var verify = run('npm whoami');
      if (verify.ok) {
        ok('npm authenticated as: ' + verify.output);
        results[0] = { platform: 'npm', status: 'authenticated', user: verify.output };
      }
    } catch (e) {
      fail('npm login failed or was cancelled');
    }
  }

  // vsce interactive
  if (results[1].status !== 'authenticated') {
    heading('Setting up vsce');
    if (results[1].status === 'not-installed') {
      info('Installing @vscode/vsce globally...');
      var installResult = run('npm install -g @vscode/vsce', { timeout: 60000 });
      if (!installResult.ok) {
        fail('Failed to install vsce: ' + installResult.output);
      } else {
        ok('vsce installed');
      }
    }
    info('You need a Personal Access Token from Azure DevOps.');
    info('URL: https://dev.azure.com → User Settings → Personal Access Tokens');
    info('Scope: Marketplace (Manage), Org: All accessible organizations');
    var pat = await ask(rl, '\nPaste your PAT here (or press Enter to skip): ');
    if (pat) {
      try {
        execSync('echo ' + pat + ' | npx --yes @vscode/vsce login BAS-More', {
          stdio: 'inherit', timeout: 30000
        });
        ok('vsce login completed');
        results[1] = { platform: 'vsce', status: 'authenticated' };
      } catch (e) {
        fail('vsce login failed');
      }
    } else {
      info('Skipped vsce setup');
    }
  }

  // JetBrains interactive
  if (results[2].status !== 'authenticated') {
    heading('Setting up JetBrains');
    info('You need a publish token from: https://plugins.jetbrains.com/author/me/tokens');
    var token = await ask(rl, '\nPaste your JetBrains token here (or press Enter to skip): ');
    if (token) {
      try {
        var content = '';
        if (fs.existsSync(GRADLE_PROPS)) {
          content = fs.readFileSync(GRADLE_PROPS, 'utf-8');
        }
        if (content.includes('intellijPublishToken=')) {
          // Replace existing line
          content = content.replace(/intellijPublishToken=.*/g, 'intellijPublishToken=' + token);
        } else {
          // Append
          if (content.length > 0 && !content.endsWith('\n')) {
            content += '\n';
          }
          content += 'intellijPublishToken=' + token + '\n';
        }
        fs.writeFileSync(GRADLE_PROPS, content, 'utf-8');
        ok('Token written to gradle.properties');

        // Verify .gitignore includes gradle.properties
        var gitignorePath = path.join(JETBRAINS_ROOT, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          var gitignore = fs.readFileSync(gitignorePath, 'utf-8');
          if (!gitignore.includes('gradle.properties')) {
            warn('gradle.properties is NOT in .gitignore — token may be committed!');
            info('Add "gradle.properties" to ' + gitignorePath);
          } else {
            ok('gradle.properties is in .gitignore (token is safe)');
          }
        }
        results[2] = { platform: 'jetbrains', status: 'authenticated' };
      } catch (e) {
        fail('Failed to write token: ' + e.message);
      }
    } else {
      info('Skipped JetBrains setup');
    }
  }

  return results;
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary(results) {
  heading('Auth Status Summary');
  var allGood = true;
  results.forEach(function (r) {
    if (r.status === 'authenticated') {
      ok(r.platform + ': AUTHENTICATED' + (r.user ? ' (' + r.user + ')' : ''));
    } else {
      fail(r.platform + ': ' + r.status.toUpperCase());
      allGood = false;
    }
  });

  console.log('');
  if (allGood) {
    ok('All 3 CLI platforms ready. You can now run:');
    info('  node scripts/release.js preflight');
    info('  node scripts/release.js deploy');
  } else {
    warn('Some platforms still need authentication.');
    info('Fix the issues above and re-run: node scripts/setup-auth.js');
  }
  return allGood;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nEZRA v6.0.0 — Auth Setup');
  console.log('Checking credentials for 3 CLI deployment platforms...');

  var statusOnly = process.argv[2] === 'status';

  // Run all checks
  var results = [
    checkNpm(),
    checkVsce(),
    checkJetBrains()
  ];

  if (!statusOnly) {
    var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      results = await interactiveSetup(rl, results);
    } finally {
      rl.close();
    }
  }

  var allGood = printSummary(results);
  process.exit(allGood ? 0 : 1);
}

main().catch(function (err) {
  console.error('Unexpected error: ' + err.message);
  process.exit(1);
});
