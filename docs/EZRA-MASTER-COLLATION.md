# EZRA — Master Collation Document
# Origin, Planning History, Workflows, Functionality & Outcomes

**Generated:** 2026-03-29
**Sources:** All planning chats, build specs, ADRs, gap analyses, readiness reports, validation reports
**Purpose:** Single authoritative reference collating everything planned, built, adjusted, and remaining

---

## 1. ORIGIN & VISION

EZRA (עזרא — "The Scribe Who Restores and Enforces Standards") started as a codebase governance framework for Claude Code.

**The founding problem:** Claude Code sessions are stateless. Each session loses context about decisions made, standards agreed, patterns enforced, and risks identified. Teams were re-litigating the same architectural debates session after session. Code drifted from its own governance documents. No enforcement.

**The solution:** A persistent, per-project governance layer that:
- Records architectural decisions (ADRs) as enforceable rules
- Scans code against those rules automatically
- Hooks into Claude Code's lifecycle to catch violations before they land
- Keeps documentation in sync with code
- Hands off context reliably across sessions

**Core identity constraints (never negotiable):**
- **Zero external dependencies** — pure Node.js built-ins only. No npm install needed.
- **Cross-platform** — Windows, macOS, Linux via `path.join()`, `os.homedir()`, `process.platform`
- **Hook protocol** — all hooks read JSON from stdin, write JSON to stdout, always exit 0
- **Identity** — EZRA (עזרא), never AEGIS (prior codename, fully purged)
- **Test pattern** — built-in `assert` only, `function test(name, fn)` pattern

---

## 2. VERSION HISTORY

### v4.0.0 (Starting point for v5 spec)
```
commands/ezra/    — 19 commands
hooks/            — 4 hooks (guard, dash-hook, drift-hook, version-hook)
agents/           — 4 agents (architect, reviewer, guardian, reconciler)
templates/        — 5 YAML templates
skills/ezra/      — SKILL.md
bin/cli.js        — cross-platform installer
tests/            — 9 test files, 273 tests passing
```

### v5.0.0 — 12-Feature Enhancement Build
**Spec date:** 2026-03-19 | **Status:** Completed (8/12 complete, 1 partial, 3 missing)

| Feature | Priority | Status | Notes |
|---------|----------|--------|-------|
| F1: AVI-OS Integration Bridge | CRITICAL | ✅ COMPLETE | hooks/ezra-avios-bridge.js + commands/ezra/sync.md |
| F2: CLAUDE.md Auto-Generator | CRITICAL | ✅ COMPLETE | commands/ezra/claude-md.md |
| F3: Bootstrap Command | CRITICAL | ✅ COMPLETE | commands/ezra/bootstrap.md |
| F4: Git Hook Integration | HIGH | ❌ MISSING | pre-commit/pre-push hooks never built |
| F5: Decision Dependency Graph | HIGH | ❌ MISSING | Mermaid visualization not built |
| F6: Drift Alert Escalation | HIGH | ✅ COMPLETE | hooks/ezra-drift-hook.js enhanced |
| F7: Cross-Project Portfolio | MEDIUM | ✅ COMPLETE | commands/ezra/portfolio.md |
| F8: Session Handoff Export | MEDIUM | ✅ COMPLETE | commands/ezra/handoff.md |
| F9: Compliance Evidence Pack | MEDIUM | ✅ COMPLETE | commands/ezra/compliance.md |
| F10: VS Code Status Bar | LOW | ✅ DELIVERED | Full VS Code extension built |
| F11: NPM Publishing Pipeline | LOW | ⚠️ PARTIAL | publishConfig present, no publish.yml CI |
| F12: Custom Rule Engine | LOW | ❌ MISSING | rules.md command + hook not built |

### v6.0.0 → v6.1.0 — 10-Phase Major Expansion
Built via Phases 1-10. All phases merged. 1,370 tests, all green.

---

## 3. V6 BUILD — PHASE BY PHASE

