# EZRA v5.0.0 — Enhancement Build Specification
# Claude Code Execution Prompt
# Generated: 2026-03-19
# Owner: Avi Bendetsky / BAS-More
# Repo: C:\Dev\ezra-claude-code (github.com/BAS-More/ezra-claude-code)

## CONTEXT

EZRA (עזרא) is a multi-agent codebase governance framework for Claude Code.
Current state: v4.0.0, 49 files, 273/273 tests passing across 5 suites (Structure, Commands, Hooks, CLI, Templates) + E2E + UAT.

The existing codebase structure:
```
commands/ezra/     — 19 slash command .md files (init, scan, guard, reconcile, decide, review, status, help, doc, dash, doc-check, doc-sync, doc-approve, version, health, advisor, process, auto, multi)
agents/            — 4 agent .md files (ezra-architect, ezra-reviewer, ezra-guardian, ezra-reconciler)
hooks/             — 4 hook .js files (ezra-guard, ezra-dash-hook, ezra-drift-hook, ezra-version-hook)
skills/ezra/       — 1 SKILL.md
templates/         — 5 YAML templates (full-remediation, release-prep, sprint-close, security-audit, onboarding)
bin/cli.js         — Cross-platform CLI installer (~400 lines)
install.js         — Installation logic
tests/             — 9 test files (run-tests.js, test-structure.js, test-commands.js, test-hooks.js, test-cli.js, test-templates.js, lint-all.js, test-e2e.js, test-uat.js)
package.json       — npm package config
README.md          — Full documentation with Ezra HaSofer identity
```

Technology: Pure Node.js, zero dependencies. All hooks read JSON from stdin (Claude Code hook protocol). All commands are markdown prompt files. Tests use Node's built-in assert.

## OBJECTIVE

Build 12 new features for EZRA v5.0.0. Each feature must include: implementation, tests, documentation updates, and integration with existing systems. All code must be zero-dependency Node.js, cross-platform (Windows/macOS/Linux), and follow the existing patterns.

---

## FEATURE 1: AVI-OS Integration Bridge
**Priority: CRITICAL | Files: hooks/ezra-avios-bridge.js, commands/ezra/sync.md**

### What It Does
Syncs EZRA governance state with the avios-context MCP server. When a decision is recorded in `.ezra/decisions/`, it automatically writes to avios-context. When a risk is identified in a scan, it creates/updates an avios-context risk entry.

### Implementation Details

**hooks/ezra-avios-bridge.js** (PostToolUse hook):
- Trigger: fires on Write/Edit operations to `.ezra/decisions/` and `.ezra/scans/`
- Reads stdin JSON (Claude Code hook protocol: `{ tool_name, tool_input, cwd }`)
- When a decision file is created/modified in `.ezra/decisions/`:
  - Parse the YAML decision file
  - Map EZRA decision categories (ARCHITECTURE, DATABASE, SECURITY, API, TESTING, INFRASTRUCTURE, DEPENDENCY, CONVENTION) to avios-context categories (AD, DD, SC, AD, TC, AD, TC, TC)
  - Write a JSON instruction file to `.ezra/.avios-sync/pending/` with the mapped decision data
  - Format: `{ action: "add_decision", project_id: "<from .ezra/governance.yaml>", category: "AD", decision: "...", rationale: "...", status: "LOCKED" }`
- When a scan result is created in `.ezra/scans/`:
  - Parse scan results for CRITICAL/HIGH findings
  - Write risk entries to `.ezra/.avios-sync/pending/`
  - Format: `{ action: "add_risk" | "update_risk", project_id: "...", category: "...", description: "...", impact: "HIGH", status: "OPEN" }`
- Output: JSON to stdout confirming sync action (non-blocking, always exit 0)

