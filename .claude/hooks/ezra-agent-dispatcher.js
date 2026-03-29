#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-agent-dispatcher.js — Routes tasks to the right execution strategy.
 * Uses built-in modules only. ZERO external dependencies.
 * Hook protocol: reads JSON from stdin, writes JSON to stdout, exits 0.
 */

const MAX_STDIN = 1024 * 1024; // 1 MB

// ─── Constants ───────────────────────────────────────────────────

const SPECIALIST_ROLES = [
  'security-specialist',
  'architecture-reviewer',
  'test-engineer',
  'devops-engineer',
  'documentation-writer',
];

const DIRECT_ROLES = ['code-agent'];

// ─── Exported Functions ───────────────────────────────────────────

/**
 * Returns 'specialist' if agentRole is in SPECIALIST_ROLES, else 'direct'.
 */
function getDispatchStrategy(agentRole) {
  return SPECIALIST_ROLES.includes(agentRole) ? 'specialist' : 'direct';
}

/**
 * Builds a formatted task prompt string from a task object.
 */
function buildTaskPrompt(task) {
  const title = task.title || '(untitled)';
  const description = task.description || '';
  const criteria = task.acceptance_criteria || '';
  const files = Array.isArray(task.file_targets)
    ? task.file_targets.join(', ')
    : (task.file_targets || 'none');

  return (
    'Task: ' + title +
    '\n\nDescription: ' + description +
    '\n\nAcceptance Criteria: ' + criteria +
    '\n\nFile targets: ' + files
  );
}

/**
 * Dispatches a task using the appropriate strategy.
 * - 'direct': returns prompt and task_id immediately (no network call).
 * - 'specialist': delegates to ezra-mah-client.routeTask().
 */
async function dispatchTask(projectDir, task) {
  const strategy = getDispatchStrategy(task.agent_role || '');

  if (strategy === 'direct') {
    return {
      dispatched: true,
      strategy: 'direct',
      prompt: buildTaskPrompt(task),
      task_id: task.id || task.task_id,
    };
  }

  // specialist — route via MAH client
  let mahClient;
  try {
    mahClient = require('./ezra-mah-client');
  } catch (_) {
    return {
      dispatched: false,
      strategy: 'specialist',
      error: 'ezra-mah-client not available',
      task_id: task.id || task.task_id,
    };
  }

  try {
    const result = await mahClient.routeTask(projectDir, task);
    return {
      dispatched: result.routed === true,
      strategy: 'specialist',
      task_id: task.id || task.task_id,
      result: result.result,
      error: result.error,
    };
  } catch (e) {
    return {
      dispatched: false,
      strategy: 'specialist',
      task_id: task.id || task.task_id,
      error: e.message,
    };
  }
}

/**
 * Validates a task dispatch result.
 * Returns { valid: bool, issues: string[] }.
 */
function validateTaskResult(task, result) {
  const issues = [];
  if (!result) {
    issues.push('Result is null or undefined');
  } else {
    if (result.dispatched !== true) {
      issues.push('result.dispatched is not true' + (result.error ? ': ' + result.error : ''));
    }
  }
  return { valid: issues.length === 0, issues };
}

// ─── Hook Protocol ────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > MAX_STDIN) { raw = raw.slice(0, MAX_STDIN); }
  });
  process.stdin.on('end', async () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch (_) { input = {}; }

    const action = input.action || '';
    const projectDir = input.project_dir || process.cwd();
    let output = {};

    try {
      if (action === 'dispatch') {
        output = await dispatchTask(projectDir, input.task || {});
      } else if (action === 'validate') {
        output = validateTaskResult(input.task || {}, input.result || null);
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
  SPECIALIST_ROLES,
  DIRECT_ROLES,
  getDispatchStrategy,
  buildTaskPrompt,
  dispatchTask,
  validateTaskResult,
};
