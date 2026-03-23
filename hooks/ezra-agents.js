#!/usr/bin/env node
'use strict';

/**
 * EZRA Multi-Agent Orchestration Engine
 *
 * Agent roster management, task assignment with weighted scoring,
 * performance tracking, budget management, and mock providers.
 *
 * Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');

// --- Supported Providers ---

const SUPPORTED_PROVIDERS = [
  { name: 'claude', type: 'llm', integration: ['api', 'mcp'] },
  { name: 'codex', type: 'llm', integration: ['api'] },
  { name: 'cursor', type: 'ide-agent', integration: ['extension'] },
  { name: 'copilot', type: 'ide-agent', integration: ['extension', 'api'] },
  { name: 'gemini', type: 'llm', integration: ['api'] },
  { name: 'grok', type: 'llm', integration: ['api'] },
  { name: 'mistral', type: 'llm', integration: ['api'] },
  { name: 'llama', type: 'llm', integration: ['local', 'api'] },
  { name: 'deepseek', type: 'llm', integration: ['api'] },
];

// --- Assignment Strategies ---

const ASSIGNMENT_STRATEGIES = ['auto', 'manual', 'round-robin', 'cost-optimised', 'quality-optimised'];

// --- Scoring Weights ---

const SCORING_WEIGHTS = {
  skill_match: 0.35,
  cost_efficiency: 0.25,
  speed: 0.15,
  quality_score: 0.15,
  availability: 0.10,
};

// --- Path Helpers ---

function getAgentsDir(projectDir) {
  return path.join(projectDir, '.ezra', 'agents');
}

function getRosterPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'roster.yaml');
}

function getBudgetPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'budget.yaml');
}

function getTaskLogPath(projectDir) {
  return path.join(getAgentsDir(projectDir), 'task-log.yaml');
}

function getPerformancePath(projectDir, agentName) {
  return path.join(getAgentsDir(projectDir), 'performance', agentName + '.yaml');
}

// --- Simple YAML helpers ---

function writeYaml(filePath, obj) {
  const lines = [];
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      lines.push(key + ': [' + val.join(', ') + ']');
    } else if (typeof val === 'object' && val !== null) {
      lines.push(key + ':');
      for (const [k2, v2] of Object.entries(val)) {
        lines.push('  ' + k2 + ': ' + v2);
      }
    } else {
      lines.push(key + ': ' + val);
    }
  }
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function readYaml(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const result = {};
  let currentSection = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent === 0) {
      const m = line.match(/^([\w_-]+):\s*(.*)?$/);
      if (!m) continue;
      const key = m[1];
      const val = (m[2] || '').trim();
      if (val === '' || val === undefined) {
        currentSection = key;
        result[key] = {};
      } else if (val.startsWith('[') && val.endsWith(']')) {
        currentSection = null;
        const inner = val.slice(1, -1).trim();
        result[key] = inner === '' ? [] : inner.split(',').map(s => s.trim());
      } else if (val === 'true') { result[key] = true; currentSection = null; }
      else if (val === 'false') { result[key] = false; currentSection = null; }
      else if (/^-?\d+\.\d+$/.test(val)) { result[key] = parseFloat(val); currentSection = null; }
      else if (/^-?\d+$/.test(val)) { result[key] = parseInt(val, 10); currentSection = null; }
      else { result[key] = val; currentSection = null; }
    } else if (currentSection) {
      const trimmed = line.trim();
      const m = trimmed.match(/^([\w_-]+):\s*(.*)?$/);
      if (m) {
        const key = m[1];
        const val = (m[2] || '').trim();
        if (typeof result[currentSection] !== 'object') result[currentSection] = {};
        if (val === 'true') result[currentSection][key] = true;
        else if (val === 'false') result[currentSection][key] = false;
        else if (/^-?\d+\.\d+$/.test(val)) result[currentSection][key] = parseFloat(val);
        else if (/^-?\d+$/.test(val)) result[currentSection][key] = parseInt(val, 10);
        else result[currentSection][key] = val;
      }
    }
  }
  return result;
}

// --- Provider Factory ---

function createProvider(config) {
  const name = config.name || 'mock';
  const type = config.type || 'llm';
  const model = config.model || name;
  let busy = false;

  return {
    name,
    type,
    model,
    execute: async (task) => {
      busy = true;
      const duration = 100 + Math.floor(Math.random() * 200);
      const tokens = 500 + Math.floor(Math.random() * 1500);
      const cost = tokens * 0.00003;
      await new Promise(r => setTimeout(r, 10)); // simulate async
      busy = false;
      return { output: 'Mock response for: ' + (task.description || task), tokens, cost: Math.round(cost * 10000) / 10000, duration };
    },
    status: () => busy ? 'busy' : 'ready',
  };
}

// --- Load Agent Config ---

function loadAgentConfig(projectDir) {
  try {
    const settings = require(path.join(__dirname, 'ezra-settings.js'));
    return settings.loadSettings(projectDir).agents || {};
  } catch {
    return {};
  }
}

// --- Roster Management ---

function getAgentRoster(projectDir) {
  const rosterPath = getRosterPath(projectDir);
  if (!fs.existsSync(rosterPath)) return [];
  const data = readYaml(rosterPath);
  const agents = [];
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'object' && val !== null) {
      agents.push({ name: key, ...val });
    }
  }
  return agents;
}

// --- Task Assignment ---

function assignTask(projectDir, task, strategy) {
  strategy = strategy || 'auto';
  const roster = getAgentRoster(projectDir);
  if (roster.length === 0) {
    // Return first supported provider as fallback
    return { agent: SUPPORTED_PROVIDERS[0].name, strategy, reason: 'no_roster_fallback_to_default' };
  }

  if (strategy === 'manual') {
    return { agent: roster[0].name, strategy: 'manual', reason: 'manual_selection' };
  }

  if (strategy === 'round-robin') {
    const log = readYaml(getTaskLogPath(projectDir));
    const lastIdx = log.last_index || 0;
    const nextIdx = (lastIdx + 1) % roster.length;
    return { agent: roster[nextIdx].name, strategy: 'round-robin', reason: 'round_robin_index_' + nextIdx };
  }

  // Auto / cost-optimised / quality-optimised: use weighted scoring
  const taskType = (task && task.type) || 'general';
  const scores = [];

  for (const agent of roster) {
    const perf = getAgentPerformance(projectDir, agent.name);
    const skillMatch = perf.success_rate || 0.5;
    const costEff = perf.avg_cost ? (1 / (perf.avg_cost + 0.001)) : 0.5;
    const speed = perf.avg_duration ? (1 / (perf.avg_duration + 1)) : 0.5;
    const quality = perf.acceptance_rate || 0.5;
    const avail = agent.status === 'offline' ? 0 : 1;

    let weights = { ...SCORING_WEIGHTS };
    if (strategy === 'cost-optimised') {
      weights = { skill_match: 0.2, cost_efficiency: 0.45, speed: 0.15, quality_score: 0.1, availability: 0.1 };
    } else if (strategy === 'quality-optimised') {
      weights = { skill_match: 0.25, cost_efficiency: 0.1, speed: 0.1, quality_score: 0.45, availability: 0.1 };
    }

    const score = (skillMatch * weights.skill_match) +
      (Math.min(costEff, 1) * weights.cost_efficiency) +
      (Math.min(speed, 1) * weights.speed) +
      (quality * weights.quality_score) +
      (avail * weights.availability);

    scores.push({ agent: agent.name, score: Math.round(score * 1000) / 1000 });
  }

  scores.sort((a, b) => b.score - a.score);
  return { agent: scores[0].agent, strategy, scores, reason: 'weighted_scoring' };
}

// --- Performance Tracking ---

function recordTaskResult(projectDir, agentName, task, result) {
  const perfDir = path.join(getAgentsDir(projectDir), 'performance');
  if (!fs.existsSync(perfDir)) fs.mkdirSync(perfDir, { recursive: true });

  const perfPath = getPerformancePath(projectDir, agentName);
  const perf = fs.existsSync(perfPath) ? readYaml(perfPath) : {};

  const tasks_completed = (perf.tasks_completed || 0) + 1;
  const total_cost = (perf.total_cost || 0) + (result.cost || 0);
  const total_duration = (perf.total_duration || 0) + (result.duration || 0);
  const successes = (perf.successes || 0) + (result.success !== false ? 1 : 0);

  const updated = {
    agent: agentName,
    tasks_completed,
    successes,
    total_cost: Math.round(total_cost * 10000) / 10000,
    total_duration,
    avg_cost: Math.round((total_cost / tasks_completed) * 10000) / 10000,
    avg_duration: Math.round(total_duration / tasks_completed),
    success_rate: Math.round((successes / tasks_completed) * 100) / 100,
    acceptance_rate: Math.round((successes / tasks_completed) * 100) / 100,
    last_task: new Date().toISOString().slice(0, 19),
  };

  writeYaml(perfPath, updated);

  // Also log to task-log
  const logPath = getTaskLogPath(projectDir);
  const log = fs.existsSync(logPath) ? readYaml(logPath) : {};
  log.total_tasks = (log.total_tasks || 0) + 1;
  log.last_agent = agentName;
  log.last_task_time = updated.last_task;
  writeYaml(logPath, log);

  return updated;
}

function getAgentPerformance(projectDir, agentName) {
  const perfPath = getPerformancePath(projectDir, agentName);
  if (!fs.existsSync(perfPath)) {
    return { agent: agentName, tasks_completed: 0, successes: 0, total_cost: 0, avg_cost: 0, avg_duration: 0, success_rate: 0.5, acceptance_rate: 0.5 };
  }
  return readYaml(perfPath);
}

function getAgentLeaderboard(projectDir) {
  const perfDir = path.join(getAgentsDir(projectDir), 'performance');
  if (!fs.existsSync(perfDir)) return [];
  const files = fs.readdirSync(perfDir).filter(f => f.endsWith('.yaml'));
  const agents = files.map(f => {
    const data = readYaml(path.join(perfDir, f));
    const qualityAdjustedCost = data.avg_cost && data.success_rate
      ? Math.round((data.avg_cost / Math.max(data.success_rate, 0.01)) * 10000) / 10000
      : 999;
    return { ...data, quality_adjusted_cost: qualityAdjustedCost };
  });
  agents.sort((a, b) => a.quality_adjusted_cost - b.quality_adjusted_cost);
  return agents;
}

// --- Budget ---

function checkBudget(projectDir) {
  const budgetPath = getBudgetPath(projectDir);
  const config = loadAgentConfig(projectDir);
  const dailyCeiling = config.budget_ceiling_daily || 10;
  const monthlyCeiling = config.budget_ceiling_monthly || 200;
  const currency = config.budget_ceiling_currency || 'USD';

  const budget = fs.existsSync(budgetPath) ? readYaml(budgetPath) : { daily_spend: 0, monthly_spend: 0 };

  return {
    daily_spend: budget.daily_spend || 0,
    monthly_spend: budget.monthly_spend || 0,
    daily_ceiling: dailyCeiling,
    monthly_ceiling: monthlyCeiling,
    currency: currency,
    daily_remaining: dailyCeiling - (budget.daily_spend || 0),
    monthly_remaining: monthlyCeiling - (budget.monthly_spend || 0),
    overspend: (budget.daily_spend || 0) > dailyCeiling || (budget.monthly_spend || 0) > monthlyCeiling,
  };
}

// --- Exports ---

module.exports = {
  SUPPORTED_PROVIDERS,
  ASSIGNMENT_STRATEGIES,
  SCORING_WEIGHTS,
  createProvider,
  loadAgentConfig,
  getAgentRoster,
  assignTask,
  recordTaskResult,
  getAgentPerformance,
  getAgentLeaderboard,
  checkBudget,
  writeYaml,
  readYaml,
};

// --- Hook Protocol ---

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const cwd = event.cwd || process.cwd();
      const action = event.action || 'roster';

      if (action === 'roster') {
        process.stdout.write(JSON.stringify(getAgentRoster(cwd)));
      } else if (action === 'assign') {
        process.stdout.write(JSON.stringify(assignTask(cwd, event.task, event.strategy)));
      } else if (action === 'performance') {
        process.stdout.write(JSON.stringify(getAgentPerformance(cwd, event.agent)));
      } else if (action === 'leaderboard') {
        process.stdout.write(JSON.stringify(getAgentLeaderboard(cwd)));
      } else if (action === 'budget') {
        process.stdout.write(JSON.stringify(checkBudget(cwd)));
      } else {
        process.stdout.write('{}');
      }
    } catch {
      process.stdout.write('{}');
    }
    process.exit(0);
  });
}
