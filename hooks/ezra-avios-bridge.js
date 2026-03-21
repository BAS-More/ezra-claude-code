#!/usr/bin/env node

/**
 * EZRA AVI-OS Integration Bridge
 *
 * PostToolUse hook for Write/Edit/MultiEdit operations.
 * Syncs EZRA governance state with avios-context MCP server.
 * When decisions are recorded or scans produce critical findings,
 * writes pending sync items to .ezra/.avios-sync/pending/.
 *
 * Non-blocking — always exits 0.
 *
 * Install: Add to settings.json under hooks.PostToolUse:
 * {
 *   "matcher": "Write|Edit|MultiEdit",
 *   "hooks": [{
 *     "type": "command",
 *     "command": "node <path>/ezra-avios-bridge.js",
 *     "timeout": 5
 *   }]
 * }
 */

const fs = require('fs');
const path = require('path');

// EZRA → avios-context category mapping
const CATEGORY_MAP = {
  'ARCHITECTURE': 'AD',
  'DATABASE': 'DD',
  'SECURITY': 'SC',
  'API': 'AD',
  'TESTING': 'TC',
  'INFRASTRUCTURE': 'AD',
  'DEPENDENCY': 'TC',
  'CONVENTION': 'TC',
};

function parseSimpleYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kvMatch = trimmed.match(/^([\w_-]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim().replace(/^["']|["']$/g, '');
      if (val) {
        result[key] = val === 'true' ? true : val === 'false' ? false : val;
        currentList = null;
      } else {
        result[key] = [];
        currentList = key;
      }
      currentKey = key;
    } else if (trimmed.startsWith('- ') && currentList) {
      result[currentList].push(trimmed.slice(2).trim());
    }
  }
  return result;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writePendingItem(cwd, item) {
  const pendingDir = path.join(cwd, '.ezra', '.avios-sync', 'pending');
  ensureDir(pendingDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${item.action}-${timestamp}.json`;
  fs.writeFileSync(path.join(pendingDir, filename), JSON.stringify(item, null, 2));
  return filename;
}

function mapCategory(ezraCategory) {
  return CATEGORY_MAP[String(ezraCategory).toUpperCase()] || 'AD';
}

function handleDecisionFile(cwd, filePath, governance) {
  try {
    const fullPath = path.resolve(cwd, filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    const parsed = parseSimpleYaml(content);

    const projectId = governance.project_id || governance.name || 'unknown';
    const item = {
      action: 'add_decision',
      project_id: projectId,
      category: mapCategory(parsed.category || 'ARCHITECTURE'),
      decision: parsed.decision || path.basename(filePath),
      rationale: parsed.rationale || parsed.context || '',
      status: 'LOCKED',
      source_file: filePath,
      timestamp: new Date().toISOString(),
    };

    return writePendingItem(cwd, item);
  } catch {
    return null;
  }
}

function handleScanFile(cwd, filePath, governance) {
  try {
    const fullPath = path.resolve(cwd, filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');

    // Look for CRITICAL or HIGH findings in scan results
    const criticalMatch = content.match(/severity:\s*(CRITICAL|HIGH)/gi);
    if (!criticalMatch || criticalMatch.length === 0) return null;

    const projectId = governance.project_id || governance.name || 'unknown';

    // Extract finding descriptions (best-effort from YAML/text)
    const descMatches = content.match(/description:\s*["']?(.+?)["']?\s*$/gm) || [];
    const descriptions = descMatches.map(d => d.replace(/description:\s*["']?/, '').replace(/["']?\s*$/, ''));

    const item = {
      action: 'add_risk',
      project_id: projectId,
      category: 'SECURITY',
      description: descriptions.length > 0
        ? descriptions.slice(0, 5).join('; ')
        : `${criticalMatch.length} critical/high findings in scan`,
      impact: 'HIGH',
      status: 'OPEN',
      finding_count: criticalMatch.length,
      source_file: filePath,
      timestamp: new Date().toISOString(),
    };

    return writePendingItem(cwd, item);
  } catch {
    return null;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || event.tool_input?.path || '';

    if (!filePath) {
      process.exit(0);
      return;
    }

    const cwd = event.cwd || process.cwd();
    const ezraDir = path.join(cwd, '.ezra');

    if (!fs.existsSync(ezraDir)) {
      process.exit(0);
      return;
    }

    const relativePath = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, '/');

    // Only care about .ezra/decisions/ and .ezra/scans/ writes
    const isDecision = relativePath.startsWith('.ezra/decisions/');
    const isScan = relativePath.startsWith('.ezra/scans/');

    if (!isDecision && !isScan) {
      process.exit(0);
      return;
    }

    // Read governance config — check if avios integration is enabled
    const govPath = path.join(cwd, '.ezra', 'governance.yaml');
    let aviosEnabled = false;
    let syncDecisions = true;
    let syncRisks = true;
    let projectId = 'unknown';

    if (fs.existsSync(govPath)) {
      const govContent = fs.readFileSync(govPath, 'utf8');
      aviosEnabled = /avios_integration:[\s\S]*?enabled:\s*true/m.test(govContent);
      syncDecisions = !/sync_decisions:\s*false/m.test(govContent);
      syncRisks = !/sync_risks:\s*false/m.test(govContent);
      const pidMatch = govContent.match(/project_id:\s*["']?([^"'\n]+)/);
      if (pidMatch) projectId = pidMatch[1].trim();
    }

    if (!aviosEnabled) {
      process.exit(0);
      return;
    }

    const govObj = { project_id: projectId, name: projectId };
    let syncedFile = null;

    if (isDecision && syncDecisions) {
      syncedFile = handleDecisionFile(cwd, relativePath, govObj);
    } else if (isScan && syncRisks) {
      syncedFile = handleScanFile(cwd, relativePath, govObj);
    }

    if (syncedFile) {
      const output = {
        hookSpecificOutput: {
          message: `EZRA: Queued avios-sync item: ${syncedFile}`,
        },
      };
      process.stdout.write(JSON.stringify(output));
    }

    process.exit(0);

  } catch (err) {
    // Never block work due to hook errors
    process.exit(0);
  }
});
