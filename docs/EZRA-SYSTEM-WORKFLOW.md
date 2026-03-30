# EZRA System Workflow — Complete Architecture Diagrams

This document maps every layer of the EZRA (v6.1.0) governance framework, from installation through session lifecycle, hook pipeline, command workflows, agent orchestration, state management, and external integrations.

---

## 1. System Architecture Overview

High-level view of EZRA's 5-layer architecture and how components connect.

```mermaid
flowchart TD
    subgraph USER["User Layer"]
        CC[Claude Code CLI]
        IDE[VS Code / JetBrains / Cursor]
    end

    subgraph SKILL["Skill & Command Layer"]
        SK[SKILL.md Auto-Trigger]
        CMD[41 Slash Commands]
    end

    subgraph HOOK["Hook Pipeline Layer"]
        PRE[PreToolUse Gates]
        POST[PostToolUse Handlers]
        SESS[SessionStart Hooks]
    end

    subgraph AGENT["Agent Layer"]
        CORE[4 Core Engines]
        ROLES[100 Specialized Roles]
        PROV[9 Providers]
    end

    subgraph STATE[".ezra/ State Layer"]
        GOV[governance.yaml]
        DEC[decisions/]
        SCANS[scans/]
        PLANS[plans/]
        DOCS[docs/]
        VER[versions/]
    end

    subgraph CLOUD["Cloud & Integration Layer"]
        SUPA[Supabase Cloud]
        DASH[ezra-dashboard]
        AVIOS[AVI-OS Context]
        VSCODE[VS Code Extension]
    end

    CC --> SK
    IDE --> VSCODE
    SK --> CMD
    CMD --> HOOK
    CMD --> AGENT
    HOOK --> STATE
    AGENT --> STATE
    CMD --> STATE
    STATE --> CLOUD
    VSCODE --> STATE
    DASH --> SUPA
```

---

## 2. Installation & Bootstrap Flow

How EZRA gets installed and a project gets onboarded.

```mermaid
flowchart TD
    START([npm install / npx ezra-claude-code]) --> SCOPE{Scope?}
    SCOPE -->|--global| GLOBAL["Copy to ~/.claude/"]
    SCOPE -->|--local| LOCAL["Copy to ./.claude/"]

    GLOBAL --> MANIFEST
    LOCAL --> MANIFEST

    MANIFEST[bin/cli.js Manifest Copy] --> FILES

    subgraph FILES["Files Installed"]
        F1["commands/ezra/*.md — 41 commands"]
        F2["hooks/*.js — 44 hooks"]
        F3["agents/*.md — 4 core engines"]
        F4["templates/*.yaml — 10 workflow templates"]
        F5["skills/ezra/SKILL.md — auto-trigger"]
    end

    FILES --> HOOKS_REG["Register Hooks in settings.json"]

    subgraph HOOKS_REG
        H1["PreToolUse: guard, oversight, tier-gate"]
        H2["PostToolUse: drift, version, avios-bridge, memory, progress"]
        H3["SessionStart: dash-hook, session-sync"]
    end

    HOOKS_REG --> READY([Installation Complete])

    READY --> INIT["/ezra:init"]
    INIT --> CREATE_EZRA["Create .ezra/ directory"]
    CREATE_EZRA --> GOV["Write governance.yaml"]
    CREATE_EZRA --> KNOW["Write knowledge.yaml"]
    CREATE_EZRA --> DIRS["Create decisions/ scans/ plans/ docs/ versions/"]

    INIT --> BOOT{Bootstrap?}
    BOOT -->|/ezra:bootstrap| FULL_BOOT

    subgraph FULL_BOOT["One-Command Onboarding"]
        B1["/ezra:init"] --> B2["/ezra:scan"]
        B2 --> B3["/ezra:interview"]
        B3 --> B4["/ezra:guard"]
        B4 --> B5["/ezra:health"]
        B5 --> B6["/ezra:claude-md"]
        B6 --> B7["/ezra:version snapshot"]
    end

    FULL_BOOT --> ONBOARDED([Project Governed])
```