**commands/ezra/sync.md** (new slash command):
- `/ezra:sync` — Manual sync trigger
- Reads all pending items from `.ezra/.avios-sync/pending/`
- Presents them to the user for review
- Instructs Claude Code to call the avios-context MCP tools (avios_add_decision, avios_update_risk, avios_log_sprint_item)
- Moves processed items to `.ezra/.avios-sync/completed/`
- Shows sync status: "3 decisions synced, 1 risk created, 0 failures"

**Configuration in `.ezra/governance.yaml`:**
```yaml
avios_integration:
  enabled: true
  project_id: "quiz2biz"  # or "bnm", "vitamins", etc.
  auto_sync: false  # true = sync immediately, false = batch to pending
  sync_decisions: true
  sync_risks: true
  sync_sprint_items: false  # future
```

### Tests Required
- Bridge hook exits 0 when avios integration disabled
- Bridge hook creates pending sync file on decision write
- Bridge hook creates pending sync file on scan with critical findings
- Bridge hook handles missing governance.yaml gracefully
- Sync command reads and lists pending items
- Sync command handles empty pending directory
- Category mapping is correct for all 8 EZRA categories

---

## FEATURE 2: CLAUDE.md Auto-Generator
**Priority: CRITICAL | Files: commands/ezra/claude-md.md**

### What It Does
Generates a `CLAUDE.md` file from `.ezra/` state so every Claude Code session starts with full governance context.

### Implementation Details

**commands/ezra/claude-md.md:**
- `/ezra:claude-md` — Generate or update CLAUDE.md at project root
- Reads from:
  - `.ezra/governance.yaml` — project name, language, framework, protected paths, standards
  - `.ezra/knowledge.yaml` — architecture, patterns, layers, dependencies
  - `.ezra/decisions/` — all ACTIVE decisions (not SUPERSEDED/DEPRECATED)
  - `.ezra/versions/current.yaml` — current version, health score
  - `package.json` / `tsconfig.json` — tech stack info
- Generates CLAUDE.md with sections:
  ```
  # Project: {name}

  ## Architecture
  {from knowledge.yaml — layers, patterns, key directories}

  ## Active Decisions
  {list of active ADRs — ID, decision text, enforcement paths}

  ## Protected Paths
  {from governance.yaml — patterns and reasons}

  ## Standards
  {from governance.yaml — coding standards, conventions}

  ## Governance
  This project uses EZRA for codebase governance.
  - Run /ezra:status for current health
  - Run /ezra:scan before major changes
  - Run /ezra:guard before committing
  - All architectural decisions must be recorded via /ezra:decide
  ```
- If CLAUDE.md already exists, only update EZRA-managed sections (delimited by `<!-- EZRA:START -->` and `<!-- EZRA:END -->` markers)
- If CLAUDE.md doesn't exist, create it fresh

### Tests Required
- Command generates valid markdown
- Command preserves non-EZRA content in existing CLAUDE.md
- Command handles missing .ezra/ gracefully
- Generated CLAUDE.md includes all active decisions
- Generated CLAUDE.md includes protected paths
- EZRA markers are correctly placed

---

## FEATURE 3: Bootstrap Command
**Priority: CRITICAL | Files: commands/ezra/bootstrap.md**

### What It Does
One-command project onboarding: scans, creates governance.yaml with sensible defaults, registers first ADR, runs health check, generates CLAUDE.md.

### Implementation Details

**commands/ezra/bootstrap.md:**
- `/ezra:bootstrap` — Full project bootstrap (replaces manual init + configure workflow)
- Steps (executed sequentially by Claude Code):
  1. Run `/ezra:init` internally (create .ezra/ structure, scan codebase)
  2. Auto-detect and apply governance defaults:
     - Protected paths: `*.env*`, `**/migrations/**`, `**/*.secret`, `**/keys/**`, `docker-compose*.yml`, `Dockerfile*`
     - Standards: based on detected language (TypeScript → strict mode, no-any; Python → type hints; etc.)
  3. Create ADR-001: "EZRA governance initialized" with auto-detected architecture summary
  4. Run `/ezra:health` to establish baseline score
  5. Run `/ezra:claude-md` to generate CLAUDE.md (Feature 2)
  6. Run `/ezra:version snapshot bootstrap` to create initial version checkpoint
  7. Present summary:
     ```
     EZRA Bootstrap Complete
     ═══════════════════════════
     Project: {name}
     Language: {lang} | Framework: {framework}
     Protected paths: {count} configured
     Baseline health: {score}/100
     CLAUDE.md: Generated

     Next: Start coding. EZRA is watching.
     ```
