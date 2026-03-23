# EZRA Self-Learning Specification

## Overview

EZRA's self-learning system enables continuous improvement of governance quality, agent oversight accuracy, and best practice recommendations based on observed patterns, agent performance data, and accumulated project intelligence.

## Core Principle

EZRA never forgets. Every decision, every violation, every agent output, every fix — all feed into a learning loop that makes governance smarter over time.

---

## 1. Learning Domains

### 1.1 Standards Effectiveness
- **What EZRA tracks:** Which custom rules produce the most violations, which get disabled, which get tightened
- **What EZRA learns:** Rule severity calibration — auto-suggest promoting frequently-triggered low-severity rules to medium, demoting rules that are always disabled
- **Storage:** `.ezra/learning/standards-effectiveness.yaml`

### 1.2 Agent Performance Profiles
- **What EZRA tracks:** Per-agent metrics — acceptance rate, revision rate, violation rate, speed, cost, task type success rates
- **What EZRA learns:** Which agent performs best for which task type, optimal agent-task routing
- **Storage:** `.ezra/learning/agent-profiles.yaml`

### 1.3 Violation Patterns
- **What EZRA tracks:** Recurring violations by file, by developer, by time-of-day, by task type
- **What EZRA learns:** Predictive violation detection — warn before the agent writes code in a known problem area
- **Storage:** `.ezra/learning/violation-patterns.yaml`

### 1.4 Project Health Trajectories
- **What EZRA tracks:** Health score trends across scans, correlation between actions and score changes
- **What EZRA learns:** Which remediation actions produce the largest health improvements — prioritise those in recommendations
- **Storage:** `.ezra/learning/health-trajectories.yaml`

### 1.5 Decision Impact Analysis
- **What EZRA tracks:** How decisions affect code quality, test coverage, security posture over time
- **What EZRA learns:** Which types of architectural decisions correlate with better outcomes — feed into advisor recommendations
- **Storage:** `.ezra/learning/decision-impact.yaml`

### 1.6 Workflow Optimisation
- **What EZRA tracks:** Process template execution times, step failure rates, skip rates, retry rates
- **What EZRA learns:** Optimal step ordering, which steps can be parallelised, which steps are bottlenecks
- **Storage:** `.ezra/learning/workflow-optimisation.yaml`

### 1.7 Cost Optimisation
- **What EZRA tracks:** API cost per task type per agent, quality-adjusted cost (cost per accepted output)
- **What EZRA learns:** Cost-optimal agent selection for each task category
- **Storage:** `.ezra/learning/cost-optimisation.yaml`

---

## 2. Learning Pipeline

### 2.1 Data Collection (Automatic)

Every EZRA operation generates learning data:

| Event | Data Captured | Trigger |
|-------|--------------|---------|
| Oversight violation | rule_id, severity, file, agent, accepted/rejected | PostToolUse hook |
| Agent task completion | agent, task_type, duration, tokens, cost, output_quality | Task completion |
| Code review | findings_count, severity_distribution, acceptance_rate | /ezra:review |
| Health scan | pillar_scores, delta_from_previous, actions_since_last | /ezra:health |
| Decision recorded | category, affected_files, subsequent_health_delta | /ezra:decide |
| Workflow execution | template, step_durations, failures, retries, total_time | /ezra:auto |
| Rule modification | rule_id, change_type (enable/disable/severity), user | /ezra:settings |

### 2.2 Analysis (Periodic)

Learning analysis runs on configurable schedule:

```yaml
# .ezra/settings.yaml
self_learning:
  enabled: true
  analysis_frequency: weekly    # daily | weekly | monthly | on_demand
  min_data_points: 10           # minimum observations before making recommendations
  confidence_threshold: 0.75    # minimum confidence to auto-suggest
  auto_apply: false             # if true, auto-applies low-risk optimisations
  domains:
    standards_effectiveness: true
    agent_profiles: true
    violation_patterns: true
    health_trajectories: true
    decision_impact: true
    workflow_optimisation: true
    cost_optimisation: true
```

### 2.3 Recommendation Generation

When analysis identifies a pattern above the confidence threshold:

1. EZRA generates a structured recommendation:
   ```yaml
   id: REC-042
   domain: agent_profiles
   confidence: 0.87
   observation: "Claude produces 23% fewer violations than Codex on security-related tasks"
   recommendation: "Route all security audit tasks to Claude (currently round-robin)"
   impact: "Estimated 23% reduction in security violations, $0.02 additional cost per task"
   action: "Update agents.task_routing.security_audit: claude"
   status: pending  # pending | accepted | rejected | auto-applied
   ```

2. If `auto_apply: false` → recommendation queued for user review via `/ezra:learn review`
3. If `auto_apply: true` and risk is low → applied automatically, logged to changelog

### 2.4 Feedback Loop

User actions on recommendations feed back into the learning system:

- **Accepted:** Increases confidence for similar patterns
- **Rejected:** Decreases confidence, adjusts thresholds for that domain
- **Modified:** EZRA learns the user's preferred calibration

---

## 3. Commands

### /ezra:learn

```
/ezra:learn                  Show learning summary — data points, recommendations, trends
/ezra:learn review           Review pending recommendations (accept/reject/modify each)
/ezra:learn agents           Show agent performance profiles with routing suggestions
/ezra:learn violations       Show violation pattern analysis and predictions
/ezra:learn health           Show health trajectory analysis and impact correlations
/ezra:learn workflows        Show workflow optimisation suggestions
/ezra:learn costs            Show cost analysis and budget optimisation recommendations
/ezra:learn reset <domain>   Clear learning data for a domain (requires confirmation)
/ezra:learn export           Export all learning data as structured YAML
```

---

## 4. State Directory

```
.ezra/learning/
├── standards-effectiveness.yaml
├── agent-profiles.yaml
├── violation-patterns.yaml
├── health-trajectories.yaml
├── decision-impact.yaml
├── workflow-optimisation.yaml
├── cost-optimisation.yaml
├── recommendations/
│   ├── pending/         # Awaiting user review
│   ├── accepted/        # Applied recommendations
│   └── rejected/        # Declined recommendations
└── meta.yaml            # Last analysis date, data point counts, config
```

---

## 5. Privacy and Data Scope

- All learning data is LOCAL to `.ezra/learning/` — never leaves the machine unless cloud_sync explicitly includes `learning` in sync_scope
- Learning data is project-specific — no cross-project learning by default
- Cross-project learning can be enabled via `/ezra:multi learn sync` (Team tier)
- Learning data can be reset at any time via `/ezra:learn reset`
- No PII is ever stored in learning data — only aggregated metrics, rule IDs, and agent identifiers

---

## 6. Settings Integration

```yaml
# .ezra/settings.yaml — self_learning section
self_learning:
  enabled: true
  analysis_frequency: weekly
  min_data_points: 10
  confidence_threshold: 0.75
  auto_apply: false
  report_on_scan: true          # include learning insights in /ezra:scan output
  report_on_dash: true          # show learning summary widget on /ezra:dash
  domains:
    standards_effectiveness: true
    agent_profiles: true
    violation_patterns: true
    health_trajectories: true
    decision_impact: true
    workflow_optimisation: true
    cost_optimisation: true
  cross_project:
    enabled: false              # Team tier only
    shared_domains: []          # Which domains to share across projects
```

---

## 7. Tier Availability

| Feature | Core | Pro | Team |
|---------|------|-----|------|
| Data collection | Yes | Yes | Yes |
| Local analysis | — | Yes | Yes |
| Recommendations | — | Yes | Yes |
| Auto-apply | — | Yes | Yes |
| /ezra:learn command | — | Yes | Yes |
| Cross-project learning | — | — | Yes |
| Learning dashboard widget | — | Yes | Yes |

---

## 8. Implementation Priority

Self-learning is **Phase 8** in the v6 roadmap (Weeks 8-10), built after:
- Phase 1: Real-Time Oversight (data collection hooks — prerequisite)
- Phase 2: Project Manager (analysis triggers)
- Phase 3: Settings System (configuration)
- Phase 5: Multi-Agent Orchestration (agent profiles data source)

The data collection hooks are embedded in Phase 1's oversight system — every violation logged to `.ezra/oversight/violations.log` is already a learning data point. Phase 8 adds the analysis engine on top of existing data.