---

## 3. Session Lifecycle & Hook Pipeline

What happens from the moment a Claude Code session starts through every tool operation.

```mermaid
sequenceDiagram
    participant U as User
    participant CC as Claude Code
    participant SS as SessionStart Hooks
    participant PRE as PreToolUse Gates
    participant TOOL as Tool Execution
    participant POST as PostToolUse Handlers
    participant STATE as .ezra/ State

    Note over CC: Session Begins
    CC->>SS: Fire SessionStart
    SS->>SS: ezra-dash-hook.js
    Note right of SS: Read governance, decisions,<br/>scans, docs, plans, risks<br/>→ Print status banner
    SS->>SS: ezra-session-sync.js
    Note right of SS: Push state to dashboard<br/>via ezra-dashboard-data.js
    SS-->>CC: Banner displayed

    U->>CC: Request file edit
    CC->>PRE: Fire PreToolUse

    Note over PRE: Gate Chain (all must pass)
    PRE->>PRE: 1. ezra-tier-gate.js
    Note right of PRE: Check license tier<br/>Core/Pro/Team gating
    PRE->>PRE: 2. ezra-guard.js
    Note right of PRE: Check protected paths<br/>vs governance.yaml rules
    PRE->>PRE: 3. ezra-oversight.js
    Note right of PRE: Check code quality standards<br/>secrets, SQL injection, complexity

    alt Any gate denies
        PRE-->>CC: permissionDecision: deny
        CC-->>U: Operation blocked with reason
    else All gates pass
        PRE-->>CC: permissionDecision: allow
        CC->>TOOL: Execute Write/Edit/Bash
        TOOL-->>CC: Operation complete

        CC->>POST: Fire PostToolUse
        POST->>STATE: ezra-drift-hook.js
        Note right of POST: Increment .drift-counter.json<br/>Warn if docs stale (10+ edits)
        POST->>STATE: ezra-version-hook.js
        Note right of POST: Auto-version .ezra/ changes<br/>Append to changelog.yaml
        POST->>STATE: ezra-avios-bridge.js
        Note right of POST: Sync decisions/scans to<br/>AVI-OS pending queue
        POST->>STATE: ezra-memory-hook.js
        Note right of POST: Auto-capture patterns<br/>and lessons from output
        POST->>STATE: ezra-progress-hook.js
        Note right of POST: Log activity, check<br/>milestones every Nth edit

        POST-->>CC: All handlers complete
        CC-->>U: Result displayed
    end
```

---

## 4. Command Workflow — User Journeys

Three primary user journeys showing command sequences, decision points, and phase gates.

```mermaid
flowchart LR
    subgraph ONBOARD["Journey 1: Project Onboarding"]
        direction TB
        O1["/ezra:init"] --> O2["/ezra:scan"]
        O2 --> O3["/ezra:interview"]
        O3 --> O4["/ezra:decide — Record ADRs"]
        O4 --> O5["/ezra:health — Baseline score"]
        O5 --> O6["/ezra:plan generate"]
        O6 --> O7["/ezra:plan lock"]
        O7 --> O8([Ready for Execution])
    end

    subgraph DAILY["Journey 2: Daily Development"]
        direction TB
        D1["/ezra:scan --quick"] --> D2["/ezra:review --recent"]
        D2 --> D3["/ezra:guard"]
        D3 --> D4["Developer works on code"]
        D4 --> D5["/ezra:decide — New ADRs"]
        D5 --> D6["/ezra:reconcile"]
        D6 --> D7{Health OK?}
        D7 -->|Yes| D8["/ezra:version snapshot"]
        D7 -->|No| D9["/ezra:health — Diagnose"]
        D9 --> D4
    end

    subgraph RELEASE["Journey 3: Release Flow"]
        direction TB
        R1["/ezra:health gate-report"] --> R2{Gate Pass?}
        R2 -->|No| R3["Fix issues"] --> R1
        R2 -->|Yes| R4["/ezra:reconcile"]
        R4 --> R5["/ezra:doc-check"]
        R5 --> R6["/ezra:doc create release-notes"]
        R6 --> R7["/ezra:auto release-prep"]
        R7 --> R8{Guards OK?}
        R8 -->|No| R9["HALT — Fix violations"] --> R7
        R8 -->|Yes| R10["/ezra:version bump"]
        R10 --> R11["/ezra:version snapshot"]
        R11 --> R12([Release Complete])
    end
```

