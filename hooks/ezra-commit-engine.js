#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let _http, _settings, _log;
try { _http = require('./ezra-http.js'); } catch { _http = null; }
try { _settings = require('./ezra-settings.js'); } catch { _settings = null; }
try { _log = require('./ezra-hook-logger.js').logHookEvent; } catch { _log = () => {}; }

const MAX_FILES_PER_BATCH = 10;

// Protected branches that can never be pushed to directly
const PROTECTED_BRANCHES = ['main', 'master', 'production', 'release'];

// Conventional commit types
const COMMIT_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build'];

/**
 * Run a git command safely.
 * Returns { success, output, error }
 */
function runGit(args, cwd) {
  try {
    const output = execSync(`git ${args}`, { cwd, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: output.trim() };
  } catch (e) {
    return { success: false, output: '', error: (e.stderr || e.message || '').trim() };
  }
}

/**
 * Get list of changed files (staged + unstaged, excluding untracked).
 * Returns string[] of relative paths.
 */
function getChangedFiles(projectDir) {
  // Staged
  const staged = runGit('diff --cached --name-only', projectDir);
  // Unstaged tracked
  const unstaged = runGit('diff --name-only', projectDir);
  
  const files = new Set();
  if (staged.success) staged.output.split('\n').filter(Boolean).forEach(f => files.add(f));
  if (unstaged.success) unstaged.output.split('\n').filter(Boolean).forEach(f => files.add(f));
  return Array.from(files);
}

/**
 * Get only staged files.
 */
function getStagedFiles(projectDir) {
  const result = runGit('diff --cached --name-only', projectDir);
  return result.success ? result.output.split('\n').filter(Boolean) : [];
}

/**
 * Split files into batches of max MAX_FILES_PER_BATCH.
 * Returns string[][]
 */
function batchFiles(files, maxPerBatch) {
  const max = maxPerBatch || MAX_FILES_PER_BATCH;
  const batches = [];
  for (let i = 0; i < files.length; i += max) {
    batches.push(files.slice(i, i + max));
  }
  return batches.length > 0 ? batches : [[]];
}

/**
 * Generate a conventional commit message from files changed and a description.
 * Infers type from file paths.
 */
function generateCommitMessage(files, description, options = {}) {
  const type = options.type || inferCommitType(files);
  const scope = options.scope || inferScope(files);
  const header = scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;
  const body = options.body || '';
  const footer = options.footer || '';
  
  const parts = [header];
  if (body) parts.push('', body);
  if (footer) parts.push('', footer);
  return parts.join('\n');
}

/**
 * Infer commit type from file paths.
 */
function inferCommitType(files) {
  const paths = files.join(' ').toLowerCase();
  if (paths.includes('test') || paths.includes('spec')) return 'test';
  if (paths.includes('doc') || paths.includes('.md')) return 'docs';
  if (paths.includes('.css') || paths.includes('.scss')) return 'style';
  if (paths.includes('fix') || paths.includes('bug')) return 'fix';
  if (paths.includes('ci') || paths.includes('.github')) return 'ci';
  return 'feat';
}

/**
 * Infer scope from file paths.
 */
function inferScope(files) {
  if (files.length === 0) return '';
  // Common directory names as scope
  const dirs = files.map(f => f.split('/')[0]).filter(Boolean);
  const counts = {};
  for (const d of dirs) { counts[d] = (counts[d] || 0) + 1; }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topDir = sorted[0] ? sorted[0][0] : '';
  // Don't use generic top-level dirs as scope
  const skip = new Set(['src', 'lib', 'app', 'hooks', 'tests', 'docs', 'commands']);
  return skip.has(topDir) ? '' : topDir;
}

/**
 * Get current branch name.
 */
function getCurrentBranch(projectDir) {
  const result = runGit('rev-parse --abbrev-ref HEAD', projectDir);
  return result.success ? result.output : 'unknown';
}

/**
 * Check if branch is protected.
 */
function isProtectedBranch(branch) {
  const lower = branch.toLowerCase();
  return PROTECTED_BRANCHES.some(p => lower === p || lower.startsWith(p + '/'));
}

/**
 * Stage specific files and create a commit.
 * Returns { success, sha, message }
 */
function commitBatch(projectDir, files, message) {
  if (!files || files.length === 0) return { success: false, error: 'No files to commit' };
  
  // Stage the files
  for (const f of files) {
    const stageResult = runGit(`add "${f.replace(/"/g, '\\"')}"`, projectDir);
    if (!stageResult.success) {
      return { success: false, error: `Failed to stage ${f}: ${stageResult.error}` };
    }
  }
  
  // Commit
  const escapedMsg = message.replace(/"/g, '\\"');
  const commitResult = runGit(`commit -m "${escapedMsg}"`, projectDir);
  if (!commitResult.success) {
    return { success: false, error: commitResult.error };
  }
  
  // Get SHA
  const shaResult = runGit('rev-parse HEAD', projectDir);
  return { success: true, sha: shaResult.output, message };
}

/**
 * Push current branch to origin.
 * Guards against pushing to protected branches without override.
 */
function pushBranch(projectDir, options = {}) {
  const branch = getCurrentBranch(projectDir);
  if (isProtectedBranch(branch) && !options.force_push_protected) {
    return {
      success: false,
      error: `Branch '${branch}' is protected. Cannot push without explicit override.`,
      protected: true,
    };
  }
  const pushCmd = options.set_upstream ? `push -u origin ${branch}` : `push origin ${branch}`;
  const result = runGit(pushCmd, projectDir);
  return { success: result.success, output: result.output, error: result.error, branch };
}

/**
 * Create a GitHub PR via REST API.
 * Requires settings.github.token, repo_owner, repo_name.
 */
async function createPR(projectDir, options = {}) {
  if (!_http) return { success: false, error: 'ezra-http not available' };
  const settings = _settings ? _settings.loadSettings(projectDir) : {};
  const github = settings.github || {};
  
  if (!github.token) return { success: false, error: 'GitHub token not configured' };
  if (!github.repo_owner || !github.repo_name) return { success: false, error: 'GitHub repo_owner and repo_name not configured' };

  const branch = getCurrentBranch(projectDir);
  const baseBranch = options.base_branch || github.base_branch || 'main';

  const body = {
    title: options.title || `feat: automated PR from EZRA (${branch})`,
    body: options.body || `Automated pull request created by EZRA autonomous execution.\n\nBranch: ${branch}`,
    head: branch,
    base: baseBranch,
    draft: options.draft || false,
  };

  try {
    const result = await _http.post(
      `https://api.github.com/repos/${github.repo_owner}/${github.repo_name}/pulls`,
      body,
      {
        'Authorization': `token ${github.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    );
    return { success: true, pr_url: result.html_url, pr_number: result.number };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Auto-merge a PR if settings allow.
 */
async function autoMerge(projectDir, prNumber) {
  if (!_http) return { success: false, error: 'ezra-http not available' };
  const settings = _settings ? _settings.loadSettings(projectDir) : {};
  const github = settings.github || {};

  if (!github.auto_merge_on_green) return { success: false, skipped: true, reason: 'auto_merge_on_green not enabled' };
  if (!github.token || !github.repo_owner || !github.repo_name) return { success: false, error: 'GitHub not fully configured' };

  try {
    const result = await _http.post(
      `https://api.github.com/repos/${github.repo_owner}/${github.repo_name}/pulls/${prNumber}/merge`,
      { merge_method: 'squash' },
      {
        'Authorization': `token ${github.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      }
    );
    return { success: true, merged: result.merged, sha: result.sha };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  MAX_FILES_PER_BATCH,
  PROTECTED_BRANCHES,
  COMMIT_TYPES,
  getChangedFiles,
  getStagedFiles,
  batchFiles,
  generateCommitMessage,
  inferCommitType,
  inferScope,
  getCurrentBranch,
  isProtectedBranch,
  commitBatch,
  pushBranch,
  createPR,
  autoMerge,
};

// Hook protocol
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    (async () => {
      try {
        const event = JSON.parse(input);
        const cwd = event.cwd || process.cwd();
        const action = event.action || 'status';
        if (action === 'batch') {
          const files = getChangedFiles(cwd);
          const batches = batchFiles(files);
          process.stdout.write(JSON.stringify({ batches, total_files: files.length }));
        } else {
          const branch = getCurrentBranch(cwd);
          process.stdout.write(JSON.stringify({ branch, protected: isProtectedBranch(branch) }));
        }
      } catch (e) {
        process.stderr.write('ezra-commit-engine: ' + e.message + '\n');
        process.stdout.write(JSON.stringify({ error: e.message }));
      }
      process.exit(0);
    })();
  });
}
