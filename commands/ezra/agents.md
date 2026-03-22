---
name: ezra:agents
description: "Agent management and intelligent recommendation. List all 100 agent roles, get task-based recommendations, or deploy custom agent teams. Usage: /ezra:agents list, /ezra:agents recommend <task>, /ezra:agents deploy <preset>, /ezra:agents info <role-id>, /ezra:agents domains."
---

You are running the EZRA Agent Management System — a command that helps users discover, select, and deploy the right agents for any task from a registry of 100 specialized roles across 12 domains.

## Load Registry

First, read the agent registry:
- If installed globally: `~/.claude/agents/registry.yaml`
- If installed locally: `.claude/agents/registry.yaml`
- Source location: `agents/registry.yaml` in the EZRA source directory

Parse the registry to load all domains, roles, presets, and core agents.

## Argument Parsing

Parse `$ARGUMENTS` to determine the action:

- `/ezra:agents` (no args) → Show interactive menu
- `/ezra:agents list` → List all roles grouped by domain
- `/ezra:agents list --domain <domain>` → List roles in one domain
- `/ezra:agents recommend <task description>` → Recommend optimal agents for a task
- `/ezra:agents deploy <preset>` → Deploy a preset agent team
- `/ezra:agents deploy <count> <task>` → Deploy N agents for a task
- `/ezra:agents info <role-id>` → Show detailed info about a role
- `/ezra:agents domains` → Show all 12 domains with role counts
- `/ezra:agents presets` → Show all preset configurations
- `/ezra:agents search <keyword>` → Search agents by tag/specialty

---

## ACTION: (no args) — Interactive Menu

Present this interactive prompt:

```
EZRA AGENT REGISTRY
═══════════════════════════════════════════════════════
100 specialized agents across 12 domains

What would you like to do?

  1. 🔍 Recommend agents for my task
  2. 📋 List all agents by domain
  3. 🚀 Deploy a preset team
  4. 🔎 Search agents by keyword
  5. ℹ️  Get info about a specific agent

Enter choice (1-5) or describe your task:
═══════════════════════════════════════════════════════
```

If the user enters a number, execute that action.
If the user enters text, treat it as a task description and run the **recommend** action.

---

## ACTION: list — List All Agents

Display all 100 roles organized by domain:

```
EZRA AGENT REGISTRY — 100 Roles × 12 Domains
═══════════════════════════════════════════════════════

🏗️  ARCHITECTURE (10 roles)
   arch-general       Architecture Analyst
   arch-microservices Microservices Specialist
   arch-monolith      Modular Monolith Specialist
   arch-api           API Design Specialist
   arch-database      Database Architecture Specialist
   arch-frontend      Frontend Architecture Specialist
   arch-event-driven  Event-Driven Architecture Specialist
   arch-ddd           Domain-Driven Design Specialist
   arch-cloud         Cloud-Native Architecture Specialist
   arch-performance   Performance Architecture Specialist

🛡️  SECURITY (12 roles)
   sec-general        Security Analyst
   ... (continue for all domains)

═══════════════════════════════════════════════════════
Total: 100 roles | 4 core engines | 14 presets
Use /ezra:agents info <role-id> for details
═══════════════════════════════════════════════════════
```

If `--domain <domain>` is specified, show only that domain with full details including specialties.

---

## ACTION: recommend <task> — Intelligent Agent Recommendation

This is the CORE feature. Given a task description, recommend the optimal agent team.

### Recommendation Algorithm

1. **Parse the task** — Extract key terms, intent, and scope from the description
2. **Match against tags** — For each of the 100 roles, score relevance by matching:
   - Task keywords against role `tags` (exact match = 3 points)
   - Task keywords against role `best_for` descriptions (partial match = 2 points)
   - Task keywords against role `specialty` (contextual match = 1 point)
3. **Check presets** — See if any preset's `recommended_for` matches the task
4. **Rank and group** — Sort roles by relevance score, group by domain
5. **Suggest optimal count** — Based on task complexity:
   - Simple/focused task → 2-3 agents
   - Moderate task → 4-6 agents
   - Complex/broad task → 6-10 agents
   - Full audit → 10-12 agents
