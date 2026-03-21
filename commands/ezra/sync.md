---
name: ezra:sync
description: Sync EZRA governance state with avios-context MCP server. Reviews and processes pending sync items.
---

You are executing the EZRA AVI-OS Sync command. This command processes pending sync items between EZRA governance state and the avios-context MCP server.

## Phase 1: Check Configuration

1. Read `.ezra/governance.yaml` and check for `avios_integration` section
2. If not configured, display:
   ```
   EZRA SYNC — Not Configured
   ═══════════════════════════
   AVI-OS integration is not enabled.

   To enable, add to .ezra/governance.yaml:

   avios_integration:
     enabled: true
     project_id: "your-project-id"
     auto_sync: false
     sync_decisions: true
     sync_risks: true
     sync_sprint_items: false
   ```
3. If enabled, proceed to Phase 2

## Phase 2: Read Pending Items

1. Check `.ezra/.avios-sync/pending/` directory
2. Read all JSON files in the pending directory
3. If no pending items, display:
   ```
   EZRA SYNC — No Pending Items
   ═══════════════════════════════
   All governance state is in sync.
   Last check: <current timestamp>
   ```
4. If items exist, present them grouped by action type:
   ```
   EZRA SYNC — Pending Items
   ═══════════════════════════════

   DECISIONS (ready to sync):
     - ADR-005: Use Fastify for API layer [category: AD]
     - ADR-006: PostgreSQL for persistence [category: DD]

   RISKS (ready to sync):
     - 3 critical findings from scan 2026-03-19 [impact: HIGH]

   Proceed with sync? (Items will be sent to avios-context)
   ```

## Phase 3: Execute Sync

For each pending item, based on its `action` field:

1. **add_decision**: Call the avios-context MCP tool `avios_add_decision` with:
   - `project_id`: from the item
   - `category`: mapped category (AD, DD, SC, TC)
   - `decision`: decision text
   - `rationale`: rationale text
   - `status`: LOCKED

2. **add_risk** / **update_risk**: Call the avios-context MCP tool `avios_update_risk` or `avios_add_risk` with:
   - `project_id`: from the item
   - `category`: risk category
   - `description`: finding description
   - `impact`: HIGH/CRITICAL
   - `status`: OPEN

3. **add_sprint_item**: Call `avios_log_sprint_item` (future use)

After each successful sync:
- Move the JSON file from `.ezra/.avios-sync/pending/` to `.ezra/.avios-sync/completed/`
- Record the sync timestamp

## Phase 4: Report

Display sync results:
```
EZRA SYNC COMPLETE
═══════════════════════════════
Project: <project_id>
Timestamp: <ISO timestamp>

Results:
  <N> decisions synced
  <N> risks created/updated
  <N> failures (if any)

Pending: <remaining count> items
```

If any items failed, list the failures with error details so the user can investigate.

## Error Handling

- If avios-context MCP server is not available, inform the user:
  ```
  avios-context MCP server not reachable.
  Pending items preserved in .ezra/.avios-sync/pending/
  Re-run /ezra:sync when the server is available.
  ```
- Never delete pending items on failure — they remain for retry
- Always create the `.avios-sync/completed/` directory before moving files

Do NOT ask for confirmation before reading pending items. Only pause for confirmation before executing the actual sync (Phase 3).
