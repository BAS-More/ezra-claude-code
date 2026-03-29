#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-mah-client.js — Zero-dep HTTP client for MAH SDK integration.
 * Uses built-in http/https modules. ZERO external dependencies.
 * Hook protocol: reads JSON from stdin, writes JSON to stdout, exits 0.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const MAX_STDIN = 1024 * 1024; // 1 MB

// ─── Constants ───────────────────────────────────────────────────

const MAH_ENDPOINT_DEFAULT = 'http://localhost:3001';

// ─── Settings Reader ─────────────────────────────────────────────

/**
 * Reads .ezra/settings.yaml and returns the value at mah.endpoint,
 * or MAH_ENDPOINT_DEFAULT if not found.
 */
function getMahEndpoint(projectDir) {
  try {
    const settingsPath = path.join(projectDir, '.ezra', 'settings.yaml');
    if (!fs.existsSync(settingsPath)) return MAH_ENDPOINT_DEFAULT;
    const text = fs.readFileSync(settingsPath, 'utf8');
    let inMah = false;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trimEnd();
      if (/^mah\s*:/.test(line)) { inMah = true; continue; }
      if (inMah && /^\S/.test(line) && !/^mah\s*:/.test(line)) { inMah = false; }
      if (inMah && /^\s+endpoint\s*:\s*(.+)/.test(line)) {
        const val = line.replace(/^\s+endpoint\s*:\s*/, '').trim();
        return val.replace(/^['"]|['"]$/g, '') || MAH_ENDPOINT_DEFAULT;
      }
    }
  } catch (_) { /* fall through */ }
  return MAH_ENDPOINT_DEFAULT;
}

// ─── HTTP POST Helper ─────────────────────────────────────────────

/**
 * Low-level JSON POST using built-in http/https.
 * Falls back gracefully on network errors.
 */
function postJson(endpoint, urlPath, body) {
  return new Promise((resolve) => {
    let ezraHttp;
    try { ezraHttp = require('./ezra-http'); } catch (_) { ezraHttp = null; }

    if (ezraHttp && typeof ezraHttp.request === 'function') {
      ezraHttp.request(endpoint + urlPath, { method: 'POST', body: JSON.stringify(body) })
        .then(resolve)
        .catch((e) => resolve({ ok: false, error: e.message }));
      return;
    }

    // Built-in fallback
    const parsed = (() => { try { return new URL(endpoint + urlPath); } catch (_) { return null; } })();
    if (!parsed) { resolve({ ok: false, error: 'Invalid URL: ' + endpoint + urlPath }); return; }

    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ ok: true, status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ ok: true, status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: 'Request timeout' }); });
    req.write(payload);
    req.end();
  });
}

// ─── Exported Functions ───────────────────────────────────────────

async function routeTask(projectDir, task) {
  const endpoint = getMahEndpoint(projectDir);
  const payload = {
    task_id: task.task_id || task.id,
    title: task.title,
    agent_role: task.agent_role,
    description: task.description,
    acceptance_criteria: task.acceptance_criteria,
  };
  try {
    const res = await postJson(endpoint, '/tasks', payload);
    if (!res.ok) return { routed: false, error: res.error || 'HTTP ' + res.status };
    return { routed: true, result: res.body };
  } catch (e) {
    return { routed: false, error: e.message };
  }
}

async function routeSecurityAudit(projectDir, context) {
  const endpoint = getMahEndpoint(projectDir);
  try {
    const res = await postJson(endpoint, '/audit/security', context);
    if (!res.ok) return { routed: false, error: res.error || 'HTTP ' + res.status };
    return { routed: true, result: res.body };
  } catch (e) {
    return { routed: false, error: e.message };
  }
}

async function routeArchitectureReview(projectDir, context) {
  const endpoint = getMahEndpoint(projectDir);
  try {
    const res = await postJson(endpoint, '/audit/architecture', context);
    if (!res.ok) return { routed: false, error: res.error || 'HTTP ' + res.status };
    return { routed: true, result: res.body };
  } catch (e) {
    return { routed: false, error: e.message };
  }
}

async function routeDocumentParse(projectDir, filePath, mimeType) {
  const endpoint = getMahEndpoint(projectDir);
  try {
    const res = await postJson(endpoint, '/documents/parse', { file_path: filePath, mime_type: mimeType });
    if (!res.ok) return { routed: false, error: res.error || 'HTTP ' + res.status };
    return { routed: true, result: res.body };
  } catch (e) {
    return { routed: false, error: e.message };
  }
}

// ─── Hook Protocol ────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > MAX_STDIN) { raw = raw.slice(0, MAX_STDIN); }
  });
  process.stdin.on('end', async () => {
    let input = {};
    try { input = JSON.parse(raw || '{}'); } catch (_) { input = {}; }

    const action = input.action || '';
    const projectDir = input.project_dir || process.cwd();
    let output = {};

    try {
      if (action === 'route_task') {
        output = await routeTask(projectDir, input.task || {});
      } else if (action === 'security_audit') {
        output = await routeSecurityAudit(projectDir, input.context || {});
      } else if (action === 'architecture_review') {
        output = await routeArchitectureReview(projectDir, input.context || {});
      } else {
        output = { ok: false, error: 'Unknown action: ' + action };
      }
    } catch (e) {
      output = { ok: false, error: e.message };
    }

    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0);
  });
}

// ─── Exports ──────────────────────────────────────────────────────

module.exports = {
  MAH_ENDPOINT_DEFAULT,
  getMahEndpoint,
  routeTask,
  routeSecurityAudit,
  routeArchitectureReview,
  routeDocumentParse,
};