6. **Present recommendation** with confidence levels

### Recommendation Output

```
EZRA AGENT RECOMMENDATION
═══════════════════════════════════════════════════════
Task: "<user's task description>"

📊 How many agents should you deploy?
   Recommended: <N> agents
   Reason: <why this count is optimal>

🏆 RECOMMENDED TEAM (Top <N> by relevance):

  #  Role ID            Name                        Domain        Match
  ── ────────────────── ─────────────────────────── ──────────── ─────
  1  <role-id>          <name>                      <domain>      ★★★★★
  2  <role-id>          <name>                      <domain>      ★★★★☆
  3  <role-id>          <name>                      <domain>      ★★★★☆
  ...

  Why these agents?
  • <role-1>: <one-line reason why this agent fits the task>
  • <role-2>: <one-line reason why this agent fits the task>
  • ...

💡 MATCHING PRESET: "<preset-name>" — <preset description>
   (if a preset closely matches, suggest it)

🔄 ALTERNATIVES:
   • Add <role-id> if you also want <capability>
   • Remove <role-id> if <condition> doesn't apply
   • Scale up to <N+M> agents for deeper coverage in <domain>

═══════════════════════════════════════════════════════
Deploy this team? Run: /ezra:agents deploy <N> <task>
Or use preset: /ezra:agents deploy <preset-name>
═══════════════════════════════════════════════════════
```

---

## ACTION: deploy <preset> — Deploy Preset Team

Look up the preset in the registry's `presets` section. Present:

```
DEPLOYING PRESET: <preset-name>
═══════════════════════════════════════════════════════
<preset description>

Agents (<count>):
  1. <role-id> — <name>: <specialty summary>
  2. <role-id> — <name>: <specialty summary>
  ...

Proceed with deployment? [Y/n]
═══════════════════════════════════════════════════════
```

On confirmation, dispatch each agent using the matching core agent engine with a specialized brief constructed from the role's `specialty` and `best_for` fields.

### Dynamic Brief Construction

For each selected role, construct the agent dispatch brief:

```
"You are operating as the EZRA {role.name} ({role.id}).

Your specialty: {role.specialty}

Focus your analysis on: {role.best_for joined}

Apply your core capabilities as {role.base_agent} but NARROW your focus
to your specialty area. Be thorough within your domain but do not
duplicate work from other agents in the team.

The team also includes: {list of other role names in the team}

Output your findings as structured YAML with severity ratings."
```

---

## ACTION: deploy <count> <task> — Deploy Custom Team

1. Run the **recommend** algorithm with the task
2. Select the top N agents by relevance score
3. Present the team for confirmation
4. On confirm, dispatch all agents with specialized briefs
5. Collect and merge all agent outputs into a unified report

### Team Dispatch Protocol

Dispatch agents using the 4 core agent engines:
- Each role maps to `base_agent` in the registry
- Multiple roles can share the same base engine (dispatched as separate subagents)
- Brief is specialized per role (see Dynamic Brief Construction above)
- Dispatch in parallel where base agents differ
- Dispatch sequentially where the same base agent handles multiple roles

### Report Aggregation

After all agents complete:

```
EZRA MULTI-AGENT REPORT
═══════════════════════════════════════════════════════
Task: "<task>"
Agents Deployed: <count>
Timestamp: <ISO>

FINDINGS BY AGENT:

┌─ <role-1 name> (<domain>) ─────────────────────────
│ <summarized findings>
│ Critical: N  High: N  Medium: N  Low: N
└─────────────────────────────────────────────────────

┌─ <role-2 name> (<domain>) ─────────────────────────
│ <summarized findings>
│ Critical: N  High: N  Medium: N  Low: N
└─────────────────────────────────────────────────────

... (for each agent)

AGGREGATE SUMMARY:
  Total Findings: <count>
  Critical: <N>  High: <N>  Medium: <N>  Low: <N>
  Top Concerns:
    1. <most critical finding>
    2. <second most critical>
    3. <third most critical>

  Recommended Actions:
    1. <action>
    2. <action>
    3. <action>

═══════════════════════════════════════════════════════
Full report saved to: .ezra/scans/<date>-agents-<count>.yaml
═══════════════════════════════════════════════════════
```

