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

- `hooks/` — Claude Code hooks (pre/post tool use, subcommand)
- `commands/ezra/` — Slash commands (markdown files)
- `tests/` — Test suites
- `bin/cli.js` — CLI entry point
- `skills/ezra/` — EZRA skill definition for Claude Code

## Questions?

Open a GitHub Discussion or Issue.
