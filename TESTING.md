# EZRA Test Strategy

## Overview

EZRA uses a custom zero-dependency test harness built on Node.js `assert`. All tests run cross-platform on Windows, macOS, and Linux across Node 16, 18, 20, and 22.

**Current stats:** 2,466 tests across 58 test files, 0 external test dependencies.

## Running Tests

```bash
# Run all test suites
node tests/run-tests.js

# Run a single suite
node tests/test-v6-guard.js

# Run linting
node tests/lint-all.js
```

Output format:
```
✅ Structure: 24 passed, 0 failed
✅ Commands: 48 passed, 0 failed
...
═══════════════════════════════════════════
  Total: 2466 tests │ 2466 passed │ 0 failed
  Result: ✅ ALL GREEN
═══════════════════════════════════════════
```

## Test Harness

Every test file follows the same pattern:

```javascript
'use strict';
const assert = require('assert');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name} — ${err.message}`);
  }
}

// Tests go here...

console.log(`  ${passed ? '✅' : '❌'} SuiteName: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

No test frameworks (Jest, Mocha, Vitest) — just Node.js `assert`.

## Test Categories

### Foundation (5 suites)

| Suite | File | Tests | Purpose |
|-------|------|-------|---------|
| Structure | `test-structure.js` | ~24 | Directory structure, file counts, critical files exist |
| Commands | `test-commands.js` | ~48 | Command frontmatter validation, cross-references, content checks |
| Hooks | `test-hooks.js` | ~44 | Hook syntax, stdin/stdout protocol, graceful failure |
| CLI | `test-cli.js` | ~20 | Installer copy/uninstall logic, manifest validation |
| Templates | `test-templates.js` | ~12 | Template YAML validation |

### Hook Unit Tests (22 suites — `test-v6-*`)

Each hook has a dedicated test suite that validates:
- Exported functions work correctly
- Edge cases (empty input, missing files, malformed data)
- Cross-platform path handling
- JSON stdin/stdout protocol compliance
- Graceful error handling (never crash, always exit 0)

| Suite | Hook Under Test | Key Coverage |
|-------|----------------|--------------|
| `test-v6-guard.js` | ezra-guard.js | Protected path matching, glob patterns, decision overrides |
| `test-v6-oversight.js` | ezra-oversight.js | Intervention levels, violation tracking, excluded paths |
| `test-v6-settings-writer.js` | ezra-settings-writer.js | Write-back to YAML, validation, merge logic |
| `test-v6-settings-roundtrip.js` | ezra-settings.js + writer | Read/write round-trip consistency |
| `test-v6-library.js` | ezra-library.js | Best practice library CRUD, search, categories |
| `test-v6-agents.js` | ezra-agents.js | Agent orchestration, role registry, assignment |
| `test-v6-agents-real.js` | ezra-agents.js | Real-world multi-agent scenarios |
| `test-v6-dashboard-data.js` | ezra-dashboard-data.js | Dashboard aggregation, export format |
| `test-v6-workflows.js` | ezra-workflows.js | Workflow template engine, step dependencies |
| `test-v6-memory.js` | ezra-memory.js | Key facts, red lines, briefings |
| `test-v6-planner.js` | ezra-planner.js | Planning pipeline, task decomposition |
| `test-v6-pm.js` | ezra-pm.js | Milestones, stall detection, escalation |
| `test-v6-license.js` | ezra-license.js | License validation, tier checks |
| `test-v6-http.js` | ezra-http.js | SSRF protection, URL validation |
| `test-v6-cloud-sync.js` | ezra-cloud-sync.js | Backup/restore, manifest integrity |
| `test-v6-dash-hook.js` | ezra-dash-hook.js | Session start dashboard output |
| `test-v6-drift-hook.js` | ezra-drift-hook.js | Drift counter, relevance rules |
| `test-v6-error-codes.js` | ezra-error-codes.js | Error catalog, formatting |
| `test-v6-hook-logger.js` | ezra-hook-logger.js | JSON-line logging, rotation |
| `test-v6-installer.js` | ezra-installer.js | Copy/uninstall file logic |
| `test-v6-memory-hook.js` | ezra-memory-hook.js | Auto-capture from tool output |
| `test-v6-progress-hook.js` | ezra-progress-hook.js | Progress tracking, milestones |
| `test-v6-tier-gate.js` | ezra-tier-gate.js | Tier enforcement per command |
| `test-v6-version-hook.js` | ezra-version-hook.js | Version tracking, changelog append |

### V7 Component Tests (18 suites — `test-v7-*`)

| Suite | Component | Key Coverage |
|-------|-----------|--------------|
| `test-v7-yaml-utils.js` | YAML parser/serializer | Parse, stringify, edge cases |
| `test-v7-event-bus.js` | Event bus | Pub/sub, namespaces, error isolation |
| `test-v7-project-definition.js` | Project definition | Schema validation, merging |
| `test-v7-bp-scheduler.js` | Best practice scheduler | Scheduling, priorities, dedup |
| `test-v7-doc-ingester.js` | Document ingester | Upload parsing, metadata extraction |
| `test-v7-phase-suggester.js` | Phase suggester | Phase recommendations |
| `test-v7-deploy-trigger.js` | Deploy trigger | Deployment conditions, gates |
| `test-v7-settings.js` | Settings engine | 3-layer merge, validation |
| `test-v7-execution-state.js` | Execution state | State machine, transitions |
| `test-v7-achievement-engine.js` | Achievement engine | Badge criteria, unlock logic |
| `test-v7-interview-engine.js` | Interview engine | Question flow, gap detection |
| `test-v7-agent-dispatcher.js` | Agent dispatcher | Task routing, load balancing |
| `test-v7-mah-client.js` | MAH client | Multi-agent hub communication |
| `test-v7-task-verifier.js` | Task verifier | Completion checks, quality gates |
| `test-v7-quiz2build-client.js` | Quiz2Build client | Assessment integration |
| `test-v7-phase-gate.js` | Phase gates | Gate scoring, pass/fail |
| `test-v7-commit-engine.js` | Commit engine | Commit analysis, PR detection |
| `test-v7-notifier.js` | Notifier | Notification routing, dedup |

### Integration & E2E (4 suites)

| Suite | File | Purpose |
|-------|------|---------|
| Integration | `test-v6-integration.js` | Cross-hook interaction (guard + oversight + settings) |
| E2E | `test-e2e.js` | Full flows in temp directories (init → guard → version) |
| UAT | `test-uat.js` | User acceptance scenarios (install, configure, scan cycle) |
| Lint | `lint-all.js` | Code quality: `'use strict'`, no `console.error` in hooks, proper exit codes |

## Writing New Tests

### For a new hook

1. Create `tests/test-v6-<feature>.js` (or `test-v7-` for v7 components)
2. Follow the test harness pattern above
3. Test all exported functions with normal input, edge cases, and error paths
4. Add the file to the suite list in `tests/run-tests.js`
5. Run `node tests/run-tests.js` — must be ALL GREEN

### Test isolation

- Each test creates its own temp directory via `os.tmpdir()` + `crypto.randomUUID()`
- Tests clean up after themselves (`fs.rmSync(tmpDir, { recursive: true })`)
- No test depends on another test's state
- No network calls — all tests run offline

### What to test

- **Every exported function** — normal input, empty input, malformed input
- **Hook protocol compliance** — valid JSON stdin → valid JSON stdout → exit 0
- **Cross-platform paths** — use `path.join()`, test with forward and backslash separators
- **Graceful failure** — hooks must never crash; verify they exit 0 on errors

## CI Pipeline

Tests run automatically on every push via GitHub Actions (`.github/workflows/ci.yml`):

- **Matrix:** 3 OS (ubuntu, macos, windows) x 3 Node versions (18, 20, 22)
- **9 total jobs** running in parallel
- All 2,466+ tests must pass on all 9 combinations

## Coverage Goals

- Every hook has a dedicated test suite
- Every command has frontmatter and content validation
- E2E tests cover the full init → scan → guard → version lifecycle
- UAT tests simulate real user workflows
- Target: 100% of exported functions tested, all edge cases covered