### Phase 1: Oversight Engine
**What:** Real-time PreToolUse hook that checks every file edit against governance rules BEFORE writing.
**ADR:** ADR-005 — 4-level intervention (monitor → warn → gate → strict), default = gate
**Outcome:**
- `hooks/ezra-oversight.js` — catches violations before code lands
- `commands/ezra/oversight.md` — view/configure oversight status
- 68 tests

**Key design:** Non-blocking at monitor/warn. Blocks only critical/high at gate. All levels at strict.

### Phase 2: Project Manager
**What:** Milestone tracking, daily/weekly reports, project state management.
**Outcome:**
- `hooks/ezra-pm.js` — PM engine with milestone tracking, sprint items, cost tracking
- `commands/ezra/pm.md` — /ezra:pm subcommands (status, milestone, cost, report)
- `commands/ezra/progress.md` — /ezra:progress for granular task progress
- 92 tests

### Phase 3: Settings System with Write-back
**What:** Persistent, merge-layered settings with in-hook write-back capability.
**Outcome:**
- `hooks/ezra-settings.js` — settings reader with 3-layer merge (hardcoded → global → project)
- `hooks/ezra-settings-writer.js` — write settings back to .ezra/settings.yaml
- `commands/ezra/settings.md` — /ezra:settings view/set/reset
- 111 + 22 tests (writer + roundtrip)

**Settings sections:** oversight, security, standards, memory, self_learning, agents, dashboard, planning, cloud_sync, project_manager, best_practices, licensing

### Phase 4: Best Practice Library
**What:** Local knowledge base with 14 categories, per-project seed data, search, and relevance matching.
**Outcome:**
- `hooks/ezra-library.js` — library engine (init, get, add, remove, search, getRelevant, export)
- `commands/ezra/library.md` — /ezra:library subcommands
- `commands/ezra/learn.md` — /ezra:learn to feed patterns into library
- 14 categories: code-quality, security, testing, architecture, devops, ui-ux, performance, documentation, process-qc, iso-standards, compliance, ai-agent, database, api-design
- Entry schema: `{ id, title, description, category, subcategory, source_url, date_added, date_verified, relevance_score, applicable_to[], tags[], severity }`
- 45 tests

### Phase 5: Multi-Agent Orchestration
**What:** 100-role agent registry with task routing, budget controls, performance tracking.
**ADR:** ADR-006 — registry pattern, 3-layer settings merge, daily/monthly budget limits
**Outcome:**
- `hooks/ezra-agents.js` — orchestration engine (SUPPORTED_PROVIDERS, assignTask, recordTaskResult, getAgentLeaderboard, checkBudget)
- `commands/ezra/agents.md` — /ezra:agents list/assign/performance/budget/roster
- `agents/registry.yaml` — 100 roles across 10 domains
- Assignment scoring: skill match 35%, cost efficiency 25%, speed 15%, quality 15%, availability 10%
- Performance storage: `.ezra/agents/performance/*.yaml`
- 39 + 47 tests (agents + agents-real)

**9 supported providers:** Anthropic, OpenAI, Codex, Ollama, local, mock (+ 3 future)

### Phase 6: Dashboard Data + Cloud Sync Foundation
**What:** Data aggregation layer for the web dashboard; sync queue preparation for Supabase.
**Outcome:**
- `hooks/ezra-dashboard-data.js` — getDashboardData, getWidgetData, exportDashboardJSON
- `hooks/ezra-cloud-sync.js` — loadSyncConfig, prepareSyncPayload, writeSyncQueue, getSyncStatus
- `commands/ezra/sync.md` (updated) — sync push/pull/status subcommands
- Dashboard export to `.ezra/dashboard-export.json`
- Cloud sync queue at `.ezra/sync/queue/`
- 37 + 12 tests (cloud-sync + dash-hook)

