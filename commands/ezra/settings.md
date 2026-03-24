---
name: ezra:settings
description: View and edit EZRA project settings. Manage standards, security, oversight, best practices, and workflow configuration.
---

# EZRA Settings — Unified Configuration Manager

You are managing the EZRA settings system. Settings are stored in `.ezra/settings.yaml` and control all aspects of EZRA governance behavior.

## Subcommands

Parse the user input to determine which subcommand they want. If no subcommand is given, default to `view all`.

### view all (default)

Display all current settings with their values:

1. Load settings using the settings parser (reads `.ezra/settings.yaml` merged with defaults)
2. Display each section with its key-value pairs
3. Mark any values that differ from defaults with an indicator

Output format:
```
EZRA SETTINGS
═══════════════════════════════════════════
standards:
  typescript_strict: true
  no_any: true
  naming: camelCase
  error_handling: explicit
  max_complexity: 10
  test_coverage_minimum: 80
  custom_rules: []

security:
  profile: standard
  require_auth_on_all_routes: false
  secrets_scanning: true
  input_validation: true
  rate_limiting: false
  custom_rules: []

oversight:
  enabled: true
  level: warn
  health_threshold: 75
  auto_pause_on_critical: true
  review_every_n_files: 5
  excluded_paths: [*.test.ts, *.spec.ts, docs/*]
  notify_on: [critical, high]

best_practices:
  enabled: true
  suggest_frequency: always
  domains: [architecture, security, quality, testing]
  auto_suggest: true

workflows:
  active_templates: []
  auto_run: false
  approval_gates: true
═══════════════════════════════════════════
Source: .ezra/settings.yaml (or defaults if no file)
```

### view <section>

Display settings for a specific section (standards, security, oversight, best_practices, workflows).

### set <key> <value>

Set a specific setting value:

1. Parse the key as `section.property` (e.g., `oversight.level warn`)
2. Validate the section exists
3. Read current settings.yaml
4. Update the value
5. Write back to settings.yaml
6. Confirm the change

Example: `/ezra:settings set oversight.level strict`

### init

Create a default `.ezra/settings.yaml` file:

1. Check if `.ezra/settings.yaml` already exists
2. If yes, confirm overwrite
3. Write all default settings as YAML
4. Confirm creation

### add-rule

Add a custom rule to standards or security:

1. Ask which section (standards or security)
2. Get the rule pattern (regex)
3. Get severity (critical, high, medium, low)
4. Get description message
5. Append to the appropriate custom_rules array in settings.yaml
6. Confirm addition

### remove-rule

Remove a custom rule from standards or security by index:

1. Specify the section (standards or security)
2. Specify the rule index to remove
3. The rule is removed from custom_rules array
4. Settings are written back to settings.yaml
5. Confirm removal

Example: `/ezra:settings remove-rule standards 0` removes the first custom rule from standards.

### reset

Reset settings to defaults:

1. **Ask for confirmation:** "This will reset all settings in this section to defaults. Type 'reset' to confirm."
2. Only proceed if user types exactly 'reset'
3. Write default settings to `.ezra/settings.yaml`
4. Confirm reset

### reset-all

Reset ALL settings to defaults:

1. **Ask for confirmation:** "This will reset ALL EZRA settings to factory defaults. Type 'reset all' to confirm."
2. Only proceed if user types exactly 'reset all'
3. Write complete default settings to `.ezra/settings.yaml`
4. Confirm reset

This restores every section to factory defaults.

### export

Export current settings as YAML to stdout for sharing or backup.

### diff

Show differences between current settings and defaults:

1. Load current settings
2. Compare with defaults
3. Show only values that differ

## Settings Sections

### standards
Controls code quality standards enforcement:
- `typescript_strict`: Enforce strict TypeScript mode
- `no_any`: Flag usage of the `any` type
- `naming`: Naming convention (camelCase, PascalCase, snake_case, kebab-case)
- `error_handling`: Error handling strategy (explicit, implicit)
- `max_complexity`: Maximum nesting depth before flagging
- `test_coverage_minimum`: Minimum test coverage percentage
- `custom_rules`: Array of custom regex patterns to check

### security
Controls security scanning:
- `profile`: Security profile (minimal, standard, strict, paranoid)
- `require_auth_on_all_routes`: Flag routes without auth middleware
- `secrets_scanning`: Enable hardcoded secrets detection
- `input_validation`: Flag missing input validation
- `rate_limiting`: Check for rate limiting on public endpoints
- `custom_rules`: Array of custom security patterns

### oversight
Controls real-time agent monitoring:
- `enabled`: Toggle oversight on/off
- `level`: Intervention level (monitor, warn, gate, strict)
- `health_threshold`: Minimum health score before alerting
- `auto_pause_on_critical`: Halt autonomous execution on critical violations
- `review_every_n_files`: Trigger review summary every N file changes
- `excluded_paths`: Glob patterns to skip during oversight
- `notify_on`: Severity levels that trigger notifications

### best_practices
Controls proactive suggestions:
- `enabled`: Toggle suggestions on/off
- `suggest_frequency`: How often to suggest (always, on-review, manual)
- `domains`: Which domains to suggest for
- `auto_suggest`: Automatically suggest during workflows

### workflows
Controls process engine behavior:
- `active_templates`: Currently active workflow templates
- `auto_run`: Allow automatic workflow execution
- `approval_gates`: Require approval at workflow gates

### hooks
Controls hook behavior:

```
/ezra:settings hooks             Show hook configuration status
/ezra:settings hooks --disable   Disable all hooks (adds "enabled: false" to settings)
/ezra:settings hooks --enable    Re-enable all hooks
```

When hooks are disabled, EZRA hooks still run but exit immediately without performing checks. This is useful for bulk operations or debugging.

## User Preferences

EZRA supports a `.ezra/preferences.yaml` file for personal defaults that are not shared with the team:

```yaml
# .ezra/preferences.yaml — Personal defaults (add to .gitignore)
defaults:
  agent_count: 6
  scan_preset: quick-review
  auto_guard: true
  oversight_level: warn
```

Preferences are lower priority than explicit `settings.yaml` values but override built-in defaults.

## Suggested Next Steps

After changing settings, suggest:
- Run `/ezra:oversight` to verify oversight configuration
- Run `/ezra:compliance check` to validate compliance rules
- Run `/ezra:health` to check impact on health score