- Idempotent: if .ezra/ already exists, skip init and only update missing pieces

### Tests Required
- Bootstrap creates .ezra/ directory structure
- Bootstrap creates governance.yaml with defaults
- Bootstrap creates ADR-001
- Bootstrap is idempotent (safe to run twice)
- Bootstrap detects language from package.json/tsconfig/pyproject.toml

---

## FEATURE 4: Git Hook Integration
**Priority: HIGH | Files: commands/ezra/git-hooks.md, hooks/ezra-pre-commit.js, hooks/ezra-pre-push.js**

### What It Does
Installs actual git pre-commit and pre-push hooks that run EZRA governance checks outside Claude Code.

### Implementation Details

**commands/ezra/git-hooks.md:**
- `/ezra:git-hooks install` — Install git hooks
- `/ezra:git-hooks remove` — Remove git hooks
- `/ezra:git-hooks status` — Show installed hooks

**hooks/ezra-pre-commit.js:**
- Runs on `git commit`
- Checks staged files against protected paths in governance.yaml
- If a protected file is staged without a corresponding decision, print warning and prompt
- Uses `git diff --cached --name-only` to get staged files
- Exit 0 = allow commit, Exit 1 = block commit
- Configurable: `governance.yaml → git_hooks.pre_commit.blocking: true|false`

**hooks/ezra-pre-push.js:**
- Runs on `git push`
- Checks: does a scan exist within the last 24 hours?
- If no recent scan: warn (non-blocking by default)
- Configurable: `governance.yaml → git_hooks.pre_push.require_recent_scan: true|false`

**Installation method:**
- Creates `.git/hooks/pre-commit` and `.git/hooks/pre-push` that call the EZRA hooks
- Backs up existing hooks to `.git/hooks/pre-commit.ezra-backup`
- Uses `#!/usr/bin/env node` shebang for cross-platform

### Tests Required
- Install creates git hook files
- Install backs up existing hooks
- Remove restores backed-up hooks
- Pre-commit hook reads governance.yaml protected paths
- Pre-commit hook allows non-protected files
- Pre-push hook checks scan recency
- Status command shows correct state

---

## FEATURE 5: Decision Dependency Graph
**Priority: HIGH | Files: commands/ezra/decide-graph.md**

### What It Does
Renders a Mermaid diagram of the decision tree — which decisions superseded which, active vs deprecated, dependency chains.

### Implementation Details

**commands/ezra/decide-graph.md:**
- `/ezra:decide-graph` — Generate decision dependency visualization
- Reads all files in `.ezra/decisions/`
- Builds a graph:
  - Nodes: each ADR (color-coded by status: green=ACTIVE, grey=SUPERSEDED, red=DEPRECATED)
  - Edges: supersedes relationships, depends-on relationships
  - Clusters: group by category (ARCHITECTURE, DATABASE, SECURITY, etc.)
- Outputs Mermaid markdown that Claude Code can render:
  ```mermaid
  graph TD
    ADR-001["ADR-001: Use NestJS"] --> ADR-005["ADR-005: Switch to Fastify"]
    ADR-003["ADR-003: PostgreSQL"] --> ADR-007["ADR-007: Add Redis cache"]
    style ADR-001 fill:#grey
    style ADR-005 fill:#green
  ```
- Also outputs a text summary: "12 active, 3 superseded, 1 deprecated. Longest chain: 4 deep."

