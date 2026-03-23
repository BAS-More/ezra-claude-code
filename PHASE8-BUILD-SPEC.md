# EZRA v6 Phase 8 Build Spec: Agent Memory System

## Context
Repo: C:\Dev\Ezra | Version: 6.0.0 | Branch: feat/v6-phase8-memory
Phases 1-7 merged.

## Critical Rules
1. ZERO external npm dependencies.
2. ALL GREEN before commit.
3. 'use strict' in all new JS files.

## What to Build

### 1. hooks/ezra-memory.js (~450 lines)
Agent memory engine with 5 layers: Key Facts, Briefing, Session Handoff, Knowledge Graph, Red Lines.

Exports: MEMORY_LAYERS, initMemory, loadKeyFacts, addKeyFact, removeKeyFact, getKeyFacts, generateBriefing, saveSessionHandoff, getSessionHistory, loadRedLines, addRedLine, checkAgainstRedLines, updateKnowledgeGraph, getRelevantContext

generateBriefing: reads key facts + last 10 decisions + last 5 handoffs + red lines + task context, outputs markdown to .ezra/memory/briefing.md

checkAgainstRedLines: keyword match against forbidden actions, returns { violation, violations[] }

Storage: .ezra/memory/ (key-facts.yaml, briefing.md, red-lines.yaml, sessions/, meta.yaml)

### 2. hooks/ezra-memory-hook.js (~200 lines)
PostToolUse hook. Checks writes against red lines. Denies on violation. Regenerates briefing on SessionStart.

### 3. commands/ezra/memory.md
/ezra:memory command with subcommands: facts, briefing, sessions, red-lines, knowledge, export, init

### 4. tests/test-v6-memory.js (~500+ lines)
15 test categories covering all exports, red line enforcement, briefing generation, session persistence.

### 5. Settings: add memory section to DEFAULTS + getMemory accessor
memory: { enabled: true, max_key_facts: 100, briefing_regeneration: 'on_state_change', session_history_depth: 20, red_lines_locked: true }

### 6. Update counts in structure tests, commands tests, runner, README, CLAUDE.md, help.md, SKILL.md
