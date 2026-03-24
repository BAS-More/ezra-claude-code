# Cursor Compatibility Guide

> How to use EZRA governance inside [Cursor](https://cursor.sh), the AI-first VS Code fork.

---

## 1. Can Cursor Install VS Code Extensions?

**Yes.** Cursor is a fork of VS Code and retains full extension compatibility.

### Installing EZRA's VS Code Extension (.vsix)

1. Open Cursor.
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS).
3. Type **"Extensions: Install from VSIX…"** and select it.
4. Browse to the `ezra-vscode-6.0.0.vsix` file and confirm.
5. Reload when prompted.

The EZRA sidebar panel, status bar widget, and `.ezra/` file watcher will activate exactly as they do in VS Code.

### Marketplace Extensions

Cursor can also install extensions directly from the VS Code Marketplace via the Extensions sidebar (`Ctrl+Shift+X`). Search for "EZRA" once the extension is published.

### Known Differences

| Feature | VS Code | Cursor |
|---------|---------|--------|
| Extension panel | ✅ Full support | ✅ Full support |
| VSIX sideloading | ✅ | ✅ |
| Marketplace access | ✅ Native | ✅ Compatible |
| Settings sync | ✅ Microsoft account | ⚠️ Cursor's own sync |

---

## 2. Does Cursor Support Claude Code Hooks?

### Cursor Agent vs Claude Code

Cursor ships its own AI agent (Cursor Agent / Cursor Tab / Cursor Chat). It does **not** natively run Claude Code's hook protocol (the `settings.json` → `hooks` mechanism).

### Scenario A: Claude Code Running Inside Cursor

If you install Claude Code as a CLI tool and invoke it from Cursor's integrated terminal, **EZRA hooks work automatically** — they run in the Claude Code process, not in the editor.

```bash
# From Cursor's terminal:
claude          # Starts Claude Code — hooks fire normally
/ezra:scan      # EZRA commands work as expected
```

In this mode, all 12 EZRA hooks (guard, drift, dashboard, version, oversight, etc.) operate identically to VS Code.

### Scenario B: Cursor Agent Only (No Claude Code)

If you only use Cursor's built-in AI agent without Claude Code:

- **EZRA hooks will NOT fire** — they depend on Claude Code's hook protocol.
- **EZRA CLI commands still work** — run them manually from the terminal.
- **`.cursorrules` integration** — use the EZRA `.cursorrules` template (see Section 3) to enforce governance through Cursor's AI agent.

```bash
# CLI-only mode (no hooks, manual governance):
npx ezra-claude-code --claude --local   # Install commands + templates
node .ezra/scripts/scan.js              # Manual scan via CLI
```

### Summary

| Mode | Hooks | Commands | .cursorrules |
|------|-------|----------|-------------|
| Claude Code in Cursor terminal | ✅ | ✅ | Optional |
| Cursor Agent only | ❌ | ✅ (CLI) | ✅ Recommended |
| Both running | ✅ | ✅ | ✅ |

---

## 3. Cursor Rules Integration

Cursor supports `.cursorrules` files at the project root. These files instruct Cursor's AI agent on project-specific rules, conventions, and constraints.

EZRA provides a `.cursorrules` template that enforces governance through Cursor's agent.

### Installing the Template

```bash
# Copy the template to your project root:
cp node_modules/ezra-claude-code/templates/cursorrules-template .cursorrules

# Or if EZRA is installed globally:
cp ~/.claude/templates/cursorrules-template .cursorrules
```

### What the Template Enforces

The EZRA `.cursorrules` template instructs Cursor's AI agent to:

1. **Respect `.ezra/governance.yaml`** — never violate recorded architectural decisions.
2. **Check `.ezra/settings.yaml`** — honor oversight level, protected paths, and enforcement rules.
3. **Require scans before PR** — remind the developer to run `/ezra:scan` or `node tests/run-tests.js` before opening a pull request.
4. **Protect critical paths** — refuse to modify paths listed in `governance.yaml` without explicit confirmation.
5. **Reference decision records** — when making architectural changes, check `.ezra/decisions/` for existing ADRs.

### Customizing

Edit `.cursorrules` to add project-specific rules alongside the EZRA governance section. The template includes clear section markers for easy extension.

---

## 4. Installation Guide for Cursor Users

### Prerequisites

- [Cursor](https://cursor.sh) installed
- [Node.js](https://nodejs.org) >= 16.7.0
- Git (recommended)

### Step 1: Install EZRA CLI

```bash
# Install locally in your project:
npx ezra-claude-code --claude --local

# Or install globally:
npx ezra-claude-code --claude --global
```

### Step 2: Configure .cursorrules

```bash
# Copy the EZRA governance rules template:
cp node_modules/ezra-claude-code/templates/cursorrules-template .cursorrules
```

Review the file and add any project-specific rules below the EZRA section.

### Step 3: Initialize EZRA State

If this is a new project, initialize the `.ezra/` directory:

```bash
# If using Claude Code in terminal:
claude
/ezra:init

# Or manually create the state directory:
mkdir .ezra
```

### Step 4: Verify Governance

```bash
# Run the full test suite to confirm EZRA is healthy:
node tests/run-tests.js

# Check project health (requires Claude Code):
/ezra:health
```

### Step 5: Optional — Install VS Code Extension

For the sidebar dashboard and status bar widget:

1. Download `ezra-vscode-6.0.0.vsix`
2. `Ctrl+Shift+P` → "Extensions: Install from VSIX…"
3. Select the `.vsix` file

### Workflow Summary

| Step | Action | Result |
|------|--------|--------|
| 1 | `npx ezra-claude-code --claude --local` | Commands + hooks + templates installed |
| 2 | Copy `.cursorrules` template | Cursor Agent respects EZRA governance |
| 3 | `/ezra:init` or `mkdir .ezra` | State directory ready |
| 4 | `node tests/run-tests.js` | Verify everything passes |
| 5 | Install .vsix (optional) | Sidebar + status bar |

---

## FAQ

**Q: Does Cursor auto-detect `.cursorrules`?**
A: Yes. Cursor reads `.cursorrules` from the project root automatically when the folder is opened.

**Q: Can I use both Claude Code and Cursor Agent?**
A: Yes. Claude Code runs in the terminal with full hook support. Cursor Agent runs in the editor with `.cursorrules` support. They don't conflict.

**Q: Will EZRA's VS Code extension auto-update in Cursor?**
A: If installed via VSIX, you'll need to install new versions manually. Marketplace installs (when available) will auto-update.

**Q: Do I need `.cursorrules` if I'm using Claude Code?**
A: No — Claude Code uses EZRA's hooks and commands directly. `.cursorrules` is only needed if you want Cursor's built-in AI agent to also follow EZRA governance.