### Phase 7: Workflow Templates System
**What:** Multi-step governance workflow engine with 10 built-in templates, custom template support.
**Outcome:**
- `hooks/ezra-workflows.js` — loadTemplate, listTemplates, executeStep, runWorkflow, importTemplate, createCustomTemplate, validateTemplate, getWorkflowHistory
- `commands/ezra/workflow.md` — /ezra:workflow run/status/list/import/create
- `commands/ezra/process.md` (updated)
- 47 tests

**10 built-in templates:**
| Template | Steps | Purpose |
|----------|-------|---------|
| full-remediation | 8 | Deep codebase remediation |
| release-prep | 6 | Pre-release governance check |
| sprint-close | 5 | Sprint end housekeeping |
| security-audit | 7 | OWASP-aligned security pass |
| onboarding | 4 | New project bootstrap |
| pre-deployment-testing | 30+ | Full pre-deploy protocol |
| post-deployment-testing | 25+ | Verify deployment health |
| deep-gap-analysis | 11 | Weekly gap identification |
| anti-drift-enforcement | 4 | Per-commit drift check |
| github-azure-alignment | 6 | Pre-PR alignment check |

**Step action types:** scan, check, generate, gate, notify, custom

### Phase 8: Agent Memory System
**What:** Persistent 5-layer memory for agents — key facts, briefings, session handoffs, knowledge graph, red lines.
**Outcome:**
- `hooks/ezra-memory.js` — 5 layers (Key Facts, Briefing, Session Handoff, Knowledge Graph, Red Lines)
- `hooks/ezra-memory-hook.js` — PostToolUse hook enforcing red lines + regenerating briefings
- `commands/ezra/memory.md` — /ezra:memory facts/briefing/sessions/red-lines/knowledge/export/init
- Auto-generates `.ezra/memory/briefing.md` from last 10 decisions + last 5 handoffs + key facts
- Red lines = forbidden actions checked before every write
- 36 tests

### Phase 9: Holistic Planning Engine
**What:** 7-stage planning pipeline — upfront full scope planning, breaking into atomic tasks, assigning to agents, executing with gap checks.
**Outcome:**
- `hooks/ezra-planner.js` — createPlan, decomposeTasks, assignTask, getTaskQueue, advanceTask, runGapCheck, createCheckpoint, getPlanStatus
- `commands/ezra/plan.md` — /ezra:plan create/status/tasks/assign/gap-check/checkpoint/history/describe
- Storage: `.ezra/plans/master-plan.yaml`, `task-queue.yaml`, `checkpoints/`, `gap-reports/`
- 60 tests

**7-stage pipeline:**
1. Holistic Plan — full scope, dependencies, risks
2. Task Decomposition — agent-sized tasks (max 1 file per task)
3. Assignment — optimal agent per task type
4. Execution — agent works single task
5. Verification — quality gate (tests, lint, health, standards)
6. Gap Check — every N tasks, compare against master plan
7. Checkpoint — save state, update dashboard, generate handoff

### Phase 10: Licensing + Distribution
**What:** Tier system (Core/Pro/Team/Enterprise), license validation, tier gate enforcement.
**Outcome:**
- `hooks/ezra-license.js` — LICENSE_TIERS, checkLicense, validateKey, getLicenseStatus, isFeatureAvailable, FEATURE_TIER_MAP
- `hooks/ezra-tier-gate.js` — PreToolUse hook blocking Pro/Team features when unlicensed
- `commands/ezra/license.md` — /ezra:license status/activate/deactivate/features
- Cache-based validation (30-day cache, Supabase validates via ezra-cloud repo)
- 53 tests

**Tier feature map (key items):**
| Feature | Tier |
|---------|------|
| Core governance, decisions, scan, guard | Core (free) |
| Dashboard | Pro |
| Multi-agent orchestration | Pro |
| Research agent | Pro |
| Cloud sync | Pro |
| Planning engine | Pro |
| Memory system | Pro |
| Compliance profiles | Pro |
| Self-learning | Pro |
| Project manager | Team |
| Cross-project learning | Team |
| Custom workflow import | Pro |

---

## 4. CURRENT SYSTEM — COMPLETE INVENTORY

