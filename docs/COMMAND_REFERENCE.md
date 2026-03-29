# EZRA Command Reference

All 39 slash commands available after installation.

## Setup & Onboarding

### `/ezra:init`
Initialize EZRA governance for a project.

- Scans codebase (language, framework, architecture, dependencies)
- Creates `.ezra/` directory structure
- Writes `governance.yaml` with protected path defaults
- Writes `knowledge.yaml` with discovered architecture
- **Idempotent:** safe to re-run

### `/ezra:bootstrap`
One-command project onboarding. Runs init + auto-configure + first ADR + health check + CLAUDE.md generation + version snapshot.

- Auto-detects language and framework from project files
- Applies sensible governance defaults (protected paths, coding standards)
- Creates ADR-001 documenting the governance initialization
- **Idempotent:** skips existing artifacts on re-run

### `/ezra:claude-md`
Generate or update `CLAUDE.md` from `.ezra/` state.

- Reads governance, knowledge, decisions, and version state
- Generates sections: Architecture, Active Decisions, Protected Paths, Standards, Tech Stack, Governance
- Uses `<!-- EZRA:START -->` / `<!-- EZRA:END -->` markers
- Preserves user content outside EZRA markers

---

## Analysis & Review

### `/ezra:scan`
Full multi-agent codebase analysis.

- Dispatches 4 agents in parallel: architect, reviewer, guardian, reconciler
- Produces health score (0-100) across 5 pillars
- Saves results to `.ezra/scans/{timestamp}.yaml`
- Run before major changes, after merges, or on a regular cadence

```
── EZRA Scan Results ──
Health Score: 82/100 (B)
  On-Track:       88/100  ████████░░
  No Gaps:        75/100  ███████░░░
  Clean:          90/100  █████████░
  Secure:         78/100  ███████░░░
  Best Practices: 85/100  ████████░░
Findings: 3 high, 7 medium, 12 low
Saved to .ezra/scans/2025-01-15T10-30-00.yaml
```

### `/ezra:review`
Multi-agent code review.

- Reviews staged changes, a specific file, or recent commits
- Dispatches architect (patterns, coupling) and reviewer (security, quality) agents
- Outputs findings with severity levels and confidence scores

```
── EZRA Review: src/auth/login.ts ──
⚠ HIGH  [Security] Missing rate limiting on login endpoint (confidence: 0.92)
⚠ MED   [Architecture] Direct DB query bypasses service layer (confidence: 0.85)
ℹ LOW   [Quality] Consider extracting token validation to shared util (confidence: 0.71)
3 findings — 1 high, 1 medium, 1 low
```

### `/ezra:guard`
Check changes against governance rules.

- Compares staged/recent changes to protected paths and active decisions
- Detects protected path violations, decision non-compliance, standard deviations
- Non-blocking by default (warns); configurable to block

```
── EZRA Guard ──
⚠ Protected path: config/db.yaml matches "config/**" (reason: protected config)
  Decision ADR-003 authorises config changes — allowing.
✔ src/utils/helpers.ts — no restrictions
✔ tests/auth.test.ts — no restrictions
```

### `/ezra:health`
5-pillar health assessment.

| Pillar | Weight | What It Checks |
|--------|--------|----------------|
| On-Track | 25% | Plan adherence, decision coverage |
| No Gaps | 20% | Document completeness, test coverage |
| Clean | 15% | Code quality, lint compliance |
| Secure | 25% | Vulnerability findings, auth patterns |
| Best Practices | 15% | Architecture patterns, dependency hygiene |

- Scores each pillar 0-100
- Weighted aggregate score with letter grade (A/B/C/D/F)
- Actionable remediation for every gap

```
── EZRA Health Assessment ──
Overall: 74/100 (C)
  On-Track       88  ████████░░
  No Gaps        60  ██████░░░░  ← Missing: API spec, test strategy
  Clean          82  ████████░░
  Secure         65  ██████░░░░  ← 3 high-severity findings
  Best Practices 78  ███████░░░
Remediation: Run /ezra:doc create api-spec, /ezra:scan --preset security-deep
```

### `/ezra:advisor`
Proactive best-practice advisor.

- Analyses project state and lifecycle stage
- Delivers targeted suggestions, innovations, and warnings
- Usage: `/ezra:advisor` (full), `/ezra:advisor security` (focused)

---

## Decisions

### `/ezra:decide`
Record an architectural decision (ADR).