---

## 5. Agent Orchestration & Dispatch

How EZRA selects, scores, and dispatches agents across providers.

```mermaid
flowchart TD
    CMD["/ezra:scan or /ezra:review"] --> DISPATCH["Agent Dispatcher<br/>(ezra-agents.js)"]

    DISPATCH --> STRATEGY{Assignment Strategy}
    STRATEGY -->|auto| SCORE["Weighted Scoring"]
    STRATEGY -->|manual| USER_SELECT["User Selects"]
    STRATEGY -->|round-robin| RR["Cycle Providers"]
    STRATEGY -->|cost| CHEAPEST["Lowest Cost"]
    STRATEGY -->|quality| BEST["Highest Quality"]

    subgraph SCORE["Scoring Algorithm"]
        S1["skill_match: 0.35"]
        S2["cost_efficiency: 0.25"]
        S3["speed: 0.15"]
        S4["quality_score: 0.15"]
        S5["availability: 0.10"]
    end

    SCORE --> BUDGET{Within Budget?}
    BUDGET -->|No| FALLBACK["Try secondary provider"]
    BUDGET -->|Yes| SELECT["Select Top-Scored Agent"]

    SELECT --> ENGINES

    subgraph ENGINES["4 Core Engines"]
        E1["ezra-architect<br/>Architecture, layers,<br/>patterns, dependencies"]
        E2["ezra-reviewer<br/>OWASP security,<br/>code quality, confidence"]
        E3["ezra-guardian<br/>Decision enforcement,<br/>protected paths, standards"]
        E4["ezra-reconciler<br/>Plan vs implementation,<br/>gap detection, constraints"]
    end

    ENGINES --> DOMAINS

    subgraph DOMAINS["12 Domains — 100 Specialized Roles"]
        D1["Architecture: 10"]
        D2["Security: 12"]
        D3["Quality: 10"]
        D4["Testing: 8"]
        D5["Governance: 8"]
        D6["DevOps: 10"]
        D7["Documentation: 8"]
        D8["Performance: 8"]
        D9["Accessibility: 6"]
        D10["Data: 6"]
        D11["Frontend: 8"]
        D12["Reconciliation: 6"]
    end

    DOMAINS --> PROVIDERS

    subgraph PROVIDERS["9 Providers"]
        P1["Anthropic — Claude"]
        P2["OpenAI — GPT"]
        P3["Codex"]
        P4["Cursor"]
        P5["VS Code Copilot"]
        P6["Windsurf"]
        P7["Ollama — stub"]
        P8["DeepSeekCoder — stub"]
        P9["Qoder — stub"]
    end

    PROVIDERS --> RESULT["Agent Output<br/>→ .ezra/scans/ or review report"]

    subgraph PRESETS["14 Pre-configured Teams"]
        PR1["quick-review: 3 agents"]
        PR2["full-scan: 4 agents"]
        PR3["security-deep: 6 agents"]
        PR4["pre-release: 8 agents"]
        PR5["maximum-coverage: 12 agents"]
    end

    CMD -->|"--preset"| PRESETS
    PRESETS --> ENGINES
```

---

## 6. State Management & Data Flow

What lives in `.ezra/` and which components read/write each file.

