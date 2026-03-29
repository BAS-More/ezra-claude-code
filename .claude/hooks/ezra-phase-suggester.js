#!/usr/bin/env node
'use strict';

/**
 * hooks/ezra-phase-suggester.js — Phase suggestion algorithm for EZRA v7
 * Groups tasks into phases by feature area, dependencies, and complexity.
 * ZERO external dependencies.
 */

const crypto = require('crypto');

const MAX_HIGH_COMPLEXITY_PER_PHASE = 8;
const MAX_TASKS_PER_PHASE = 15;

function generateId() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Group tasks into phases respecting:
 * 1. Explicit phase assignments on tasks
 * 2. Max high-complexity tasks per phase
 * 3. Max total tasks per phase
 * 4. Dependency ordering
 */
function groupIntoPhases(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  // Group by explicit phase first
  const byPhase = {};
  for (const t of tasks) {
    const p = t.phase || 1;
    if (!byPhase[p]) byPhase[p] = [];
    byPhase[p].push(t);
  }

  const phases = [];
  for (const [phaseNum, phaseTasks] of Object.entries(byPhase).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    // Check if we need to split this phase
    const split = splitIfOverLimit(phaseTasks, Number(phaseNum));
    phases.push(...split);
  }

  // Re-number phases sequentially
  phases.forEach((p, i) => {
    p.phase = i + 1;
    p.tasks.forEach(t => { t.phase = i + 1; });
  });

  // Add gate task at end of each phase
  for (const phase of phases) {
    phase.tasks.push({
      id: 'gate-' + generateId(),
      phase: phase.phase,
      title: 'Phase ' + phase.phase + ' gate',
      description: 'Run gate checks: all tests, lint, security scan, standards check, coverage report.',
      acceptance_criteria: 'All checks pass. No blockers. Phase can advance.',
      agent_role: 'test-engineer',
      complexity: 'medium',
      depends_on: phase.tasks.map(t => t.id),
      type: 'gate',
      status: 'pending',
    });
    phase.gate_task_id = phase.tasks[phase.tasks.length - 1].id;
    phase.task_count = phase.tasks.length;
  }

  return phases;
}

function splitIfOverLimit(tasks, basePhase) {
  const highComplexity = tasks.filter(t => t.complexity === 'high' || t.complexity === 'critical');
  const isOverLimit = highComplexity.length > MAX_HIGH_COMPLEXITY_PER_PHASE || tasks.length > MAX_TASKS_PER_PHASE;

  if (!isOverLimit) {
    return [{
      phase: basePhase,
      name: getPhaseName(basePhase),
      tasks: tasks.slice(),
      task_count: tasks.length,
      high_complexity_count: highComplexity.length,
    }];
  }

  // Split into chunks
  const chunks = [];
  let current = [];
  let currentHigh = 0;

  for (const t of tasks) {
    const isHigh = t.complexity === 'high' || t.complexity === 'critical';
    if ((isHigh && currentHigh >= MAX_HIGH_COMPLEXITY_PER_PHASE) || current.length >= MAX_TASKS_PER_PHASE) {
      if (current.length > 0) chunks.push(current);
      current = [];
      currentHigh = 0;
    }
    current.push(t);
    if (isHigh) currentHigh++;
  }
  if (current.length > 0) chunks.push(current);

  return chunks.map((chunk, i) => ({
    phase: basePhase + i * 0.1,  // will be renumbered
    name: getPhaseName(basePhase) + (chunks.length > 1 ? ' (Part ' + (i + 1) + ')' : ''),
    tasks: chunk,
    task_count: chunk.length,
    high_complexity_count: chunk.filter(t => t.complexity === 'high' || t.complexity === 'critical').length,
  }));
}

function getPhaseName(phaseNum) {
  const names = {
    1: 'Foundation',
    2: 'Core Features',
    3: 'Frontend & Testing',
    4: 'Deployment & Documentation',
  };
  return names[Math.round(phaseNum)] || 'Phase ' + phaseNum;
}

/**
 * Calculate complexity score for a phase (0-100).
 * Used for health reporting.
 */
function calculatePhaseComplexity(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const weights = { low: 1, medium: 3, high: 5, critical: 8 };
  const total = tasks.reduce((sum, t) => sum + (weights[t.complexity] || 3), 0);
  const max = tasks.length * 8;
  return Math.round((total / max) * 100);
}

/**
 * Validate phase ordering — all dependencies must be in earlier phases.
 * Returns list of violations.
 */
function validatePhaseOrdering(phases) {
  const violations = [];
  const taskPhaseMap = {};
  for (const p of phases) {
    for (const t of p.tasks) {
      taskPhaseMap[t.id] = p.phase;
    }
  }
  for (const p of phases) {
    for (const t of p.tasks) {
      for (const depId of (t.depends_on || [])) {
        const depPhase = taskPhaseMap[depId];
        if (depPhase !== undefined && depPhase > p.phase) {
          violations.push({ task: t.id, depends_on: depId, task_phase: p.phase, dep_phase: depPhase });
        }
      }
    }
  }
  return violations;
}

module.exports = {
  groupIntoPhases,
  splitIfOverLimit,
  calculatePhaseComplexity,
  validatePhaseOrdering,
  getPhaseName,
  MAX_HIGH_COMPLEXITY_PER_PHASE,
  MAX_TASKS_PER_PHASE,
};