### Tests Required
- Command handles empty decisions directory
- Command generates valid Mermaid syntax
- Supersedes relationships create correct edges
- Status colors are correctly applied
- Category clustering works

---

## FEATURE 6: Drift Alert Escalation
**Priority: HIGH | Files: hooks/ezra-drift-hook.js (modify existing)**

### What It Does
Adds escalation thresholds to the existing drift hook. After configurable edit counts without doc sync, surface warnings.

### Implementation Details

Modify existing `hooks/ezra-drift-hook.js`:
- Read thresholds from `.ezra/governance.yaml`:
  ```yaml
  drift:
    warn_threshold: 10      # edits before warning
    block_threshold: 25     # edits before blocking (optional)
    block_enabled: false     # whether to block at threshold
  ```
- Current behavior (keep): count edits, track affected docs in `.ezra/docs/.drift-counter.json`
- New behavior (add):
  - When `edits_since_sync >= warn_threshold`:
    - Add to hook output: `{ hookSpecificOutput: { message: "⚠️ DRIFT WARNING: 15 edits since last doc sync. Run /ezra:doc-sync." } }`
  - When `edits_since_sync >= block_threshold` AND `block_enabled`:
    - Set `permissionDecision: "deny"` in output
    - Message: "🔴 DRIFT BLOCKED: 30 edits without doc sync. Run /ezra:doc-sync to continue."
  - Reset counter when `/ezra:doc-sync` runs (doc-sync command should write `{ edits_since_sync: 0 }` to the counter)

### Tests Required
- Warning fires at correct threshold
- No warning below threshold
- Block fires when enabled and threshold exceeded
- Block does not fire when disabled
- Counter reads from governance.yaml thresholds
- Missing thresholds use sensible defaults (warn: 10, block: 25, block_enabled: false)

---

## FEATURE 7: Cross-Project Portfolio Dashboard
**Priority: MEDIUM | Files: commands/ezra/portfolio.md**

### What It Does
Reads `.ezra/` state from multiple project directories and produces a unified health dashboard.

### Implementation Details

**commands/ezra/portfolio.md:**
- `/ezra:portfolio` — Show portfolio health dashboard
- Reads project list from `~/.ezra-portfolio.yaml`:
  ```yaml
  projects:
    - name: Quiz2Biz
      path: C:\Dev\quiz-to-build
    - name: BnM Platform
      path: C:\Dev\bas-more-platform
    - name: MAH SDK
      path: C:\Dev\MAH
    - name: Reward Service
      path: C:\Dev\Agent-MVP
  ```
- For each project, reads:
  - `.ezra/versions/current.yaml` → health score, version
  - `.ezra/decisions/` → count active decisions
  - `.ezra/docs/.drift-counter.json` → drift level
  - `.ezra/scans/` → last scan date
- Outputs dashboard:
  ```
  EZRA PORTFOLIO HEALTH
  ═══════════════════════════════════════════════════════

  Project          Health  Decisions  Drift  Last Scan
  ─────────────────────────────────────────────────────
  Quiz2Biz         82/100  12 active  3/10   2026-03-19
  BnM Platform     45/100   6 active  18/10  2026-03-15
  MAH SDK          91/100  17 active  0/10   2026-03-18
  Reward Service   —/100    0 active  —      Never

  ⚠️ BnM Platform: drift threshold exceeded (18 edits)
  ⚠️ Reward Service: EZRA not initialized
  ```

### Tests Required
- Command handles missing portfolio config
- Command handles projects where .ezra/ doesn't exist
- Command handles empty project list
- Dashboard formats correctly with mixed states
- Portfolio config path is cross-platform

---

## FEATURE 8: Session Handoff Export
**Priority: MEDIUM | Files: commands/ezra/handoff.md**

### What It Does
Exports current project state as a structured briefing document — lives in the repo, not just avios DB.

### Implementation Details