```mermaid
flowchart LR
    subgraph EZRA_DIR[".ezra/ State Directory"]
        direction TB
        GOV["governance.yaml<br/>Rules, protected paths,<br/>standards, enforcement"]
        KNOW["knowledge.yaml<br/>Architecture, patterns,<br/>layers, dependencies"]
        SETTINGS["settings.yaml<br/>Config, providers,<br/>budgets, integrations"]

        subgraph DEC["decisions/"]
            ADR["ADR-001.yaml<br/>ADR-002.yaml<br/>..."]
        end

        subgraph SCANS_DIR["scans/"]
            SCAN_F["timestamp.yaml<br/>Health score,<br/>findings"]
        end

        subgraph PLANS_DIR["plans/"]
            PLAN_F["master-plan.yaml<br/>phases.yaml<br/>tasks.yaml"]
        end

        subgraph DOCS_DIR["docs/"]
            REG["registry.yaml<br/>81 document types"]
            DRIFT[".drift-counter.json<br/>Edit counts per doc"]
        end

        subgraph VER_DIR["versions/"]
            CUR["current.yaml<br/>Version, timestamp"]
            LOG_F["changelog.yaml<br/>Append-only audit trail"]
            SNAP["snapshots/<br/>Named checkpoints"]
        end

        subgraph OVER_DIR["oversight/"]
            VIOL["violations.log<br/>Rotates at 1MB"]
        end

        subgraph PROG_DIR["progress/"]
            ACT["activity.log<br/>Timestamp, tool, file"]
            MILE["milestones.yaml"]
        end

        subgraph AVIOS_DIR[".avios-sync/"]
            PEND["pending/*.json<br/>Sync instructions"]
        end
    end

    subgraph WRITERS["Writers"]
        W_INIT["/ezra:init"]
        W_SCAN["/ezra:scan"]
        W_DECIDE["/ezra:decide"]
        W_DOC["/ezra:doc"]
        W_PLAN["/ezra:plan"]
        W_GUARD["guard hook"]
        W_DRIFT["drift hook"]
        W_VER["version hook"]
        W_OVER["oversight hook"]
        W_PROG["progress hook"]
        W_AVIOS["avios-bridge hook"]
    end

    subgraph READERS["Readers"]
        R_GUARD["guard hook"]
        R_DASH["dash hook"]
        R_HEALTH["/ezra:health"]
        R_RECON["/ezra:reconcile"]
        R_SYNC["cloud-sync"]
    end

    W_INIT --> GOV
    W_INIT --> KNOW
    W_SCAN --> SCAN_F
    W_DECIDE --> ADR
    W_DOC --> REG
    W_PLAN --> PLAN_F
    W_DRIFT --> DRIFT
    W_VER --> CUR
    W_VER --> LOG_F
    W_OVER --> VIOL
    W_PROG --> ACT
    W_PROG --> MILE
    W_AVIOS --> PEND

    R_GUARD --> GOV
    R_GUARD --> ADR
    R_DASH --> GOV
    R_DASH --> ADR
    R_DASH --> SCAN_F
    R_DASH --> REG
    R_DASH --> PLAN_F
    R_HEALTH --> SCAN_F
    R_HEALTH --> ADR
    R_HEALTH --> REG
    R_RECON --> PLAN_F
    R_RECON --> SCAN_F
    R_SYNC --> GOV
    R_SYNC --> ADR
    R_SYNC --> SETTINGS
```

---

## 7. Integration Map

How EZRA Core connects to external systems: dashboard, IDE extensions, cloud, and AVI-OS.