- Auto-increments ID (ADR-001, ADR-002, ...)
- Captures: decision, context, rationale, consequences, enforcement paths
- Categories: ARCHITECTURE, DATABASE, SECURITY, API, TESTING, INFRASTRUCTURE, DEPENDENCY, CONVENTION
- Status lifecycle: ACTIVE → SUPERSEDED or DEPRECATED
- Decisions become governance rules that `/ezra:guard` enforces

```
── ADR-005 Recorded ──
ID:        ADR-005
Category:  SECURITY
Title:     Require JWT validation on all API routes
Status:    ACTIVE
Enforced:  /ezra:guard will flag unvalidated routes
Saved to:  .ezra/decisions/ADR-005.yaml
```

---

## Documentation

### `/ezra:doc`
Create, update, list, or reference SDLC documents.

- Supports 81 document types (business case, API spec, test strategy, runbook, etc.)
- Usage: `/ezra:doc create api-spec`, `/ezra:doc list`, `/ezra:doc status`
- Documents tracked in `.ezra/docs/registry.yaml`

### `/ezra:doc-check`
Document gap analysis.

- Determines project phase (inception, development, production, etc.)
- Shows which documents are missing, required, or stale
- Prioritises by criticality

### `/ezra:doc-sync`
Detect drift between codebase and existing documents.

- Compares code changes against registered document scopes
- Proposes updates for approval before applying
- Usage: `/ezra:doc-sync` (all), `/ezra:doc-sync api-spec` (one), `/ezra:doc-sync --auto`

### `/ezra:doc-approve`
Review and approve/reject pending document update proposals.

- Interactive review mode
- Usage: `/ezra:doc-approve` (all pending), `/ezra:doc-approve PROP-001` (specific)

---

## Status & Monitoring

### `/ezra:status`
Governance health dashboard.

- Shows: active decisions, violations, drift level, scan history, plan status
- Quick snapshot of governance state

```
── EZRA Status ──
Project:    my-app (v2.1.0)
Health:     82/100 (B)
Decisions:  12 active, 2 superseded
Drift:      Low (last scan 2h ago)
Plans:      1 active (68% complete)
Violations: 0 critical, 2 medium
```

### `/ezra:dash`
Real-time project dashboard.

- Shows: phase, health score, document coverage, decision count, risks, tests, deployment status, blockers
- More detailed than `/ezra:status`

```
── EZRA Dashboard ──
Phase:      Development     Health: 82/100 (B)
Docs:       14/18 (78%)     Decisions: 12 active
Risks:      1 high, 3 med   Tests: 342 pass, 0 fail
Deployment: staging ✔       Blockers: None
Next:       /ezra:doc-check to close 4 missing docs
```

---

## Process & Automation

### `/ezra:process`
Reusable workflow engine.

- Create custom step-by-step processes
- 12 step types: run-command, run-tests, scan, health, doc-check, doc-sync, guard, review, decide, reconcile, approval, report
- Guard rails: clean_git, passing_tests, health_score_min, no_env_files
- 5 built-in templates: full-remediation, release-prep, sprint-close, security-audit, onboarding
- Usage: `/ezra:process run release-prep`, `/ezra:process create my-workflow`

### `/ezra:auto`
Autonomous execution engine.

- Runs processes start-to-finish under continuous guard rail monitoring
- Dry-run mode for previewing without side effects
- Resume capability for interrupted processes
- Usage: `/ezra:auto release-prep`, `/ezra:auto release-prep --dry-run`

---

## Versioning & Reconciliation

### `/ezra:version`
Version control for all EZRA state.

- Tracks every change to decisions, documents, governance, knowledge, and plans
- Immutable append-only changelog with CHG-XXXX entries
- Named snapshots for checkpoints
- Usage: `/ezra:version` (current), `/ezra:version log`, `/ezra:version snapshot pre-release`, `/ezra:version diff v1 v2`

### `/ezra:reconcile`
Compare planned vs. actual implementation.

- Requires a plan registered in `.ezra/plans/`
- Identifies: completed items, gaps, drift, unplanned additions
- Calculates completion percentage

---

## Integration & Multi-Project

### `/ezra:sync`
Sync EZRA governance state with avios-context MCP server.

- Processes pending sync items (decisions and risks)
- Maps EZRA categories to avios-context categories (AD, DD, SC, TC)
- Requires `avios_integration.enabled: true` in governance.yaml
- Queues items for batch sync or immediate push

### `/ezra:multi`
Multi-project portfolio orchestration.

