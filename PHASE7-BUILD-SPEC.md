# EZRA v6 Phase 7 Build Spec: Workflow Templates System

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase7-workflows
Phases 1-6 merged. Settings system with write-back, PM, library, agents, dashboard data all exist.

## Critical Rules
1. ZERO external npm dependencies.
2. ALL GREEN before commit.
3. 'use strict' in all new JS files.
4. Run `node tests/run-tests.js` after EVERY change.

## What to Build

### 1. NEW FILE: hooks/ezra-workflows.js (~500 lines)

Workflow template engine — loads, validates, and executes multi-step governance workflows.

**Exports:**
- `BUILT_IN_TEMPLATES` — array of 10 template definitions (name, steps, source, trigger, tier)
- `loadTemplate(projectDir, templateName)` — load a template by name (built-in or custom)
- `listTemplates(projectDir)` — list all available templates (built-in + custom)
- `executeStep(projectDir, template, stepIndex)` — execute a single step, return result
- `runWorkflow(projectDir, templateName, options)` — run full workflow (all steps in sequence)
- `getWorkflowStatus(projectDir, templateName)` — check status of a running/completed workflow
- `importTemplate(projectDir, markdownPath)` — parse a markdown file into a workflow template YAML
- `createCustomTemplate(projectDir, name, steps)` — create a custom workflow in .ezra/workflows/custom/
- `validateTemplate(template)` — validate template structure
- `getWorkflowHistory(projectDir)` — read execution history

**10 Built-in Templates (from spec):**

| Name | Steps | Source | Default Trigger |
|---|---|---|---|
| full-remediation | 8 | EZRA v5 | Manual or PM |
| release-prep | 6 | EZRA v5 | Manual or pre-release |
| sprint-close | 5 | EZRA v5 | Scheduled |
| security-audit | 7 | EZRA v5 | on_pr or scheduled |
| onboarding | 4 | EZRA v5 | On /ezra:init |
| pre-deployment-testing | 30+ | Avi's protocol | on_pr or on_deploy |
| post-deployment-testing | 25+ | Avi's protocol | on_deploy |
| deep-gap-analysis | 11 | Avi's protocol | Scheduled weekly |
| anti-drift-enforcement | 4 | Avi's protocol | on_commit always |
| github-azure-alignment | 6 | Avi's protocol | on_pr to main |

Each built-in template is defined as a JS object with:
```javascript
{ name, description, steps: [{ id, name, action, check_type, severity, autofix }], source, trigger, tier, version }
```

**Step action types:**
- `scan` — run a scan (health, security, gap)
- `check` — verify a condition (test pass, coverage threshold, no critical gaps)
- `generate` — produce output (report, changelog, documentation)
- `gate` — block if condition not met (approval required)
- `notify` — alert (log, dashboard, escalation)
- `custom` — run a user-defined script

**Workflow state stored in .ezra/workflows/:**
```
.ezra/workflows/
├── active/             # Currently running workflows
│   └── <name>-<timestamp>.yaml
├── history/            # Completed workflow logs
│   └── <name>-<timestamp>.yaml
├── custom/             # User-created templates
│   └── <name>.yaml
└── config.yaml         # Workflow configuration (triggers, gates)
```

**importTemplate logic:**
- Read markdown file
- Parse headings as step names
- Parse bullet points as step actions
- Extract any numbered lists as ordered steps
- Generate template YAML with inferred action types
- Save to .ezra/workflows/custom/

### 2. NEW FILE: commands/ezra/workflow.md

```
---
name: ezra:workflow
description: "Workflow template management — run, create, import, and monitor multi-step governance workflows."
---
```

**Subcommands:**
```
/ezra:workflow                    List all templates (built-in + custom) with status
/ezra:workflow run <name>         Run a workflow template
/ezra:workflow status             Show running workflow status
/ezra:workflow status <name>      Show specific workflow status
/ezra:workflow history            Show workflow execution history
/ezra:workflow create <name>      Create a custom workflow interactively
/ezra:workflow import <file>      Import a markdown file as a workflow template
/ezra:workflow templates          List built-in templates with step counts
/ezra:workflow describe <name>    Show all steps in a template
/ezra:workflow triggers           Show configured auto-triggers
/ezra:workflow triggers set       Configure auto-triggers (on_commit, on_pr, on_deploy, scheduled)
```

### 3. Update hooks/ezra-settings.js

Enhance `workflows` DEFAULTS:
```javascript
workflows: {
  active_templates: ['all'],
  custom_templates_dir: '.ezra/workflows/custom/',
  auto_run: {
    on_commit: ['anti-drift-enforcement'],
    on_pr: ['security-audit'],
    on_deploy: ['post-deployment-testing'],
    weekly: ['deep-gap-analysis'],
  },
  approval_gates: {
    'pre-deployment-testing': { require_green: true, block_deploy_on_fail: true },
  },
},
```

### 4. NEW FILE: tests/test-v6-workflows.js (~450+ lines)

**Test categories:**
1. BUILT_IN_TEMPLATES has exactly 10 entries with correct structure
2. Each template has valid steps with required fields
3. loadTemplate returns built-in by name
4. loadTemplate returns custom from .ezra/workflows/custom/
5. listTemplates shows both built-in and custom
6. validateTemplate rejects invalid structures
7. executeStep returns step result
8. runWorkflow executes all steps in sequence
9. getWorkflowStatus reads active/history
10. importTemplate parses markdown into template
11. createCustomTemplate writes to custom directory
12. getWorkflowHistory reads completed runs
13. Edge cases: missing template, empty steps, duplicate names

### 5. Update Existing Files
- Command count: +1 (workflow) — update structure, commands tests, README, CLAUDE.md, help.md, SKILL.md
- Hook count: +1 (ezra-workflows.js) — update structure test
- Add V6-Workflows test suite to runner

## Acceptance Criteria
1. ALL GREEN, 0 failures
2. 10 built-in templates defined with correct step counts
3. importTemplate converts markdown to valid template YAML
4. Workflow execution logs to history
5. Custom templates persist in .ezra/workflows/custom/
