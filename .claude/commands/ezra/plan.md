---
name: "ezra:plan"
description: "Holistic Planning Engine — comprehensive upfront planning with verified task delivery"
---

# /ezra:plan

Holistic planning engine for EZRA-governed projects.

## Subcommands

### create
Create a new master plan from a specification.
- Input: plan name, description, feature list, risk assessment
- Output: master-plan.yaml with ordering, dependencies, risk levels
- Stage: holistic_plan → task decomposition ready

### status
Show current plan status: stage, feature completion, task progress.

### tasks
List all tasks in the queue with status, assignees, dependencies.

### assign <taskIndex> [agentId]
Assign a pending task to an agent. Uses ezra-agents scoring if no agent specified.

### gap-check
Compare completed work against master plan. Reports drift, blocked tasks, completion %.

### checkpoint [label]
Create a recovery checkpoint saving current plan + task state.

### history
List all checkpoints and gap reports with timestamps.

### describe
Generate a human-readable description of the current plan.

### generate
Generate a master plan automatically from the project definition.
- Reads `.ezra/project-definition.yaml` (run `/ezra:interview` first if missing)
- Uses heuristic decomposer to break project into tasks and phases
- Writes `master-plan.yaml`, `tasks.yaml`, `phases.yaml` to `.ezra/plans/`
- Adds gate tasks at the end of each phase automatically
- Status: `draft` — editable until locked

### review
Display the generated plan in a readable format. Shows phases, tasks, complexity, gate tasks, and acceptance criteria.

### lock
Lock the plan to prevent further edits. Required before `/ezra:auto plan-driven` can execute it.
Sets plan status to `locked`.

### unlock [reason]
Unlock a locked plan for editing. Records the reason.

### phases
List all phases with task counts, complexity breakdown, and gate task status.

## Usage

\`\`\`
/ezra:plan create — start a new master plan (manual spec)
/ezra:plan generate — auto-generate plan from project-definition.yaml
/ezra:plan review — display plan in readable format
/ezra:plan lock — lock plan before execution
/ezra:plan unlock "Need to add feature X" — unlock for editing
/ezra:plan phases — list phases with complexity scores
/ezra:plan status — view current plan progress
/ezra:plan tasks — list all tasks
/ezra:plan assign 0 code-agent — assign task 0
/ezra:plan gap-check — check for drift
/ezra:plan checkpoint "Phase 1 complete" — save progress
/ezra:plan history — view checkpoints and gap reports
/ezra:plan describe — human-readable plan summary
\`\`\`

## 7-Stage Pipeline

1. **Holistic Plan** — PM analyses full scope, deps, risks
2. **Task Decomposition** — break into agent-sized tasks (max 1 file per task)
3. **Assignment** — assign each task to optimal agent
4. **Execution** — agent works single task, output captured
5. **Verification** — quality gate (tests, lint, health)
6. **Gap Check** — compare against master plan
7. **Checkpoint** — save progress, update dashboard

## Suggested Next Steps

After creating or updating a plan, suggest:
- Run `/ezra:reconcile` to compare plan vs implementation
- Run `/ezra:pm tasks` to manage task queue
- Run `/ezra:plan gap-check` after completing work to verify coverage