- Manage multiple EZRA-initialized projects from one location
- Usage: `/ezra:multi add <path>`, `/ezra:multi dash`, `/ezra:multi run security-audit --all`, `/ezra:multi health`
- Global config at `~/.ezra-portfolio.yaml`

### `/ezra:help`
Show all commands, agents, and current configuration.

- Lists all 39 commands with descriptions
- Shows 4 agents and their roles
- Displays `.ezra/` state directory structure
- Shows current project state if initialized

---

## Agents

### `/ezra:agents`
Multi-agent orchestration — manage AI coding agents, view performance, control budget, and configure task routing.

- List, add, and remove AI coding agents across 9 providers (claude, codex, cursor, copilot, gemini, grok, mistral, llama, deepseek)
- View agent performance metrics (success rate, avg cost, avg duration, quality-adjusted cost)
- Agent leaderboard ranked by quality-adjusted cost
- Budget tracking (daily/monthly spend vs ceiling, overspend warnings)
- Task routing with 5 strategies: auto, manual, round-robin, cost-optimised, quality-optimised
- Usage: `/ezra:agents`, `/ezra:agents add <name>`, `/ezra:agents performance`, `/ezra:agents leaderboard`, `/ezra:agents budget`, `/ezra:agents assign <task>`

```
── EZRA Agents ──
Roster (3 providers configured):
  claude    ✔ ready   tasks: 42  avg cost: $0.03  quality: 94%
  gemini    ✔ ready   tasks: 18  avg cost: $0.01  quality: 88%
  copilot   ○ offline tasks: 5   avg cost: $0.00  quality: 82%
Strategy: auto | Budget: $2.40/$5.00 today
```

---

## Real-Time Oversight

### `/ezra:oversight`
View and configure real-time agent oversight.

- Show oversight status (enabled, intervention level, health threshold, auto-pause, excluded paths)
- Change intervention level: monitor, warn, gate, strict
- View violation history filtered by severity (CRITICAL/HIGH/MEDIUM/LOW)
- Show aggregate statistics: totals by code and severity, most flagged files, trend analysis
- Clear violations log
- Usage: `/ezra:oversight`, `/ezra:oversight level strict`, `/ezra:oversight violations high`, `/ezra:oversight stats`

```
── EZRA Oversight ──
Status:       Enabled
Level:        warn (monitor < warn < gate < strict)
Health floor: 60/100
Auto-pause:   Off
Violations:   0 critical, 2 high, 5 medium (last 7d)
Top file:     src/auth/session.ts (3 violations)
```

### `/ezra:settings`
Unified settings management for `.ezra/settings.yaml`.

- View all settings or a specific section (standards, security, oversight, best_practices, workflows)
- Set individual settings via dot notation (e.g., `oversight.level strict`)
- Add/remove custom rules for standards or security sections
- Reset settings to defaults (per-section or all); diff current vs defaults
- Export settings as YAML
- Usage: `/ezra:settings`, `/ezra:settings set oversight.level strict`, `/ezra:settings diff`, `/ezra:settings reset`
- Hook control: `/ezra:settings hooks`, `/ezra:settings hooks --disable`, `/ezra:settings hooks --enable`
- User preferences: `.ezra/preferences.yaml` for personal defaults (lower priority than settings.yaml)

### `/ezra:compliance`
Compliance profiles — ISO 25010, OWASP, SOC2, HIPAA, PCI-DSS, GDPR, WCAG.

- List 7 built-in compliance profiles with activation status and rule counts
- Activate/deactivate profiles — merges/removes predefined rules into EZRA settings
- Run compliance check against active profiles (PASS/FAIL per rule)
- Generate comprehensive compliance report with gaps and remediation steps
- Usage: `/ezra:compliance`, `/ezra:compliance activate owasp-2025`, `/ezra:compliance check`, `/ezra:compliance report`

```
── EZRA Compliance ──
Active profiles: OWASP 2025, SOC2
OWASP 2025:  18/21 rules PASS, 3 FAIL
  ✘ A01 Broken Access Control — missing RBAC on /admin routes
  ✘ A03 Injection — raw SQL in src/db/query.ts
  ✘ A07 Auth Failures — no brute-force protection
SOC2:        12/12 rules PASS
```

---

## Intelligence & Learning

### `/ezra:learn`
Self-learning intelligence and recommendations.

