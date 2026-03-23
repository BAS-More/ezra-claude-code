# EZRA v6 Phase 9 Build Spec: Holistic Planning Engine

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase9-planning
Phases 1-8 merged. PM + multi-agent orchestration both exist.

## Critical Rules
1. ZERO external npm dependencies.
2. ALL GREEN before commit.
3. 'use strict' in all new JS files.

## What to Build

### 1. hooks/ezra-planner.js (~500 lines)
Holistic planning engine — plans comprehensively upfront, delivers to agents in small verified chunks.

Exports: createPlan, loadPlan, decomposeTasks, assignTask, getTaskQueue, advanceTask, runGapCheck, createCheckpoint, getPlanStatus, PLAN_STAGES

7-stage pipeline (from spec):
1. Holistic Plan — PM analyses full scope, deps, risks -> .ezra/plans/master-plan.yaml
2. Task Decomposition — break into agent-sized tasks (max 1 file per task) -> .ezra/plans/task-queue.yaml
3. Assignment — assign each task to optimal agent via ezra-agents.js scoring
4. Execution — agent works single task, output captured
5. Verification — quality gate (tests, lint, health, standards check)
6. Gap Check — after every N tasks, compare against master plan
7. Checkpoint — save progress, update dashboard, generate handoff

createPlan: takes a spec/description, produces master-plan.yaml with features, ordering, dependencies, risk assessment
decomposeTasks: breaks master plan into individual file-level tasks with dependency mapping
assignTask: calls ezra-agents.js assignTask with task type
runGapCheck: compares completed tasks against master plan, returns drift report
createCheckpoint: saves current state as recovery point in .ezra/plans/checkpoints/

Storage:
.ezra/plans/
  master-plan.yaml
  task-queue.yaml
  checkpoints/
    checkpoint-<timestamp>.yaml
  gap-reports/
    gap-<timestamp>.yaml

### 2. commands/ezra/plan.md
/ezra:plan command with subcommands: create, status, tasks, assign, gap-check, checkpoint, history, describe

### 3. tests/test-v6-planner.js (~450+ lines)
Test all 7 stages, plan creation, task decomposition, gap checking, checkpoints, edge cases.

### 4. Settings: add planning section to DEFAULTS + getPlanning accessor
planning: { enabled: true, max_tasks_before_gap_check: 5, checkpoint_on_milestone: true, auto_assign: true }

### 5. Update counts in all reference files
