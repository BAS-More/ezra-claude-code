# Contributing to EZRA

Thank you for your interest in contributing to EZRA! This document provides guidelines for contributing to the project.

## Code Standards

- **Zero external dependencies.** EZRA uses only Node.js built-in modules.
- **`'use strict'`** at the top of every JavaScript file.
- **All tests must pass** before submitting a PR: `node tests/run-tests.js`
- Follow existing code patterns — read 2-3 existing hooks before writing new ones.

## How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `node tests/run-tests.js` — must be ALL GREEN
5. Commit with conventional commits: `feat(scope): description`
6. Push and open a Pull Request

## Commit Convention

- `feat(scope):` — new feature
- `fix(scope):` — bug fix
- `docs(scope):` — documentation only
- `test(scope):` — adding/fixing tests
- `chore(scope):` — maintenance, CI, dependencies

## Test Requirements

- Every new hook must have a corresponding test file in `tests/`
- Test file naming: `test-v6-<feature>.js`
- Use the existing test harness pattern (see any `test-v6-*.js` file)
- Target: comprehensive coverage of all exported functions + edge cases

## Architecture

```
commands/ezra/*.md   — Slash commands (YAML frontmatter + markdown prompt)
agents/*.md          — Subagent definitions (4 core agents)
hooks/*.js           — Node.js event hooks (stdin/stdout JSON protocol)
bin/cli.js           — Cross-platform CLI installer
templates/*.yaml     — Reusable workflow definitions
skills/ezra/SKILL.md — Skill definition for auto-triggering
tests/*.js           — Test suites (built-in assert only)
```

## Hook Protocol

All hooks follow the Claude Code hook protocol:
- Read JSON from stdin (tool_name, tool_input, cwd)
- Output JSON to stdout (hookSpecificOutput.message, hookSpecificOutput.permissionDecision)
- Always exit 0, even on error. Never block the user.
- Maximum 5-second execution time
- No external dependencies

## Security Rules

- No dynamic code execution
- No hardcoded secrets, API keys, or tokens
- All file paths via path.join() (no string concatenation)
- All home directory refs via os.homedir() (never ~ or $HOME)
- No unsanitized user input in child_process calls
- No console.error() in hooks (use process.stderr.write() if needed)

## Adding a New Command

1. Create commands/ezra/your-command.md with YAML frontmatter (name + description)
2. Write the prompt body in markdown below the frontmatter
3. Add the command to bin/cli.js showHelp()
4. Add validation in tests/test-commands.js
5. Update README.md command count

## Cross-Platform

- Use path.join() for all paths (never hardcode / or \)
- Use os.homedir() for home directory
- Use os.tmpdir() for temp files
- Use process.platform for platform detection
- Test on Windows, macOS, and Linux

## Questions?

Open a GitHub Discussion or Issue.