- Summary of collected data points, analysis date, pending recommendations
- Review pending recommendations interactively (accept/reject/modify) with confidence scores
- Agent performance profiles (task count, acceptance rate, revision rate, best task types)
- Violation pattern analysis (top 10 types, highest-density files, predictive warnings)
- Health trajectory analysis (score trend, correlated actions)
- Cost analysis (spend by agent, quality-adjusted cost, budget utilisation)
- Usage: `/ezra:learn`, `/ezra:learn review`, `/ezra:learn agents`, `/ezra:learn violations`, `/ezra:learn costs`

### `/ezra:library`
Best practice library — browse, search, and manage entries across 14 categories.

- Browse entries by category with severity indicators ([!] required, [R] recommended, [A] advisory, [i] info)
- Search across all categories by keyword with relevance scoring
- Add custom best practice entries interactively (title, description, category, severity, tags)
- Show context-relevant best practices for current file/project
- Statistics with coverage gap highlighting; export as YAML; initialize with seed data
- Usage: `/ezra:library`, `/ezra:library browse <category>`, `/ezra:library search <query>`, `/ezra:library add`, `/ezra:library stats`

### `/ezra:research`
Research agent control — automated best practice discovery. Requires Pro tier.

- Show research agent status (last run, next scheduled, budget used)
- Trigger manual research run
- View and configure research agent settings (frequency, budget, sources, categories)
- Manage whitelisted sources (list, add URLs)
- View research run history and budget tracking
- Usage: `/ezra:research`, `/ezra:research run`, `/ezra:research config`, `/ezra:research sources`, `/ezra:research budget`

---

## Project Management

### `/ezra:pm`
Project Manager — milestones, tasks, reports, and escalation.

- Project status summary (health score, progress %, task breakdown, milestones, stall detection)
- Task queue management (list, add, mark done) grouped by status (Active/Pending/Blocked/Done)
- Milestone tracking with criteria evaluation (health_score, all_p1_tasks_done, test_coverage, zero_critical_gaps)
- Daily and weekly report generation (saved to `.ezra/progress/reports/`)
- Escalation log viewing and manual stall detection
- Usage: `/ezra:pm`, `/ezra:pm tasks`, `/ezra:pm tasks add <desc>`, `/ezra:pm tasks done <id>`, `/ezra:pm milestones`, `/ezra:pm report`

### `/ezra:progress`
Quick progress dashboard — completion %, active tasks, health trend, next milestone.

- Compact single-view dashboard: project name, phase, completion %, task counts
- Health score with trend (improving/declining/stable) from scan history
- Next pending milestone with criteria progress
- Stall detection warning and quick action tips
- Usage: `/ezra:progress`

### `/ezra:cost`
Cost tracking and budget management for AI agent usage.

- Cost summary: today's spend vs daily ceiling, weekly/monthly spend vs monthly ceiling
- Breakdown by agent (tasks, total cost, avg cost/task, % of budget)
- Budget ceiling configuration (daily/monthly); cost forecasting (burn rate, projected monthly, days until exhausted)
- Daily cost history for current month
- Budget enforcement: blocks new tasks on overspend, suggests cost-optimised strategy
- Usage: `/ezra:cost`, `/ezra:cost breakdown`, `/ezra:cost budget`, `/ezra:cost forecast`, `/ezra:cost history`

---

## Planning & Memory

### `/ezra:plan`
Holistic planning engine — comprehensive upfront planning with verified task delivery.

- Create master plans from specifications (name, features, risk assessment, dependencies)
- 7-stage pipeline: Holistic Plan → Task Decomposition → Assignment → Execution → Verification → Gap Check → Checkpoint
- Task listing with status, assignees, and dependencies; assign tasks to agents
- Gap-check: compare completed work against master plan (drift, blocked tasks, completion %)
- Checkpoint system for recovery; history of checkpoints and gap reports
- Usage: `/ezra:plan create`, `/ezra:plan status`, `/ezra:plan tasks`, `/ezra:plan assign 0 code-agent`, `/ezra:plan gap-check`, `/ezra:plan checkpoint "Phase 1"`

### `/ezra:memory`
Agent memory system — persistent knowledge across coding sessions.

- 7 memory types: pattern, anti-pattern, lesson, decision-context, preference, fact, warning
- Add, list, search, and delete memory entries
- Context-relevance matching for current file/project
- Auto-capture from tool outputs via trigger phrases ("always use", "lesson learned", etc.)
- Export/import for backup or cross-project sharing
- Usage: `/ezra:memory`, `/ezra:memory add <type> <content>`, `/ezra:memory search <query>`, `/ezra:memory relevant <context>`