### Core Repo (`C:\Dev\Ezra`) — v6.1.0

**39 Commands:**
```
Setup:       init, bootstrap, claude-md, install
Analysis:    scan, review, guard, health, advisor
Decisions:   decide
Docs:        doc, doc-check, doc-sync, doc-approve
Monitoring:  status, dash
Automation:  process, auto, workflow, plan
Versioning:  version, reconcile
Integration: sync, multi, agents, portfolio, handoff
Governance:  settings, oversight, pm, progress, compliance, research, cost
Knowledge:   library, learn, memory
Licensing:   license
Help:        help
```

**24 Hooks:**
```
Session start:   ezra-dash-hook
PreToolUse:      ezra-guard, ezra-tier-gate, ezra-oversight
PostToolUse:     ezra-drift-hook, ezra-version-hook, ezra-avios-bridge, ezra-memory-hook, ezra-progress-hook
Engines:         ezra-agents, ezra-cloud-sync, ezra-dashboard-data, ezra-error-codes,
                 ezra-http, ezra-installer, ezra-library, ezra-license, ezra-memory,
                 ezra-oversight, ezra-planner, ezra-pm, ezra-settings, ezra-settings-writer,
                 ezra-tier-gate, ezra-version-hook, ezra-workflows, ezra-hook-logger
```

**4 Core Agents:**
- `ezra-architect` — architecture analysis, layer mapping, dependency tracing
- `ezra-reviewer` — OWASP-aligned security + code quality review
- `ezra-guardian` — governance compliance, protected path enforcement
- `ezra-reconciler` — plan vs. implementation gap analysis

**100-Role Registry** (`agents/registry.yaml`) across 10 domains:
Architecture, Security, Quality, Testing, Documentation, Performance, Accessibility, API Design, Error Handling, DevOps

**8 Templates:**
```
full-remediation.yaml, release-prep.yaml, sprint-close.yaml, security-audit.yaml,
onboarding.yaml, examples/governance.yaml, examples/settings.yaml, examples/knowledge.yaml
```

**35 Test Suites — 1,370 tests, all green**

**6 ADRs enforced:**
- ADR-001: Zero external dependencies
- ADR-002: Hook protocol (stdin JSON, always exit 0)
- ADR-003: EZRA identity (no aegis)
- ADR-004: Cross-platform compatibility
- ADR-005: 4-level oversight engine
- ADR-006: Multi-agent orchestration with budget controls

### Dashboard (`C:\Dev\ezra-dashboard`) — v6.1.0
**Tech:** Next.js 16, React 19, Supabase, Tailwind, Vercel
**Live at:** https://ezradev.com

| Page | Route | Status |
|------|-------|--------|
| Landing | / | ✅ Live |
| Login | /login | ✅ Live (email + GitHub + Google + Microsoft) |
| Dashboard | /dashboard | ✅ Live (11 widgets, drag-and-drop reorder) |
| Projects | /projects | ✅ Live (cards → project dashboard) |
| Project Detail | /projects/[id] | ✅ Built (project-scoped widgets) |
| Agents | /agents | ✅ Live |
| Library | /library | ✅ Live (add/search/filter entries, linked from Settings) |
| Settings | /settings | ✅ Live (Account, Standards, Security, Best Practices, Workflows) |
| Pricing | /pricing | ✅ Live |

**11 Widgets:** HealthScore, ProgressBar, ActiveAgents, DecisionLog, SecurityPosture, TestCoverage, CostTracker, AgentLeaderboard, RiskRegister, ActivityFeed, PMOverview

**API Routes:** activity, preferences/widget-order, projects, widgets/[name], auth/callback, library, settings

**Supabase tables:** projects, widget_data, activity_log, login_attempts, library_entries, user_settings

### VS Code Extension (`C:\Dev\ezra-vscode`) — v6.1.0
**Published:** `bas-more.ezra-governance` on VS Code Marketplace

