---
name: ezra:bootstrap
description: One-command project onboarding. Scans, creates governance with sensible defaults, registers first ADR, runs health check, generates CLAUDE.md.
---

You are executing the EZRA Bootstrap command. This is the one-command project onboarding that replaces the manual init + configure workflow.

## Pre-flight Check

Check if `.ezra/` directory already exists:
- **If it does NOT exist:** proceed with full bootstrap (all phases)
- **If it DOES exist:** skip Phase 1 (init) and only run Phases 2-7 for any missing pieces (idempotent mode)

In idempotent mode, check each artifact and only create/update what is missing:
- governance.yaml exists? → Skip governance creation, but ensure defaults are applied
- decisions/ has ADR-001? → Skip ADR creation
- CLAUDE.md exists with EZRA markers? → Skip generation, or update if stale

## Phase 1: Initialize

Run the `/ezra:init` workflow internally:
1. Create `.ezra/` directory structure:
   ```
   .ezra/
   ├── decisions/
   ├── scans/
   ├── plans/
   ├── docs/
   ├── versions/
   ├── governance.yaml
   └── knowledge.yaml
   ```
2. Scan the codebase to detect language, framework, architecture pattern, layers, dependencies
3. Write `knowledge.yaml` with discovered state

## Phase 2: Auto-detect and Apply Governance Defaults

Read project files to detect the technology stack:

1. **Language detection:**
   - `package.json` exists → JavaScript/TypeScript
   - `tsconfig.json` exists → TypeScript (confirm)
   - `pyproject.toml` or `setup.py` or `requirements.txt` → Python
   - `go.mod` → Go
   - `Cargo.toml` → Rust
   - `pom.xml` or `build.gradle` → Java/Kotlin
   - `*.csproj` or `*.sln` → C#/.NET

2. **Framework detection:** Read the detected config file for framework hints (express, nestjs, fastify, django, flask, fastapi, gin, actix, spring, etc.)

3. **Write/update `governance.yaml`** with sensible defaults:

```yaml
version: 1
initialized: <ISO timestamp>
project:
  name: <from package.json or directory name>
  language: <detected>
  framework: <detected>

protected_paths:
  - pattern: "*.env*"
    reason: "Environment configuration — changes affect all environments"
  - pattern: "**/migrations/**"
    reason: "Database migrations — irreversible in production"
  - pattern: "**/*.secret"
    reason: "Secret files — sensitive data"
  - pattern: "**/keys/**"
    reason: "Cryptographic keys — security critical"
  - pattern: "docker-compose*.yml"
    reason: "Infrastructure definition — changes affect deployment"
  - pattern: "Dockerfile*"
    reason: "Container definition — changes affect build and deployment"

standards:
  # Applied based on detected language:
  # TypeScript: strict_types: true, no_any: true
  # Python: type_hints: recommended, docstrings: required
  # Go: go_vet: true, golint: true
  # Default: test_coverage_minimum: 80

enforcement:
  require_decision_for_protected_paths: true
  require_reconciliation_before_merge: false
  auto_scan_on_init: true
```

## Phase 3: Create ADR-001

Create the first architectural decision record at `.ezra/decisions/ADR-001.yaml`:

```yaml
id: ADR-001
status: ACTIVE
date: <ISO timestamp>
category: ARCHITECTURE
decision: "EZRA governance initialized for this project"
context: "Project bootstrap — establishing baseline governance with auto-detected architecture"
rationale: "Governance enables architectural decision tracking, drift detection, and compliance verification"
consequences:
  positive:
    - "All architectural changes are now tracked"
    - "Protected paths are enforced"
    - "Document drift is monitored"
  negative:
    - "Additional overhead for decision recording"
enforcement:
  affected_paths:
    - ".ezra/**"
  check_description: "EZRA state directory must remain intact"
  auto_enforced: true
supersedes: null
architecture_summary: "<2-3 line summary of detected architecture>"
```

## Phase 4: Run Health Check

Execute the `/ezra:health` workflow to establish a baseline health score:
- Assess all 5 pillars: On-Track, No Gaps, Clean, Secure, Best Practices
- Record the baseline score in `.ezra/versions/current.yaml`
- This becomes the reference point for future health comparisons

## Phase 5: Generate CLAUDE.md

Execute the `/ezra:claude-md` workflow (Feature 2) to generate a CLAUDE.md file:
- Uses the governance.yaml, knowledge.yaml, and ADR-001 just created
- Ensures every future Claude Code session starts with governance context

## Phase 6: Create Version Snapshot

Execute `/ezra:version snapshot bootstrap` to create the initial version checkpoint:
- Records the bootstrap event in the changelog
- Sets version to 1.0.0 as the governance baseline

## Phase 7: Present Summary

Display the bootstrap completion summary:

```
EZRA Bootstrap Complete
═══════════════════════════════════════════
Project: {name}
Language: {lang} | Framework: {framework}
Architecture: {pattern}
Protected paths: {count} configured
Standards: {list key standards applied}
Baseline health: {score}/100
ADR-001: Governance initialized
CLAUDE.md: Generated
Version: 1.0.0 (bootstrap snapshot)
═══════════════════════════════════════════

Next: Start coding. EZRA is watching.

Quick reference:
  /ezra:decide  — Record architectural decisions
  /ezra:scan    — Deep codebase analysis
  /ezra:guard   — Check before committing
  /ezra:status  — View governance health
  /ezra:help    — All commands
```

## Important Notes

- **Idempotent:** Safe to run multiple times. Existing state is preserved, only missing pieces are created.
- **Non-destructive:** Never overwrites existing decisions, scans, or user-modified governance config.
- **Auto-detect:** All defaults are based on detected project characteristics, not hardcoded assumptions.
- Do NOT ask for confirmation before starting. Execute all phases automatically.
- If any phase fails, continue with remaining phases and note the failure in the summary.