### `/ezra:handoff`
Generate session handoff briefing document.

- Compile structured handoff brief from project state (health score, version, architecture)
- Include last 10 active decisions, 20 changelog entries, and 10 recent git commits
- Highlight open items (missing documents, drift counter)
- Save briefings to `.ezra/handoffs/`; list saved briefs
- Usage: `/ezra:handoff`, `/ezra:handoff save`, `/ezra:handoff list`

---

## Admin & Infrastructure

### `/ezra:license`
License management — status, activate, deactivate, features.

- Show current license tier, validity, and available features
- Activate license keys (Pro/Team/Enterprise)
- Deactivate license and revert to Core tier
- List all features with required tier and current availability
- 4 tiers: Core (free), Pro ($29/user/mo), Team ($59/user/mo), Enterprise (custom)
- Usage: `/ezra:license status`, `/ezra:license activate <key>`, `/ezra:license features`, `/ezra:license upgrade`

### `/ezra:install`
Install, uninstall, or update EZRA.

- Install EZRA hooks and commands globally to `~/.claude/`
- Creates `.ezra/` directory in current project if not exists
- Uninstall removes hooks/commands but preserves `.ezra/` project data
- Update: removes old files and reinstalls from source
- Status check: lists installed and missing hook files
- Usage: `/ezra:install`, `/ezra:install uninstall`, `/ezra:install update`, `/ezra:install status`

**Uninstall:**
```
npx ezra-claude-code --uninstall --global   Remove global install (~/.claude/)
npx ezra-claude-code --uninstall --local    Remove local install (.claude/)
/ezra:install uninstall                     Interactive uninstall
```
Note: Uninstall preserves `.ezra/` project data — only hooks and commands are removed.

### `/ezra:portfolio`
Cross-project portfolio health dashboard.

- Unified health dashboard reading `.ezra/` state from multiple project directories
- Add/remove projects to portfolio by name and path
- Per-project data: health score, version, active decisions, drift level, last scan date
- Warnings for uninitialized projects or exceeded drift thresholds; export as YAML
- Usage: `/ezra:portfolio`, `/ezra:portfolio add <name> <path>`, `/ezra:portfolio remove <name>`, `/ezra:portfolio export`

### `/ezra:workflow`
Enhanced workflow template system with validation, composition, and execution tracking.

- List, show, validate, and delete workflow templates
- 6 step types: ezra, shell, manual, conditional, parallel, checkpoint
- Validate templates (required fields, unique IDs, dependency resolution, on_failure handlers)
- Compose multiple templates into a single workflow; run workflows with execution tracking
- Execution history and aggregate statistics (run count, success rate, most used templates)
- Usage: `/ezra:workflow list`, `/ezra:workflow run <name>`, `/ezra:workflow compose <t1> <t2>`, `/ezra:workflow validate <name>`

---

## Quick Lookup

| If you want to... | Run |
|---|---|
| Set up a new project | `/ezra:bootstrap` or `/ezra:init` |
| Review code for security | `/ezra:review` or `/ezra:scan --preset security-deep` |
| Track a decision | `/ezra:decide` |
| Check governance health | `/ezra:health` or `/ezra:status` |
| Manage compliance | `/ezra:compliance` |
| Generate documentation | `/ezra:doc create <type>` |
| Verify plan completion | `/ezra:reconcile` |
| Run a workflow | `/ezra:process run <name>` or `/ezra:workflow run <name>` |
| Check budget/costs | `/ezra:cost` or `/ezra:cost forecast` |
| Manage project tasks | `/ezra:pm tasks` |
| Track progress | `/ezra:progress` or `/ezra:pm milestones` |
| Create a plan | `/ezra:plan create` |
| Store a lesson learned | `/ezra:memory add lesson <text>` |
| Browse best practices | `/ezra:library` or `/ezra:library search <query>` |
| Configure settings | `/ezra:settings` or `/ezra:settings set <key> <value>` |
| Manage AI agents | `/ezra:agents` or `/ezra:agents recommend <task>` |
| View oversight violations | `/ezra:oversight violations` |
| Prepare a handoff | `/ezra:handoff save` |
| Check license/tier | `/ezra:license status` |
| Install/update EZRA | `/ezra:install` or `/ezra:install update` |
| Multi-project dashboard | `/ezra:portfolio` or `/ezra:multi dash` |
| Get help | `/ezra:help` |