| Feature | Status |
|---------|--------|
| 9 VS Code commands (init, scan, health, oversight, settings, openDashboard, showDecisions, refresh) | ✅ |
| 5 Sidebar views (Settings, Oversight, Progress, Agents, Memory) | ✅ |
| Status bar integration | ✅ |
| 40+ configurable settings via VS Code settings.json | ✅ |
| File watcher for .ezra/ changes | ✅ |

### MCP Server (`C:\Dev\ezra-mcp`) — v6.1.0
Published as `ezra-mcp-server@6.1.0` on npm.

### Supabase Cloud (`C:\Dev\ezra-cloud`)
**6 Edge Functions deployed:**
- validate-license, activate-license, deactivate-license
- sync-push, sync-pull, stripe-webhook

### JetBrains Plugin (`C:\Dev\ezra-jetbrains`) — v6.1.0
Uploaded to JetBrains Marketplace (pending review).

---

## 5. KEY WORKFLOWS (COMPLETE)

### Workflow A: New Project Setup
```
1. /ezra:init         — Creates .ezra/ structure, scans codebase
2. /ezra:bootstrap    — Auto-detect language, set governance defaults, create ADR-001
3. /ezra:claude-md    — Generate CLAUDE.md from governance state
4. /ezra:health       — Establish baseline health score
```

### Workflow B: Active Development
```
Every edit:          ezra-oversight hook fires (PreToolUse) → checks standards, security, governance
Every .ezra/ write:  ezra-version-hook logs change, ezra-avios-bridge syncs to AVI-OS
Every doc edit:      ezra-drift-hook counts edits since last doc sync
Session start:       ezra-dash-hook displays project status banner
```

### Workflow C: Code Review
```
/ezra:review         — Dispatches ezra-architect + ezra-reviewer + ezra-guardian in parallel
                     → YAML output: security findings, quality findings, governance violations
/ezra:guard          — Check staged changes against protected paths + ADRs
```

### Workflow D: Architecture Decision
```
/ezra:decide         — Interactive ADR creation
                     — Writes to .ezra/decisions/ADR-NNN.yaml
                     — ezra-avios-bridge auto-syncs to AVI-OS context
                     — ezra-version-hook logs the change
/ezra:reconcile      — Compare registered plan vs. actual implementation
```

### Workflow E: Sprint / Release
```
/ezra:workflow run release-prep    — 6-step pre-release check
/ezra:workflow run sprint-close    — 5-step sprint housekeeping
/ezra:version snapshot release     — Create version checkpoint
/ezra:compliance                   — Generate compliance evidence pack
/ezra:handoff                      — Generate session handoff brief
```

### Workflow F: Documentation
```
/ezra:doc-check      — Show missing/stale documents by criticality
/ezra:doc-sync       — Detect drift between code and docs, propose updates
/ezra:doc-approve    — Review and approve pending doc proposals
/ezra:doc create     — Create new SDLC document
```

### Workflow G: AVI-OS Sync
```
ezra-avios-bridge    — Fires on .ezra/decisions/ and .ezra/scans/ writes
                     — Queues sync items to .ezra/.avios-sync/pending/
/ezra:sync           — Manually push pending items to AVI-OS via MCP tools
                       (avios_add_decision, avios_update_risk, avios_log_sprint_item)
```

### Workflow H: Multi-Agent Planning
```
/ezra:plan create    — Full scope holistic plan → master-plan.yaml
/ezra:plan tasks     — View decomposed atomic task queue
/ezra:auto           — Autonomous execution under oversight
/ezra:plan gap-check — After every N tasks, compare vs. master plan
/ezra:plan checkpoint — Save recovery point
```

### Workflow I: Library & Best Practices
```
/ezra:library        — Browse/search/add best practices
/ezra:learn          — Feed new patterns into library from code
Settings → Workflows — Add documents, link to Library
Settings → Best Practices → Browse Library link
Library → Add Entry  — Custom entries (practice, document, standard, workflow, security, note)
```

---

## 6. GOVERNANCE STATE SCHEMA (`.ezra/`)

