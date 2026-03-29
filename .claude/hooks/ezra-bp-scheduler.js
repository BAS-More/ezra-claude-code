#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-bp-scheduler.js — Best Practice Scheduler for EZRA v7
 * Manages scheduled scraping of best practice sources.
 * ZERO external dependencies.
 */

const fs = require('fs');
const path = require('path');

const FREQUENCIES = ['daily', 'weekly', 'manual'];

// --- Simple YAML helpers (no external library) ---

function parseSimpleYaml(text) {
  const obj = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (val === 'null' || val === '~') { obj[key] = null; }
    else if (val === 'true') { obj[key] = true; }
    else if (val === 'false') { obj[key] = false; }
    else if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim();
      obj[key] = inner ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : [];
    } else if (!isNaN(val) && val !== '') { obj[key] = Number(val); }
    else { obj[key] = val.replace(/^['"]|['"]$/g, ''); }
  }
  return obj;
}

function toSimpleYaml(obj) {
  return Object.entries(obj).map(([k, v]) => {
    if (v === null || v === undefined) return `${k}: null`;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    if (Array.isArray(v)) return `${k}: [${v.map(s => `'${s}'`).join(', ')}]`;
    if (typeof v === 'number') return `${k}: ${v}`;
    return `${k}: '${String(v).replace(/'/g, "\\'")}'`;
  }).join('\n') + '\n';
}

function urlToSlug(url) {
  return url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// --- State management ---

function getSchedulerState(projectDir) {
  const statePath = path.join(projectDir, '.ezra', 'bp-scheduler.yaml');
  try {
    const text = fs.readFileSync(statePath, 'utf8');
    const parsed = parseSimpleYaml(text);
    return {
      last_run: parsed.last_run || null,
      frequency: parsed.frequency || 'weekly',
      auto_add: parsed.auto_add === true || parsed.auto_add === 'true',
      tech_filter: Array.isArray(parsed.tech_filter) ? parsed.tech_filter : []
    };
  } catch (_) {
    return { last_run: null, frequency: 'weekly', auto_add: false, tech_filter: [] };
  }
}

function saveSchedulerState(projectDir, state) {
  const dir = path.join(projectDir, '.ezra');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const statePath = path.join(dir, 'bp-scheduler.yaml');
  fs.writeFileSync(statePath, toSimpleYaml(state), 'utf8');
}

function isDue(state) {
  if (state.frequency === 'manual') return false;
  if (!state.last_run) return true;
  const last = new Date(state.last_run).getTime();
  if (isNaN(last)) return true;
  const elapsed = Date.now() - last;
  if (state.frequency === 'daily') return elapsed > 24 * 60 * 60 * 1000;
  if (state.frequency === 'weekly') return elapsed > 7 * 24 * 60 * 60 * 1000;
  return false;
}

// --- Fetch orchestration ---

function runScheduledFetch(projectDir) {
  const state = getSchedulerState(projectDir);
  if (!isDue(state)) {
    return Promise.resolve({ skipped: true, reason: `frequency is '${state.frequency}' and last_run is not due yet` });
  }
  let scraper;
  try { scraper = require('./ezra-scraper.js'); } catch (e) {
    return Promise.resolve({ skipped: true, reason: 'ezra-scraper.js not available: ' + e.message });
  }
  const pendingDir = path.join(projectDir, '.ezra', 'library', 'pending-review');
  if (!fs.existsSync(pendingDir)) fs.mkdirSync(pendingDir, { recursive: true });

  return scraper.scrapeForTech(state.tech_filter && state.tech_filter.length ? state.tech_filter : null)
    .then(results => {
      let fetched_count = 0;
      let errors = 0;
      for (const result of results) {
        if (result.error) { errors++; continue; }
        fetched_count++;
        const slug = urlToSlug(result.url);
        const entry = Object.assign({ status: 'pending' }, result);
        // Truncate content for storage
        if (entry.content && entry.content.length > 2000) {
          entry.content = entry.content.slice(0, 2000) + '...';
        }
        const filePath = path.join(pendingDir, slug + '.yaml');
        fs.writeFileSync(filePath, toSimpleYaml(entry), 'utf8');
      }
      state.last_run = new Date().toISOString();
      saveSchedulerState(projectDir, state);
      const pending_count = fs.readdirSync(pendingDir).filter(f => f.endsWith('.yaml')).length;
      return { run: true, fetched_count, pending_count, errors };
    });
}

// --- Pending entries ---

function getPendingEntries(projectDir) {
  const pendingDir = path.join(projectDir, '.ezra', 'library', 'pending-review');
  if (!fs.existsSync(pendingDir)) return [];
  return fs.readdirSync(pendingDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      try {
        const text = fs.readFileSync(path.join(pendingDir, f), 'utf8');
        return Object.assign({ _filename: f }, parseSimpleYaml(text));
      } catch (_) { return null; }
    })
    .filter(Boolean);
}

function approveEntry(projectDir, filename) {
  const pendingDir = path.join(projectDir, '.ezra', 'library', 'pending-review');
  const libraryDir = path.join(projectDir, '.ezra', 'library');
  const src = path.join(pendingDir, filename);
  if (!fs.existsSync(src)) throw new Error(`Pending entry not found: ${filename}`);
  if (!fs.existsSync(libraryDir)) fs.mkdirSync(libraryDir, { recursive: true });
  const text = fs.readFileSync(src, 'utf8');
  const entry = parseSimpleYaml(text);
  entry.status = 'approved';
  fs.writeFileSync(path.join(libraryDir, filename), toSimpleYaml(entry), 'utf8');
  fs.unlinkSync(src);
  return { approved: true, filename };
}

function rejectEntry(projectDir, filename) {
  const pendingDir = path.join(projectDir, '.ezra', 'library', 'pending-review');
  const filePath = path.join(pendingDir, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Pending entry not found: ${filename}`);
  fs.unlinkSync(filePath);
  return { rejected: true, filename };
}

// --- stdin/stdout hook protocol ---

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch (_) { data = {}; }
    const action = data.action || 'status';
    const projectDir = data.project_dir || process.cwd();

    function respond(result) {
      process.stdout.write(JSON.stringify({ ok: true, action, result }) + '\n');
      process.exit(0);
    }
    function fail(err) {
      process.stdout.write(JSON.stringify({ ok: false, action, error: err.message || String(err) }) + '\n');
      process.exit(0);
    }

    try {
      if (action === 'run') {
        runScheduledFetch(projectDir).then(respond).catch(fail);
      } else if (action === 'status') {
        const state = getSchedulerState(projectDir);
        respond({ state, is_due: isDue(state) });
      } else if (action === 'pending') {
        respond(getPendingEntries(projectDir));
      } else if (action === 'approve') {
        respond(approveEntry(projectDir, data.filename));
      } else if (action === 'reject') {
        respond(rejectEntry(projectDir, data.filename));
      } else {
        respond({ warning: `Unknown action '${action}'. Valid: run, status, pending, approve, reject` });
      }
    } catch (err) { fail(err); }
  });
}

module.exports = { getSchedulerState, saveSchedulerState, isDue, runScheduledFetch, getPendingEntries, approveEntry, rejectEntry, FREQUENCIES };
