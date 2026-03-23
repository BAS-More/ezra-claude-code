# EZRA v6 Phase 10 Build Spec: Licensing + Distribution

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase10-licensing
ALL previous phases (1-9) merged. This is the final phase before commercial launch.

## Critical Rules
1. ZERO external npm dependencies in core.
2. ALL GREEN before commit.
3. License checks must NEVER break Core tier functionality.
4. Core remains MIT forever — no license check, no phone-home, no telemetry.

## What to Build

### 1. hooks/ezra-license.js (~350 lines)
License management engine per AD-003: Core free forever, Pro/Team via license key.

Exports: LICENSE_TIERS, checkLicense, validateKey, getLicenseStatus, isFeatureAvailable, getCachedLicense, refreshLicense, FEATURE_TIER_MAP

LICENSE_TIERS:
- core: Free, MIT, no check required, all Core features
- pro: $29/user/mo, license key required, Stripe + Supabase validation
- team: $59/user/mo, license key + seat count, team management
- enterprise: Custom, contact sales

FEATURE_TIER_MAP: maps every feature to its required tier. Examples:
- oversight.level: core
- multi_agent: pro
- project_manager: team
- research_agent: pro
- cloud_sync: pro
- workflow_custom: core
- workflow_import: pro
- memory_system: pro
- planning_engine: pro
- dashboard: pro
- compliance_profiles: pro
- self_learning: pro
- cross_project_learning: team

checkLicense logic:
1. Read .ezra/settings.yaml licensing section
2. If tier === 'core' -> always valid, no check needed
3. If tier === 'pro' or 'team':
   a. Check .ezra/license-cache.json for cached validation
   b. If cache exists and < 30 days old -> use cached result
   c. If cache expired or missing -> return { valid: false, reason: 'cache_expired', action: 'revalidate' }
   d. Actual Supabase validation is handled by ezra-cloud (separate repo) — this just reads the cache
4. Return: { valid, tier, expires, features_available[], features_locked[] }

isFeatureAvailable: checks FEATURE_TIER_MAP against current license tier

validateKey: validates key format (starts with 'ezra_pro_' or 'ezra_team_' or 'ezra_ent_'), does NOT call external API (that's ezra-cloud)

Storage:
.ezra/license-cache.json — { key_hash, tier, validated_at, expires_at, seats, features }

### 2. hooks/ezra-tier-gate.js (~150 lines)
PreToolUse hook that checks feature tier before allowing Pro/Team features.

Behaviour:
- Read the command/feature being invoked
- Check isFeatureAvailable against current license
- If feature requires higher tier than current: return { permissionDecision: 'deny', reason: 'Requires EZRA Pro. Upgrade at ezra.dev/pricing' }
- Core features ALWAYS pass — never gated

### 3. commands/ezra/license.md
/ezra:license command with subcommands: status, activate <key>, deactivate, features, upgrade, refresh

### 4. hooks/ezra-installer.js (~300 lines)
CLI installer for EZRA — installs to Claude Code hooks directory.

Exports: install, uninstall, update, getInstallStatus, INSTALL_PATHS

install logic:
1. Detect Claude Code hooks directory (~/.claude/ or platform equivalent)
2. Copy hooks to hooks directory
3. Register in Claude Code settings.json
4. Create .ezra/ in target project if not exists
5. Run /ezra:init

getInstallStatus: checks if all hooks are registered and files exist

### 5. commands/ezra/install.md
/ezra:install — install EZRA into current project
/ezra:uninstall — remove EZRA hooks (preserves .ezra/ data)
/ezra:update — update EZRA to latest version

### 6. npm package.json updates
- Ensure bin/cli.js is set as npm bin entry
- Add "files" field listing what gets published
- Add "publishConfig" for npm
- Ensure README has installation instructions
- Add CHANGELOG.md entry for v6.0.0

### 7. tests/test-v6-license.js (~400+ lines)
Test categories:
1. LICENSE_TIERS has 4 entries
2. FEATURE_TIER_MAP covers all features
3. isFeatureAvailable correctly gates by tier
4. checkLicense reads cache
5. checkLicense handles expired cache
6. checkLicense always passes for core
7. validateKey accepts valid formats, rejects invalid
8. Tier gate hook blocks Pro features on Core
9. Tier gate hook allows Core features on Core
10. Tier gate hook allows Pro features on Pro
11. Installer detects platform paths
12. Edge cases: missing license file, corrupted cache, no settings

### 8. Settings: add licensing section to DEFAULTS + getLicensing accessor
licensing: { tier: 'core', license_key: null, offline_cache_days: 30 }

### 9. Update all reference files with final counts

## Acceptance Criteria
1. ALL GREEN, 0 failures
2. Core features NEVER blocked regardless of license state
3. Pro features blocked on Core with upgrade message
4. License cache mechanism works with 30-day expiry
5. npm package.json ready for `npm publish`
6. CHANGELOG.md has v6.0.0 entry
7. CLI installer works on current platform