**commands/ezra/handoff.md:**
- `/ezra:handoff` — Generate handoff briefing
- `/ezra:handoff save` — Save to `.ezra/handoffs/`
- Compiles from:
  - `.ezra/knowledge.yaml` → architecture summary
  - `.ezra/decisions/` → active decisions (last 10)
  - `.ezra/scans/` → last scan summary
  - `.ezra/versions/changelog.yaml` → recent changes (last 20)
  - `.ezra/docs/registry.yaml` → doc coverage gaps
  - `.ezra/versions/current.yaml` → health score
  - `git log --oneline -10` → recent commits
- Output format:
  ```
  EZRA HANDOFF BRIEF — {project} — {date}
  ═══════════════════════════════════════════════

  HEALTH: {score}/100 | VERSION: {version}

  ARCHITECTURE
  {2-3 line summary from knowledge.yaml}

  RECENT DECISIONS (last 10)
  - ADR-012: Switched to Fastify [ACTIVE]
  - ADR-011: Added Redis caching layer [ACTIVE]

  RECENT CHANGES (last 20 changelog entries)
  - CHG-045: Decision ADR-012 created
  - CHG-044: Scan completed (score: 82)

  OPEN ITEMS
  - 3 critical documents missing
  - Drift counter: 7 edits since last sync

  RECENT COMMITS
  - a1b2c3d fix: resolve auth middleware issue
  - e4f5g6h feat: add user preferences API
  ```
- When `save` is passed, writes to `.ezra/handoffs/{ISO-date}-handoff.md`

### Tests Required
- Command generates valid markdown
- Command handles missing .ezra/ state files
- Save command creates file in handoffs directory
- Recent decisions are correctly filtered
- Git log integration works (and gracefully handles non-git repos)

---

## FEATURE 9: Compliance Evidence Pack
**Priority: MEDIUM | Files: commands/ezra/compliance.md**

### What It Does
Bundles all governance evidence into a timestamped compliance evidence directory for auditors.

### Implementation Details

**commands/ezra/compliance.md:**
- `/ezra:compliance` — Generate compliance evidence pack
- `/ezra:compliance --standard=WHO-GMP` — Filter for specific standard
- Creates `.ezra/compliance/{ISO-date}/`:
  - `00-index.md` — Table of contents
  - `01-decisions/` — Copy of all active decisions
  - `02-scan-history/` — Last 5 scan results
  - `03-document-registry.yaml` — Full doc registry snapshot
  - `04-changelog.yaml` — Full version changelog
  - `05-health-report.md` — Current health assessment
  - `06-governance-config.yaml` — Current governance configuration
  - `07-git-log.txt` — Last 100 commits
- Index file maps evidence to common compliance frameworks:
  ```markdown
  | Requirement | Evidence | Location |
  |-------------|----------|----------|
  | Change control | Decision records | 01-decisions/ |
  | Audit trail | Version changelog | 04-changelog.yaml |
  | Code review | Scan history | 02-scan-history/ |
  | Documentation | Document registry | 03-document-registry.yaml |
  ```
- For WHO-GMP/EU-GMP specific mode: maps to GAMP5 categories, adds data integrity (ALCOA+) evidence section

### Tests Required
- Command creates evidence directory structure
- Index file is valid markdown with correct links
- Decision files are correctly copied
- Missing scan/doc directories don't crash
- Standard-specific filtering works
- Timestamp format is consistent

---

## FEATURE 10: VS Code Status Bar (Stretch)
**Priority: LOW | Files: Not in this build — documented for future**

Skip implementation. Add a note to README under "Roadmap" section:
```
### Planned
- VS Code extension with status bar widget showing health score and drift count
```

---

## FEATURE 11: NPM Publishing Pipeline
**Priority: LOW | Files: .github/workflows/publish.yml, package.json updates**

### Implementation Details