```mermaid
flowchart TD
    subgraph CORE["EZRA Core (ezra-claude-code)"]
        HOOKS["44 Hooks"]
        CMDS["41 Commands"]
        AGENTS["4 Engines + 100 Roles"]
        STATE[".ezra/ State"]
    end

    subgraph CLAUDE_CODE["Claude Code Runtime"]
        SKILL_TRIGGER["SKILL.md Auto-Trigger"]
        HOOK_PROTO["Hook Protocol<br/>stdin JSON → stdout JSON"]
        SETTINGS_JSON["settings.json<br/>Hook registration"]
    end

    subgraph SUPABASE["Supabase Cloud"]
        SYNC_PUSH["/functions/v1/sync-push"]
        SYNC_PULL["/functions/v1/sync-pull"]
        LICENSE_API["/functions/v1/validate-license"]
        STRIPE["/functions/v1/stripe-webhook"]
        DB["8 Tables + RLS"]
    end

    subgraph DASHBOARD["ezra-dashboard (Next.js)"]
        LANDING["Landing Page"]
        DASH_UI["Dashboard Widgets"]
        PROJECTS["Projects View"]
        PRICING["Pricing + Stripe"]
        AUTH["Supabase Auth"]
    end

    subgraph VSCODE_EXT["ezra-vscode (VS Code Extension)"]
        STATUS_BAR["Status Bar — Health, Oversight, Cost"]
        SIDEBAR["5 Tree Views"]
        WEBVIEW["Settings + Dashboard WebViews"]
        VS_CMDS["9 Extension Commands"]
    end

    subgraph JETBRAINS["JetBrains Plugin"]
        JB_TOOL["JCEF Dashboard Tool Window"]
        JB_STATUS["Status Bar Widget"]
        JB_WATCH["File Watcher"]
    end

    subgraph AVIOS["AVI-OS Context (MCP Server)"]
        DECISIONS_MCP["Decision Records"]
        RISKS_MCP["Risk Register"]
        PROJECTS_MCP["Project State"]
    end

    %% Claude Code connections
    SKILL_TRIGGER -->|auto-trigger on session| CMDS
    HOOK_PROTO -->|stdin/stdout JSON| HOOKS
    SETTINGS_JSON -->|registers| HOOKS

    %% Cloud sync
    STATE -->|ezra-cloud-sync.js| SYNC_PUSH
    SYNC_PULL -->|pull changes| STATE
    STATE -->|ezra-license.js| LICENSE_API

    %% Dashboard
    STATE -->|ezra-dashboard-data.js| DASH_UI
    DASHBOARD --> AUTH
    AUTH --> DB
    DASH_UI --> DB
    PRICING --> STRIPE

    %% VS Code Extension
    VSCODE_EXT -->|reads .ezra/ state| STATE
    VS_CMDS -->|terminal commands| CMDS

    %% JetBrains
    JETBRAINS -->|reads .ezra/ state| STATE
    JB_WATCH -->|file change events| STATE

    %% AVI-OS
    STATE -->|ezra-avios-bridge.js<br/>pending queue| AVIOS
    CMDS -->|/ezra:sync| AVIOS
```

---

## 7-Stage Execution Pipeline

The complete end-to-end pipeline for plan-driven autonomous execution.

```mermaid
flowchart TD
    S1["Stage 1: PLAN<br/>/ezra:interview + /ezra:plan generate"]
    S2["Stage 2: DECOMPOSE<br/>Break into agent-sized tasks"]
    S3["Stage 3: ASSIGN<br/>Score and assign to agents"]
    S4["Stage 4: EXECUTE<br/>/ezra:auto plan-driven"]
    S5["Stage 5: VERIFY<br/>/ezra:health gate-report"]
    S6["Stage 6: GAP CHECK<br/>/ezra:reconcile + /ezra:doc-check"]
    S7["Stage 7: CHECKPOINT<br/>/ezra:version snapshot"]

    S1 --> S2 --> S3 --> S4

    S4 --> GUARD_CHECK{Guard Rails OK?}
    GUARD_CHECK -->|Yes| NEXT_TASK["Execute next task"]
    GUARD_CHECK -->|No| HALT["HALT — Fix violations"]
    HALT --> S4
    NEXT_TASK --> PHASE_DONE{Phase complete?}
    PHASE_DONE -->|No| S4
    PHASE_DONE -->|Yes| S5

    S5 --> GATE{Gate Pass?}
    GATE -->|No, max 3 retries| FIX["Auto-fix or halt"]
    FIX --> S5
    GATE -->|Yes| S6

    S6 --> GAPS{Gaps found?}
    GAPS -->|Yes| S4
    GAPS -->|No| S7

    S7 --> MORE{More phases?}
    MORE -->|Yes| S4
    MORE -->|No| DONE([Project Complete])

    subgraph GUARD_RAILS["Guard Rails — Checked Before Every Step"]
        G1["Git working tree clean"]
        G2["All tests pass"]
        G3["Health score >= minimum"]
        G4["No critical risks open"]
        G5["No governance violations"]
        G6["No blocked commands<br/>(rm -rf, DROP TABLE, git push --force)"]
        G7["No protected file edits<br/>(.env, secrets/, .git/, production.*)"]
    end

    GUARD_CHECK -.->|checks| GUARD_RAILS
```

