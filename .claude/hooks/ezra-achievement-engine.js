#!/usr/bin/env node
'use strict';

/**
 * hooks/ezra-achievement-engine.js — Achievement evaluation engine for EZRA v7
 * Evaluates achievement rules against project state and emits achievement_earned events.
 * Zero external dependencies.
 */

const fs   = require('fs');
const path = require('path');

let _eventBus;
try { _eventBus = require('./ezra-event-bus'); } catch (_e) { _eventBus = null; }

// ── Built-in achievement definitions ─────────────────────────────────────────

const BUILT_IN_ACHIEVEMENTS = [
  {
    id: 'first_decision',
    name: 'First Decision',
    description: 'Record your first architectural decision',
    icon: '🏛️',
    points: 10,
    rules: [{ type: 'count', metric: 'decisions', operator: '>=', value: 1 }],
  },
  {
    id: 'governance_foundation',
    name: 'Governance Foundation',
    description: 'Record 5 architectural decisions',
    icon: '📜',
    points: 25,
    rules: [{ type: 'count', metric: 'decisions', operator: '>=', value: 5 }],
  },
  {
    id: 'first_scan',
    name: 'First Scan',
    description: 'Run your first codebase scan',
    icon: '🔍',
    points: 10,
    rules: [{ type: 'count', metric: 'scans', operator: '>=', value: 1 }],
  },
  {
    id: 'health_a',
    name: 'Grade A Health',
    description: 'Achieve a health score of 90 or above',
    icon: '🏆',
    points: 50,
    rules: [{ type: 'score', metric: 'health_score', operator: '>=', value: 90 }],
  },
  {
    id: 'health_b',
    name: 'Grade B Health',
    description: 'Achieve a health score of 75 or above',
    icon: '⭐',
    points: 25,
    rules: [{ type: 'score', metric: 'health_score', operator: '>=', value: 75 }],
  },
  {
    id: 'phase_complete',
    name: 'Phase Complete',
    description: 'Complete your first execution phase',
    icon: '🎯',
    points: 30,
    rules: [{ type: 'count', metric: 'phases_completed', operator: '>=', value: 1 }],
  },
  {
    id: 'gate_champion',
    name: 'Gate Champion',
    description: 'Pass 5 phase gates',
    icon: '🛡️',
    points: 40,
    rules: [{ type: 'count', metric: 'gates_passed', operator: '>=', value: 5 }],
  },
  {
    id: 'commit_streak',
    name: 'Commit Streak',
    description: 'Create 10 commits',
    icon: '💾',
    points: 20,
    rules: [{ type: 'count', metric: 'commits', operator: '>=', value: 10 }],
  },
  {
    id: 'docs_complete',
    name: 'Documentation Complete',
    description: 'Have at least 10 SDLC documents created',
    icon: '📚',
    points: 35,
    rules: [{ type: 'count', metric: 'documents', operator: '>=', value: 10 }],
  },
  {
    id: 'security_clean',
    name: 'Security Clean',
    description: 'Achieve a security gate score of 90+',
    icon: '🔒',
    points: 45,
    rules: [{ type: 'score', metric: 'security_score', operator: '>=', value: 90 }],
  },
  {
    id: 'zero_drift',
    name: 'Zero Drift',
    description: 'Sync all documents — no stale docs',
    icon: '✨',
    points: 30,
    rules: [{ type: 'count', metric: 'stale_docs', operator: '===', value: 0 }],
  },
  {
    id: 'library_builder',
    name: 'Library Builder',
    description: 'Add 20 entries to the best practice library',
    icon: '🏗️',
    points: 25,
    rules: [{ type: 'count', metric: 'library_entries', operator: '>=', value: 20 }],
  },
];

// ── State paths ───────────────────────────────────────────────────────────────

function achievementsDir(projectDir) {
  return path.join(projectDir, '.ezra', 'achievements');
}

function earnedPath(projectDir) {
  return path.join(achievementsDir(projectDir), 'earned.json');
}

// ── Load / save ───────────────────────────────────────────────────────────────

function loadEarned(projectDir) {
  const p = earnedPath(projectDir);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return []; }
}

