# Changelog

All notable changes to EZRA are documented here.

## [6.1.0] — 2026-03-30

### Added
- Document registry expanded from 55 to 81 SDLC types across 3 new cross-cutting categories:
  - Governance & AI (10): ai-usage-policy, prompt-library, agent-runbook, cost-model, data-lineage, privacy-impact, accessibility, localization, error-catalog, runbook-alerts
  - DevOps & Platform (8): cicd-pipeline, container-spec, secrets-mgmt, network-arch, capacity-plan, feature-flags, rollback-plan, load-test-plan
  - Team & Process (8): team-charter, onboarding-dev, incident-postmortem, vendor-register, tech-debt-register, decision-framework, release-calendar, api-versioning
- 17 new drift detection relevance rules for the new document types
- Cross-cutting types distributed across lifecycle phases in doc-check gap analysis
- TESTING.md — full test strategy documentation
- BRANCHING-STRATEGY.md — trunk-based development workflow
- CODE_OF_CONDUCT.md — Contributor Covenant v2.1
- GitHub issue templates (bug report, feature request) and PR template
- V7 component test suites: YAML utils, event bus, project definition, scheduler, doc ingester, phase suggester, deploy trigger, settings, execution state, achievements, interview engine, agent dispatcher, MAH client, task verifier, Quiz2Build client
- Total test count: 2,466 across 58 test files

### Fixed
- Guard hook parseYaml treating indented sub-keys (e.g. `reason:`) as top-level keys, producing false "Unknown governance.yaml keys" warnings
- Added `project_phase` to guard hook KNOWN_KEYS whitelist

## [6.0.0] — 2026-03-24

### EZRA v6 — Complete Multi-Agent Governance Framework

#### Core Engine (ezra-claude-code)
- **24 hooks** — real-time oversight, project management, settings writer, best practice library, multi-agent orchestration, dashboard data, cloud sync, workflow templates, agent memory, holistic planning, licensing, tier gating, installer, structured logging, error codes
- **39 slash commands** — full governance command set
- **1010 tests, 0 failures** — comprehensive coverage across 18 test suites
- **Zero external dependencies** — pure Node.js
- **CI pipeline** — 9 matrix jobs (3 OS × 3 Node versions)

#### New in v6
- **Real-Time Agent Oversight** — 4 intervention levels (monitor/warn/gate/strict), violation logging, excluded paths
- **Project Manager** — task tracking, milestone evaluation, stall detection, escalation, progress reports
- **Settings Writer** — write-back to settings.yaml, compliance profiles, diff/export
- **Best Practice Library** — 14 categories, seed data, search, custom entries
- **Multi-Agent Orchestration** — Claude + OpenAI real providers, 5 stub providers, assignment engine, budget enforcement, fallback logic
- **Dashboard Data + Cloud Sync** — export dashboard JSON, push/pull to Supabase
- **Workflow Templates** — 10 built-in templates, custom workflows, execution engine
- **Agent Memory** — key facts, red lines, briefings, session handoffs, knowledge graph
- **Holistic Planning** — 7-stage pipeline (plan → decompose → assign → execute → verify → gap-check → checkpoint)
- **Licensing + Distribution** — freemium tiers (Core free, Pro $29/mo, Team $59/mo), license validation, tier gating, CLI installer

#### Cloud Infrastructure (ezra-cloud)
- Supabase project with 8 tables + RLS
- 6 edge functions: validate-license, activate-license, deactivate-license, sync-push, sync-pull, stripe-webhook

#### IDE Support
- **VS Code Extension v6.0.0** — status bar (health, oversight, cost), sidebar (5 tree views), settings WebView, dashboard WebView, 9 commands
- **JetBrains Plugin v6.0.0** — tool window (JCEF dashboard), status bar widget, file watcher
- **MCP Server v6.0.0** — 26 tools exposing all governance hooks
- **Cursor** — compatibility guide + .cursorrules template

#### Dashboard + Website (ezra-dashboard)
- Next.js + TypeScript + Tailwind
- 7 pages (landing, login, dashboard, projects, settings, pricing, docs)
- 12 widget components
- Supabase Auth, IDE adapter (postMessage API)

#### Architectural Decisions Locked
- AD-104: Standalone React dashboard + agnostic IDE adapter
- AD-105: Dedicated Supabase project
- AD-106: Direct API + IDE hooks for multi-agent
- AD-107: Research agent via Supabase edge function
- AD-108: PM hybrid rule-based + AI
- AD-109: Vercel + Next.js hosting
- BD-103: Freemium model (Core MIT, Pro/Team via license key)
- BD-104: npm + VS Code + JetBrains + Cursor + website distribution
- BD-105: Core free, Pro $29/mo, Team $59/mo, Enterprise custom
- BD-106: Domain ezradev.com

## [5.0.0] — 2026-03-15

- Initial Claude Code governance framework
- 23 commands, 5 hooks, 198 tests
- Health scanning, decision tracking, documentation management