---

## Health Scoring — 5 Pillars

```mermaid
pie title Health Score Weight Distribution
    "On-Track (Plan adherence)" : 25
    "Secure (OWASP, secrets, auth)" : 25
    "No Gaps (Docs, tests, API)" : 20
    "Clean (Types, lint, debt)" : 15
    "Best Practices (CI, git, reviews)" : 15
```

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90-100 | Release ready |
| **B** | 75-89 | Minor issues |
| **C** | 60-74 | Needs attention |
| **D** | 40-59 | Major blockers |
| **F** | 0-39 | Cannot proceed |

---

## Quick Reference: All 41 Commands by Category

| Category | Commands |
|----------|----------|
| **Setup** | init, bootstrap, install, claude-md |
| **Analysis** | scan, review, health, advisor |
| **Governance** | guard, decide, oversight, compliance |
| **Documents** | doc, doc-check, doc-sync, doc-approve |
| **Planning** | plan, interview, assess, pm, progress |
| **Execution** | process, auto, workflow |
| **Visibility** | status, dash, portfolio |
| **Versioning** | version, reconcile |
| **Knowledge** | memory, learn, handoff, library |
| **Integration** | sync, agents, multi |
| **System** | settings, cost, research, license, help |

## Quick Reference: All 44 Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| ezra-guard.js | PreToolUse | Protected path enforcement |
| ezra-oversight.js | PreToolUse | Code quality and security checks |
| ezra-tier-gate.js | PreToolUse | License tier feature gating |
| ezra-dash-hook.js | SessionStart | Project status banner |
| ezra-session-sync.js | SessionStart | Dashboard state push |
| ezra-drift-hook.js | PostToolUse | Document drift detection |
| ezra-version-hook.js | PostToolUse | Auto-versioning of .ezra/ state |
| ezra-avios-bridge.js | PostToolUse | AVI-OS decision/risk sync |
| ezra-memory-hook.js | PostToolUse | Pattern and lesson capture |
| ezra-progress-hook.js | PostToolUse | Activity logging and milestone checks |
| ezra-settings.js | Utility | Settings parser (imported) |
| ezra-settings-writer.js | Utility | Settings write-back (imported) |
| ezra-agents.js | Utility | Multi-agent orchestration (imported) |
| ezra-library.js | Utility | Best practice library (imported) |
| ezra-cloud-sync.js | Utility | Cloud backup/restore (imported) |
| ezra-dashboard-data.js | Utility | Dashboard data aggregation (imported) |
| ezra-error-codes.js | Utility | Error code catalog (imported) |
| ezra-hook-logger.js | Utility | Structured JSON logger (imported) |
| ezra-http.js | Utility | HTTP client with SSRF protection (imported) |
| ezra-installer.js | Utility | CLI installer logic (imported) |
| ezra-license.js | Utility | License management (imported) |
| ezra-memory.js | Utility | Knowledge base engine (imported) |
| ezra-planner.js | Utility | Planning engine (imported) |
| ezra-pm.js | Utility | Project manager (imported) |
| ezra-workflows.js | Utility | Workflow template engine (imported) |
| ezra-commit-engine.js | Utility | Git commit batching and safety (imported) |
| + 18 more | Various | Phase gates, execution, notifier, scheduler, etc. |