function saveEarned(projectDir, earned) {
  const dir = achievementsDir(projectDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(earnedPath(projectDir), JSON.stringify(earned, null, 2), 'utf8');
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evalRule(rule, metrics) {
  const val = metrics[rule.metric];
  if (val === undefined || val === null) return false;
  const n = Number(val);
  const t = Number(rule.value);
  switch (rule.operator) {
    case '>=': return n >= t;
    case '>':  return n > t;
    case '<=': return n <= t;
    case '<':  return n < t;
    case '===': return n === t;
    case '==':  return n == rule.value; // eslint-disable-line eqeqeq
    default:    return false;
  }
}

function checkAchievement(achievement, metrics) {
  return achievement.rules.every(r => evalRule(r, metrics));
}

// ── Collect metrics from .ezra/ state ────────────────────────────────────────

function collectMetrics(projectDir) {
  const metrics = {
    decisions: 0, scans: 0, health_score: 0, phases_completed: 0,
    gates_passed: 0, commits: 0, documents: 0, security_score: 0,
    stale_docs: 0, library_entries: 0,
  };

  try {
    const decisionsDir = path.join(projectDir, '.ezra', 'decisions');
    if (fs.existsSync(decisionsDir)) {
      metrics.decisions = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.yaml')).length;
    }
  } catch (_e) { /* ignore */ }

  try {
    const scansDir = path.join(projectDir, '.ezra', 'scans');
    if (fs.existsSync(scansDir)) {
      metrics.scans = fs.readdirSync(scansDir).filter(f => f.endsWith('.yaml')).length;
    }
  } catch (_e) { /* ignore */ }

  try {
    const versionPath = path.join(projectDir, '.ezra', 'versions', 'current.yaml');
    if (fs.existsSync(versionPath)) {
      const content = fs.readFileSync(versionPath, 'utf8');
      const scoreMatch = content.match(/health_score:\s*(\d+)/);
      if (scoreMatch) metrics.health_score = parseInt(scoreMatch[1], 10);
    }
  } catch (_e) { /* ignore */ }

  try {
    const gatesDir = path.join(projectDir, '.ezra', 'gates');
    if (fs.existsSync(gatesDir)) {
      const gateFiles = fs.readdirSync(gatesDir).filter(f => f.endsWith('.yaml'));
      let passed = 0;
      for (const f of gateFiles) {
        const content = fs.readFileSync(path.join(gatesDir, f), 'utf8');
        if (content.includes('passed: true')) passed++;
      }
      metrics.gates_passed = passed;
    }
  } catch (_e) { /* ignore */ }

  return metrics;
}

// ── Main evaluate function ────────────────────────────────────────────────────

function evaluate(projectDir, metricsOverride) {
  const metrics = metricsOverride || collectMetrics(projectDir);
  const earned = loadEarned(projectDir);
  const earnedIds = new Set(earned.map(e => e.id));
  const newlyEarned = [];

  for (const achievement of BUILT_IN_ACHIEVEMENTS) {
    if (earnedIds.has(achievement.id)) continue;
    if (checkAchievement(achievement, metrics)) {
      const record = { id: achievement.id, earned_at: new Date().toISOString() };
      earned.push(record);
      newlyEarned.push({ ...achievement, earned_at: record.earned_at });
      earnedIds.add(achievement.id);

      // Emit event
      if (_eventBus) {
        try {
          _eventBus.emit(projectDir, 'achievement_earned', {
            achievement_id: achievement.id,
            name: achievement.name,
            points: achievement.points,
          });
        } catch (_e) { /* ignore */ }
      }
    }
  }

  if (newlyEarned.length > 0) {
    saveEarned(projectDir, earned);
  }

  return {
    newly_earned: newlyEarned,
    total_earned: earned.length,
    total_points: earned.reduce((sum, e) => {
      const def = BUILT_IN_ACHIEVEMENTS.find(a => a.id === e.id);
      return sum + (def ? def.points : 0);
    }, 0),
    metrics,
  };
}

function listAchievements(projectDir) {
  const earned = loadEarned(projectDir);
  const earnedMap = new Map(earned.map(e => [e.id, e]));
  return BUILT_IN_ACHIEVEMENTS.map(a => ({
    ...a,
    earned: earnedMap.has(a.id),
    earned_at: earnedMap.get(a.id)?.earned_at ?? null,
  }));
}

// ── Stdin hook mode ───────────────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => { raw += c; });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw); } catch (_e) { /* empty */ }
    const projectDir = input.cwd || process.cwd();
    let output = {};
    try {
      if (input.action === 'list') output = { achievements: listAchievements(projectDir) };
      else output = evaluate(projectDir, input.metrics || null);
    } catch (e) { output = { error: e.message }; }
    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0);
  });
}

module.exports = {
  BUILT_IN_ACHIEVEMENTS,
  evaluate,
  listAchievements,
  collectMetrics,
  checkAchievement,
  loadEarned,
  saveEarned,
};
