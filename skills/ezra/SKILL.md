---
name: ezra
description: "EZRA — Automated Epistemic Governance & Intelligence System. A multi-agent codebase governance framework that enforces architectural decisions, detects drift, reviews code quality and security, and reconciles plans against implementation. Use when the user asks about architecture, governance, decisions, code review, or plan tracking. Trigger on: /ezra, architecture review, decision record, governance check, plan reconciliation, codebase analysis, drift detection, protected paths."
---

# EZRA — Automated Epistemic Governance & Intelligence System

EZRA is a codebase shield. It provides multi-agent, multi-phase analysis with no manual orchestration.

## What EZRA Does

1. **Knows your codebase** — Maintains an epistemic state (`.ezra/knowledge.yaml`) documenting architecture, patterns, layers, and dependencies
2. **Enforces decisions** — Tracks Architectural Decision Records in `.ezra/decisions/` and verifies code compliance
3. **Guards integrity** — Protects critical paths from unintended changes, checks standards compliance
4. **Reviews deeply** — Dispatches parallel agents for architecture, security, and quality analysis
5. **Reconciles plans** — Compares what was planned against what was built, identifies gaps and drift

## State Directory

EZRA persists state in `.ezra/` at the project root:

```
.ezra/
├── decisions/          # Architectural Decision Records (YAML)
├── scans/              # Timestamped scan results
├── plans/              # Registered plans for reconciliation
├── governance.yaml     # Rules, protected paths, enforcement config
└── knowledge.yaml      # What EZRA knows about the codebase
```

## Commands

- `/ezra:init` — Initialize EZRA, scan codebase, create state directory
- `/ezra:scan` — Full multi-agent analysis (architecture + security + quality + governance)
- `/ezra:guard` — Check staged/recent changes against rules
- `/ezra:reconcile` — Compare plan vs implementation
- `/ezra:decide <decision>` — Record an architectural decision
- `/ezra:review` — Multi-agent code review
- `/ezra:status` — Governance health dashboard
- `/ezra:help` — Show all commands
- `/ezra:doc` — Generate, manage, and track SDLC documentation (55 document types)
- `/ezra:dash` — Real-time governance dashboard with metrics across all pillars
- `/ezra:doc-check` — Verify documentation completeness and currency against project lifecycle
- `/ezra:doc-sync` — Synchronize documentation with current codebase state
- `/ezra:doc-approve` — Document review and approval workflow with sign-off tracking
- `/ezra:version` — Version control for all EZRA state with immutable changelog
- `/ezra:health` — 5-pillar health assessment (architecture, security, quality, documentation, governance)
- `/ezra:advisor` — Lifecycle-aware guidance, best practices, and forward-looking recommendations
- `/ezra:process` — Create, run, edit, and save reusable step-by-step workflows
- `/ezra:auto` — Autonomous process execution with guard rails and approval gates
- `/ezra:multi` — Multi-project portfolio orchestration across multiple codebases

## Agents

EZRA dispatches these subagents (defined in `.claude/agents/`):

- `ezra-architect` — Architecture analysis, layer mapping, dependency tracing, pattern detection
- `ezra-reviewer` — OWASP-aligned security review + code quality analysis with confidence scores
- `ezra-guardian` — Decision enforcement, protected path integrity, standards compliance
- `ezra-reconciler` — Plan vs implementation comparison, gap detection, constraint verification

## Workflow

```
/ezra:init → /ezra:decide → /ezra:scan → ... work ... → /ezra:guard → /ezra:review → /ezra:reconcile
```

## Integration with Hooks

EZRA can be integrated with Claude Code hooks for automatic enforcement:

- **PreToolUse** hook on Write/Edit: Automatically runs guard check on file changes
- **Stop** hook: Logs session activity for reconciliation tracking
- **PostToolUse** hook: Validates changes against governance after each edit

See `.claude/hooks/ezra-guard.js` for the hook implementation.

## Decision Record Format

Each decision in `.ezra/decisions/ADR-NNN.yaml`:

```yaml
id: ADR-NNN
status: ACTIVE | SUPERSEDED | DEPRECATED
date: <ISO>
category: ARCHITECTURE | DATABASE | SECURITY | API | TESTING | INFRASTRUCTURE | DEPENDENCY | CONVENTION
decision: <one clear sentence>
context: <why>
rationale: <why this choice>
consequences:
  positive: [...]
  negative: [...]
enforcement:
  affected_paths: [<glob patterns>]
  check_description: <what compliance looks like>
  auto_enforced: <true|false>
```
