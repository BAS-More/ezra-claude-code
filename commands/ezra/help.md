---
name: ezra:help
description: Show all EZRA commands, agents, and current configuration.
---

Display the following help text:

```
EZRA (עזרא) — The Scribe Who Restores and Enforces Standards
═══════════════════════════════════════════════════════════════
Enforce. Zero-drift. Restore. Audit.

COMMANDS
  /ezra:init          Initialize EZRA for this project
  /ezra:scan          Full multi-agent codebase analysis
  /ezra:guard         Check changes against governance rules
  /ezra:reconcile     Compare plan vs implementation
  /ezra:decide        Record an architectural decision
  /ezra:review        Multi-agent code review
  /ezra:status        Governance health dashboard
  /ezra:doc           Generate and manage SDLC documentation
  /ezra:dash          Real-time governance dashboard
  /ezra:doc-check     Verify documentation completeness
  /ezra:doc-sync      Synchronize docs with codebase state
  /ezra:doc-approve   Document review and approval workflow
  /ezra:version       Version control for EZRA state
  /ezra:health        5-pillar health assessment
  /ezra:advisor       Lifecycle-aware guidance and recommendations
  /ezra:process       Create and run reusable workflows
  /ezra:auto          Autonomous execution with guard rails
  /ezra:multi         Multi-project portfolio orchestration
  /ezra:sync          Sync governance state with avios-context
  /ezra:claude-md     Generate CLAUDE.md from EZRA state
  /ezra:bootstrap     One-command project onboarding
  /ezra:help          This help text

AGENTS (dispatched automatically by commands)
  ezra-architect    Architecture analysis, layer mapping, dependency tracing
  ezra-reviewer     Security + quality review with severity scoring
  ezra-guardian     Decision enforcement, protected path integrity
  ezra-reconciler   Plan vs implementation comparison

STATE DIRECTORY: .ezra/
  decisions/         Architectural Decision Records (YAML)
  scans/             Timestamped scan results
  plans/             Registered plans for reconciliation
  governance.yaml    Rules, protected paths, enforcement config
  knowledge.yaml     Epistemic state — what EZRA knows

TYPICAL WORKFLOW
  1. /ezra:init              → Set up governance
  2. /ezra:decide <decision> → Record key decisions
  3. /ezra:scan              → Baseline analysis
  4. ... do work ...
  5. /ezra:guard             → Check before committing
  6. /ezra:review            → Deep review before PR
  7. /ezra:reconcile         → Verify plan completion
  8. /ezra:status            → Ongoing health check

PHILOSOPHY
  Ezra didn't suggest. He governed.
  EZRA handles multi-phase analysis, decision tracking,
  document lifecycle, and integrity enforcement.
  You focus on building.
```

Then check if `.ezra/` exists and append current state:

If initialized:
```
CURRENT PROJECT: <name>
Decisions: <count> active | Scans: <count> total | Plans: <count> active
Last scan: <date> | Health: <score>/100
```

If not initialized:
```
STATUS: Not initialized. Run /ezra:init to begin.
```