**.github/workflows/publish.yml:**
```yaml
name: Publish
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: node tests/run-tests.js
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Update package.json:
- Add `"publishConfig": { "access": "public" }`
- Verify `"files"` array includes all necessary directories

### Tests Required
- Publish workflow YAML is valid
- package.json has publishConfig
- `npm pack --dry-run` lists correct files

---

## FEATURE 12: Custom Rule Engine
**Priority: LOW | Files: commands/ezra/rules.md, hooks/ezra-rules-hook.js**

### What It Does
Lets users define custom governance rules in governance.yaml beyond protected paths.

### Implementation Details

**governance.yaml extension:**
```yaml
custom_rules:
  - id: max-file-lines
    description: "No file over 500 lines"
    type: file_size
    max_lines: 500
    severity: warning  # warning | error
    paths: ["src/**/*.ts", "src/**/*.js"]

  - id: require-auth-middleware
    description: "All API route files must import auth middleware"
    type: content_required
    pattern: "import.*authMiddleware|require.*authMiddleware"
    severity: error
    paths: ["src/routes/**/*.ts"]

  - id: no-console-log
    description: "No console.log in production code"
    type: content_forbidden
    pattern: "console\\.log\\("
    severity: warning
    paths: ["src/**/*.ts"]
    exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"]
```

**commands/ezra/rules.md:**
- `/ezra:rules` — List all custom rules with status
- `/ezra:rules check` — Run all custom rules against codebase
- `/ezra:rules add` — Interactive rule creation
- Rule types supported:
  - `file_size` — max lines per file
  - `content_required` — regex must match in specified paths
  - `content_forbidden` — regex must NOT match in specified paths
  - `file_required` — specific files must exist
  - `naming_convention` — file/directory naming patterns

**hooks/ezra-rules-hook.js** (PostToolUse):
- Fires on Write/Edit operations
- Checks the modified file against applicable custom rules
- Outputs warnings/errors via hook output

### Tests Required
- Rule engine parses governance.yaml custom_rules
- file_size rule correctly counts lines
- content_required rule matches regex
- content_forbidden rule catches violations
- Exclude patterns work correctly
- Missing rules section doesn't crash
- Invalid regex doesn't crash (graceful error)

---

## BUILD INSTRUCTIONS

### Execution Order
1. Features 1-3 first (Critical tier — AVI-OS bridge, CLAUDE.md, Bootstrap)
2. Features 4-6 next (High tier — Git hooks, Decision graph, Drift escalation)
3. Features 7-9 next (Medium tier — Portfolio, Handoff, Compliance)
4. Features 11-12 last (Low tier — NPM publish, Custom rules)
5. Feature 10 is documentation-only (VS Code roadmap note)

### For Each Feature
1. Implement the feature
2. Write tests following existing patterns (use the test() and assert() helpers from existing test files)
3. Add the test file to `tests/run-tests.js` SUITES array if it's a new file
4. Update `SKILL.md` to reference new commands
5. Update `help.md` to list new commands
6. Update `README.md` to document new features
7. Update `bin/cli.js` manifest to install new files
8. Run `node tests/run-tests.js` — must pass
9. Run `node tests/lint-all.js` — must pass
10. Run `node tests/test-e2e.js` — must pass
11. Run `node tests/test-uat.js` — must pass
12. Commit with descriptive message

### Quality Gates
- Zero dependencies (no npm install)
- All hooks must read from stdin (Claude Code protocol)
- All hooks must exit 0 on graceful failure
- All commands must handle missing .ezra/ directory
- All file paths must use `path.join()` (never string concatenation)
- All tests must work on Windows, macOS, and Linux
- Use `os.tmpdir()` instead of `/tmp`
- Use `process.platform === 'win32'` checks where needed
- No hardcoded paths

### Test Counts Target
- Current: 273 tests (186 unit + 42 lint + 21 E2E + 24 UAT)
- Target: 350+ tests after all features

### Definition of Done
- All existing 273 tests still pass
- All new feature tests pass
- Two consecutive all-green runs across all suites
- `git grep -i aegis` returns 0 results
- README.md updated with new features
- SKILL.md updated with new commands
- help.md updated with new commands
- bin/cli.js installs all new files