```
.ezra/
├── governance.yaml         # Protected paths, standards, enforcement rules
├── knowledge.yaml          # Architecture snapshot (layers, patterns, entry points)
├── settings.yaml           # All configurable settings (3-layer merge)
├── decisions/
│   └── ADR-NNN.yaml        # { id, status, date, category, decision, rationale, enforcement }
├── docs/
│   ├── registry.yaml       # Document registry with drift tracking
│   └── .drift-counter.json # Edit count since last doc sync
├── scans/                  # Scan result YAMLs
├── plans/
│   ├── master-plan.yaml
│   ├── task-queue.yaml
│   ├── checkpoints/
│   └── gap-reports/
├── agents/
│   ├── roster.yaml
│   ├── budget.yaml
│   ├── task-log.yaml
│   └── performance/
├── memory/
│   ├── key-facts.yaml
│   ├── briefing.md
│   ├── red-lines.yaml
│   └── sessions/
├── library/                # 14 category YAML files
├── oversight/              # Violation logs
├── progress/               # Milestone/progress tracking
├── risks/                  # Risk register
├── logs/                   # Hook execution logs
├── versions/
│   ├── current.yaml        # { version, health, scan_date }
│   └── changelog.yaml      # Immutable audit trail
├── workflows/
│   └── custom/             # User-defined workflow templates
├── .avios-sync/
│   ├── pending/            # Queued AVI-OS sync items
│   └── completed/
├── sync/
│   └── queue/              # Cloud sync queue
├── dashboard-export.json   # Latest dashboard data snapshot
└── license-cache.json      # 30-day license validation cache
```

---

## 7. ADJUSTMENTS MADE DURING BUILD (Key Decisions)

### Identity purge (AEGIS → EZRA)
- All references to the old codename "AEGIS" removed from source, docs, install.js, comments
- install.js branding corrected (GAP-001)
- ADR-003 enforces this via auto-scan

### Dashboard separated from core repo
- Core repo stays zero-dependency (Node.js only)
- Dashboard is a Next.js app in `ezra-dashboard` repo
- Connected via `ezra-dashboard-data.js` producing JSON, dashboard reads Supabase or JSON export

### AVI-OS bridge: file queue not direct MCP calls
- Hooks cannot call MCP tools directly (hooks are Node.js, MCP is session-level)
- Solution: hooks write to `.ezra/.avios-sync/pending/`, then `/ezra:sync` reads and calls MCP tools

### PKCE auth fix
- Supabase OAuth was broken because PKCE code verifier was stored in localStorage
- Server-side callback couldn't access it → "code exchange failed"
- Fix: switch to `createBrowserClient` from `@supabase/auth-helpers-nextjs` which stores PKCE in cookies

### Widget order scoping
- Original: `widget = 'dashboard-order'` — global key shared by ALL users
- Fixed: `widget = 'dashboard-order:{userId}'` — per-user key prevents cross-user data leakage

### Settings: 3-layer merge
- Layer 1: Hardcoded defaults in settings.js
- Layer 2: Global user preferences (`~/.ezra/settings.yaml`)
- Layer 3: Per-project overrides (`.ezra/settings.yaml`)
- Later layer wins. This lets enterprise set global standards while projects override locally.

### Security headers (dashboard)
- Playwright audit found missing X-Frame-Options / CSP frame-ancestors
- Added via both `vercel.json` AND `next.config.ts` (belt-and-suspenders)
- 39/39 Playwright security tests green post-fix

---

## 8. OUTSTANDING GAPS (As of v6.1.0)

### Not Built (from original v5 spec)
| Gap | Severity | Feature |
|-----|----------|---------|
| GAP-012 | MEDIUM | Git hooks (pre-commit/pre-push) — governance runs outside Claude Code |
| GAP-005 | MEDIUM | Decision Dependency Graph (Mermaid visualization) |
| GAP-012 | LOW | Custom Rule Engine (`/ezra:rules` command + hook) |
| F11 | LOW | NPM auto-publish pipeline (`.github/workflows/publish.yml`) |

