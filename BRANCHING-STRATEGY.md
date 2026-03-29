# Branching Strategy

## Branch Model

EZRA uses a **trunk-based development** model with short-lived feature branches.

### Branches

| Branch | Purpose | Lifetime |
|--------|---------|----------|
| `main` | Production-ready code. Deployed automatically. | Permanent |
| `feat/<name>` | New features | Days (merge via PR) |
| `fix/<name>` | Bug fixes | Days (merge via PR) |
| `docs/<name>` | Documentation changes | Days (merge via PR) |
| `chore/<name>` | Maintenance, CI, tooling | Days (merge via PR) |

### Rules

1. **`main` is always deployable.** All tests must pass before merging.
2. **No long-lived branches.** Feature branches should be merged within a few days.
3. **Squash merge preferred** for clean history (one commit per feature/fix).
4. **Delete branches after merge.** No stale branches.

## Workflow

```
main ─────────────────────────────────────────────►
       \                    /
        feat/new-command ──► PR → review → merge
```

1. Create branch from `main`: `git checkout -b feat/my-feature`
2. Make changes, commit with conventional commits
3. Push and open a Pull Request
4. CI runs all 2,466+ tests on 9 matrix combinations
5. Review and squash merge into `main`
6. Delete the feature branch

## Commit Convention

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full commit convention:

- `feat(scope):` — new feature
- `fix(scope):` — bug fix
- `docs(scope):` — documentation
- `test(scope):` — tests
- `chore(scope):` — maintenance

## Release Process

EZRA uses semantic versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR** — breaking changes to hook protocol, command interface, or state schema
- **MINOR** — new commands, hooks, or features (backward compatible)
- **PATCH** — bug fixes and documentation updates

Releases are tagged on `main`: `git tag v6.1.0 && git push --tags`