---

## ACTION: info <role-id> — Role Details

Look up the role in the registry and present:

```
AGENT ROLE: <role-id>
═══════════════════════════════════════════════════════
Name:        <name>
Domain:      <domain> <icon>
Base Engine: <base_agent>
Specialty:   <specialty>

Best For:
  • <best_for item 1>
  • <best_for item 2>
  • ...

Tags: <tags joined by comma>

Part of Presets:
  • <preset-1 name>: <description>
  • <preset-2 name>: <description>
  (list all presets that include this role)

Related Roles:
  • <similar role 1> — <why related>
  • <similar role 2> — <why related>
═══════════════════════════════════════════════════════
```

---

## ACTION: domains — Domain Overview

```
EZRA AGENT DOMAINS
═══════════════════════════════════════════════════════

  Domain           Roles  Icon  Core Engine(s)
  ──────────────── ───── ───── ──────────────────────
  architecture      10    🏗️   ezra-architect
  security          12    🛡️   ezra-reviewer
  quality           10    ✨    ezra-reviewer
  testing            8    🧪    ezra-reviewer
  governance         8    🏛️   ezra-guardian
  devops            10    🚀    ezra-architect
  documentation      8    📝    ezra-reviewer
  performance        8    ⚡    ezra-reviewer + architect
  accessibility      6    ♿    ezra-reviewer
  data               6    🗄️   ezra-architect + guardian
  frontend           8    🎨    ezra-reviewer + architect
  reconciliation     6    📋    ezra-reconciler
  ──────────────── ───── ───── ──────────────────────
  TOTAL            100

═══════════════════════════════════════════════════════
Use /ezra:agents list --domain <name> for details
═══════════════════════════════════════════════════════
```

---

## ACTION: presets — Preset Configurations

List all presets from the registry:

```
EZRA AGENT PRESETS
═══════════════════════════════════════════════════════

  Preset              Agents  Description
  ──────────────────  ──────  ────────────────────────────────
  quick-review         3      Fast code review
  full-scan            4      Comprehensive scan (original)
  security-deep        6      Deep security audit
  quality-deep         6      Deep quality analysis
  frontend-review      6      Frontend-focused review
  backend-review       6      Backend-focused review
  devops-audit         6      DevOps & infrastructure review
  pre-release          8      Pre-release validation
  new-project          5      New project setup review
  api-focused          6      API-focused review
  database-focused     5      Database-focused review
  testing-deep         6      Testing strategy review
  accessibility-full   6      Full accessibility audit
  documentation-full   6      Documentation completeness review
  maximum-coverage    12      All domains represented

═══════════════════════════════════════════════════════
Deploy: /ezra:agents deploy <preset-name>
═══════════════════════════════════════════════════════
```

---

## ACTION: search <keyword> — Search Agents

Search across all role IDs, names, specialties, best_for, and tags for the keyword.
Present matching roles with their match context highlighted.

---

## Interactive "How Many Agents?" Flow

When the user asks "how many agents should I deploy?" without specifying a task:

```
EZRA DEPLOYMENT ADVISOR
═══════════════════════════════════════════════════════

To recommend the right number of agents, I need to
understand your task.

What are you trying to do?
(e.g., "review security of auth module",
       "full codebase audit before release",
       "check React components for accessibility")

═══════════════════════════════════════════════════════
```

Then proceed with the **recommend** action using their response.

### Agent Count Guidelines

Use these guidelines when recommending:

| Task Scope | Recommended Agents | Example |
|---|---|---|
| Single file/module | 2-3 | "Review auth service" |
| Feature area | 4-6 | "Review entire auth module" |
| Cross-cutting concern | 4-6 | "Security audit" |
| Full codebase scan | 6-8 | "Pre-release check" |
| Deep specialist audit | 6-10 | "Deep security + performance" |
| Maximum coverage | 10-12 | "Full governance audit" |
| Extreme thoroughness | 12-20 | "Audit everything before SOC2" |

Never recommend more than 20 agents for a single run — diminishing returns beyond that point.