### Documentation stale
| Gap | Item |
|-----|------|
| ARCHITECTURE.md | Says 22 commands — now 39 |
| COMMAND_REFERENCE.md | Missing 17 v6 commands |
| knowledge.yaml | Says 23 commands (old scan) |
| dashboard README | Generic Next.js boilerplate only |
| VS Code extension | No standalone documentation |

### Post-Beta recommended
| Item | Source | Priority |
|------|--------|----------|
| Add `.ezra/settings.yaml` to .gitignore template during /ezra:init | SEC-005 | HIGH |
| Extract shared YAML parser (used in 8+ hooks, DRY violation) | QAL-007 | HIGH |
| Add tests to 4 stub suites (memory-hook, progress-hook, tier-gate, version-hook) | QAL | MEDIUM |
| Rotate deployment tokens used during launch | Security | HIGH |
| JetBrains plugin — pending marketplace review | Distribution | IN PROGRESS |

---

## 9. DEPLOYMENT STATUS — ALL 6 COMPONENTS LIVE

| Component | Platform | Identifier | Status |
|-----------|----------|------------|--------|
| Core npm | npmjs.com | `ezra-claude-code@6.1.0` | ✅ LIVE |
| MCP Server | npmjs.com | `ezra-mcp-server@6.1.0` | ✅ LIVE |
| VS Code Extension | Marketplace | `bas-more.ezra-governance@6.1.0` | ✅ LIVE |
| Dashboard | Vercel | `ezradev.com` | ✅ LIVE |
| Supabase Edge Functions | supabase.co | `fwmmqjjocwsjnvlumrba` | ✅ LIVE |
| JetBrains Plugin | JetBrains Marketplace | Uploaded | ⏳ PENDING REVIEW |
| GitHub Release | github.com | `v6.1.0` | ✅ LIVE |

**Deploy sequence (if re-deploying):**
1. Supabase edge functions → gate: all 6 return 200
2. Core npm (`npm publish`) → gate: npm view confirms version
3. MCP npm → depends on core
4. VS Code (`npx vsce publish`) → depends on core
5. Dashboard (`npx vercel --prod`) → gate: ezradev.com returns 200
6. JetBrains (`./gradlew publishPlugin`)

**Rollback:** Reverse order, max 15 minutes

---

## 10. BUSINESS MODEL

**Tiers:**
- **Core** — Free, MIT, forever. All foundational governance features.
- **Pro** — $29/user/month. Dashboard, multi-agent, cloud sync, planning, memory, research agent.
- **Team** — $59/user/month. Project manager, cross-project learning, team management.
- **Enterprise** — Custom pricing. Contact sales.

**Break-even:** 2 Pro subscribers covers fixed costs ($13/month infrastructure)
**Revenue stack:** Stripe → Supabase stripe-webhook → license activation → tier gate enforcement

---

## 11. INTEGRATION MAP (BAS-MORE PORTFOLIO)

```
EZRA (governance layer)
├── Governs: C:\Dev\Ezra itself (dogfooding)
├── Governs: Quiz2Biz (C:\Dev\quiz-to-build)
├── Governs: MAH SDK (C:\Dev\MAH)
├── Governs: BnM Platform (C:\Dev\bas-more-platform)
├── Governs: Agent-MVP (C:\Dev\Agen-MVP)
└── Syncs to: AVI-OS context MCP (avios-context-mcp)

Quiz2Biz
└── MAH SDK (in-process import via npm workspace @libs/orchestrator)

Agent-MVP
└── MAH SDK (HTTP REST, 10 endpoints: /health, /process, /validate, /agents/*, etc.)

All repos governed by EZRA, all decisions synced to AVI-OS via ezra-avios-bridge
```

---

*This document collates all planning chats, build specs, ADR decisions, gap analyses, readiness reports, and adjustment notes into a single authoritative reference. Keep updated after major changes.*
