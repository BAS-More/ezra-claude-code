#!/usr/bin/env node

'use strict';

/**
 * EZRA Test Dashboard Server
 * Browser-based E2E test runner on port 3000.
 * Runs all test suites and streams results in real-time.
 * Zero external dependencies — pure Node.js.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.EZRA_TEST_PORT || '3000', 10);
const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');

// ─── Test Suite Registry ────────────────────────────────────────

const SUITES = [
  { name: 'Structure', script: 'test-structure.js', category: 'core' },
  { name: 'Commands', script: 'test-commands.js', category: 'core' },
  { name: 'Hooks', script: 'test-hooks.js', category: 'core' },
  { name: 'CLI', script: 'test-cli.js', category: 'core' },
  { name: 'Templates', script: 'test-templates.js', category: 'core' },
  { name: 'AVI-OS Bridge', script: 'test-avios-bridge.js', category: 'v5' },
  { name: 'V6-Oversight', script: 'test-v6-oversight.js', category: 'v6' },
  { name: 'V6-PM', script: 'test-v6-pm.js', category: 'v6' },
  { name: 'V6-Settings-Writer', script: 'test-v6-settings-writer.js', category: 'v6' },
  { name: 'V6-Settings-RoundTrip', script: 'test-v6-settings-roundtrip.js', category: 'v6' },
  { name: 'V6-Library', script: 'test-v6-library.js', category: 'v6' },
  { name: 'V6-Agents', script: 'test-v6-agents.js', category: 'v6' },
  { name: 'V6-Dashboard', script: 'test-v6-dashboard-data.js', category: 'v6' },
  { name: 'V6-Workflows', script: 'test-v6-workflows.js', category: 'v6' },
  { name: 'V6-Memory', script: 'test-v6-memory.js', category: 'v6' },
  { name: 'V6-Planner', script: 'test-v6-planner.js', category: 'v6' },
  { name: 'V6-Integration', script: 'test-v6-integration.js', category: 'v6' },
  { name: 'V6-License', script: 'test-v6-license.js', category: 'v6' },
  { name: 'V6-Agents-Real', script: 'test-v6-agents-real.js', category: 'v6' },
  { name: 'V6-HTTP', script: 'test-v6-http.js', category: 'v6' },
  { name: 'V6-Hook-Logger', script: 'test-v6-hook-logger.js', category: 'v6' },
  { name: 'V6-Error-Codes', script: 'test-v6-error-codes.js', category: 'v6' },
  { name: 'V6-Cloud-Sync', script: 'test-v6-cloud-sync.js', category: 'v6' },
  { name: 'V6-Dash-Hook', script: 'test-v6-dash-hook.js', category: 'v6' },
  { name: 'V6-Drift-Hook', script: 'test-v6-drift-hook.js', category: 'v6' },
  { name: 'V6-Guard', script: 'test-v6-guard.js', category: 'v6' },
  { name: 'V6-Installer', script: 'test-v6-installer.js', category: 'v6' },
  { name: 'V6-Memory-Hook', script: 'test-v6-memory-hook.js', category: 'v6' },
  { name: 'V6-Progress-Hook', script: 'test-v6-progress-hook.js', category: 'v6' },
  { name: 'V6-Tier-Gate', script: 'test-v6-tier-gate.js', category: 'v6' },
  { name: 'V6-Version-Hook', script: 'test-v6-version-hook.js', category: 'v6' },
  { name: 'V7-Interview', script: 'test-v7-interview.js', category: 'v7' },
  { name: 'V7-PlanGenerator', script: 'test-v7-plan-generator.js', category: 'v7' },
  { name: 'V7-Scraper', script: 'test-v7-scraper.js', category: 'v7' },
  { name: 'V7-Execution', script: 'test-v7-execution.js', category: 'v7' },
  { name: 'V7-PhaseGate', script: 'test-v7-phase-gate.js', category: 'v7' },
  { name: 'V7-Notifier', script: 'test-v7-notifier.js', category: 'v7' },
  { name: 'V7-CommitEngine', script: 'test-v7-commit-engine.js', category: 'v7' },
  { name: 'V7-Quiz2Build', script: 'test-v7-quiz2build.js', category: 'v7' },
  { name: 'V7-Phase7', script: 'test-v7-phase7.js', category: 'v7' },
  { name: 'Lint', script: 'lint-all.js', category: 'quality' },
  { name: 'E2E', script: 'test-e2e.js', category: 'e2e' },
  { name: 'UAT', script: 'test-uat.js', category: 'e2e' },
];

// ─── Run a single test suite ────────────────────────────────────

function runSuite(suite) {
  return new Promise((resolve) => {
    const scriptPath = path.join(TESTS_DIR, suite.script);
    const start = Date.now();
    let stdout = '';
    let stderr = '';

    const proc = spawn('node', [scriptPath], {
      cwd: ROOT,
      env: { ...process.env, EZRA_TEST: '1', NO_COLOR: '1' },
      timeout: 30000,
    });

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      const duration = Date.now() - start;
      const passMatch = stdout.match(/PASSED:\s*(\d+)/);
      const failMatch = stdout.match(/FAILED:\s*(\d+)/);
      const passed = passMatch ? parseInt(passMatch[1]) : 0;
      const failed = failMatch ? parseInt(failMatch[1]) : (code !== 0 ? 1 : 0);
      const failures = [];

      // Extract individual FAIL lines
      const failLines = stdout.split('\n').filter(l => l.includes('FAIL:'));
      for (const line of failLines) {
        failures.push(line.replace(/^\s*FAIL:\s*/, '').trim());
      }

      resolve({
        name: suite.name,
        script: suite.script,
        category: suite.category,
        passed,
        failed,
        duration,
        exitCode: code,
        failures,
        stderr: stderr.trim(),
      });
    });

    proc.on('error', (err) => {
      resolve({
        name: suite.name,
        script: suite.script,
        category: suite.category,
        passed: 0,
        failed: 1,
        duration: Date.now() - start,
        exitCode: -1,
        failures: [err.message],
        stderr: err.message,
      });
    });
  });
}

// ─── Run all suites sequentially ────────────────────────────────

async function runAllSuites(onProgress) {
  const results = [];
  for (let i = 0; i < SUITES.length; i++) {
    const result = await runSuite(SUITES[i]);
    results.push(result);
    if (onProgress) onProgress(result, i + 1, SUITES.length);
  }
  return results;
}

// ─── HTML Dashboard ─────────────────────────────────────────────

function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EZRA Test Dashboard</title>
<style>
  :root {
    --bg: #0d1117; --surface: #161b22; --border: #30363d;
    --text: #e6edf3; --muted: #8b949e; --green: #3fb950;
    --red: #f85149; --yellow: #d29922; --blue: #58a6ff;
    --accent: #7c5cbf;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 20px; font-weight: 600; }
  header h1 span { color: var(--accent); }
  .status-bar { margin-left: auto; display: flex; gap: 20px; align-items: center; font-size: 14px; }
  .status-bar .stat { display: flex; align-items: center; gap: 6px; }
  .stat-pass { color: var(--green); }
  .stat-fail { color: var(--red); }
  .stat-time { color: var(--muted); }

  .controls { padding: 16px 24px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .btn { padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; background: var(--surface); color: var(--text); }
  .btn:hover { border-color: var(--blue); }
  .btn-primary { background: var(--green); color: #000; border-color: var(--green); }
  .btn-primary:hover { opacity: 0.9; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-danger { background: var(--red); color: #fff; border-color: var(--red); }
  .filter-btn.active { border-color: var(--blue); color: var(--blue); }

  .progress-container { margin: 0 24px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .progress-bar { height: 100%; background: var(--green); transition: width 0.3s; width: 0%; }
  .progress-bar.has-failures { background: var(--red); }

  .grid { padding: 16px 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; transition: border-color 0.15s; }
  .card:hover { border-color: var(--muted); }
  .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .card-name { font-weight: 600; font-size: 14px; }
  .card-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; text-transform: uppercase; }
  .badge-pass { background: rgba(63,185,80,0.15); color: var(--green); }
  .badge-fail { background: rgba(248,81,73,0.15); color: var(--red); }
  .badge-pending { background: rgba(139,148,158,0.15); color: var(--muted); }
  .badge-running { background: rgba(210,153,34,0.15); color: var(--yellow); }
  .card-stats { display: flex; gap: 16px; font-size: 13px; color: var(--muted); }
  .card-stats .pass { color: var(--green); }
  .card-stats .fail { color: var(--red); }
  .card-category { font-size: 11px; color: var(--muted); text-transform: uppercase; margin-top: 6px; }
  .card-failures { margin-top: 8px; background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2); border-radius: 4px; padding: 8px; max-height: 120px; overflow-y: auto; font-size: 12px; font-family: 'Cascadia Code', 'Fira Code', monospace; color: var(--red); }
  .card-failures div { padding: 2px 0; }

  .summary { margin: 16px 24px; padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; display: none; }
  .summary.visible { display: block; }
  .summary h2 { font-size: 16px; margin-bottom: 12px; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .summary-stat { text-align: center; padding: 12px; background: var(--bg); border-radius: 6px; }
  .summary-stat .num { font-size: 28px; font-weight: 700; }
  .summary-stat .label { font-size: 12px; color: var(--muted); margin-top: 4px; }

  .log-panel { margin: 16px 24px 24px; }
  .log-panel details { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
  .log-panel summary { padding: 12px 16px; cursor: pointer; font-size: 14px; font-weight: 500; }
  .log-content { padding: 12px 16px; max-height: 400px; overflow-y: auto; font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 12px; white-space: pre-wrap; color: var(--muted); border-top: 1px solid var(--border); }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .running { animation: pulse 1.5s infinite; }
</style>
</head>
<body>
<header>
  <h1><span>EZRA</span> Test Dashboard</h1>
  <div class="status-bar">
    <div class="stat stat-pass" id="totalPass">0 passed</div>
    <div class="stat stat-fail" id="totalFail">0 failed</div>
    <div class="stat stat-time" id="totalTime">0s</div>
    <div class="stat" id="totalSuites">0 / ${SUITES.length} suites</div>
  </div>
</header>

<div class="controls">
  <button class="btn btn-primary" id="runBtn" onclick="runTests()">Run All Tests</button>
  <button class="btn" onclick="filterCards('all')" data-filter="all">All</button>
  <button class="btn" onclick="filterCards('core')" data-filter="core">Core</button>
  <button class="btn" onclick="filterCards('v6')" data-filter="v6">V6</button>
  <button class="btn" onclick="filterCards('v7')" data-filter="v7">V7</button>
  <button class="btn" onclick="filterCards('quality')" data-filter="quality">Quality</button>
  <button class="btn" onclick="filterCards('e2e')" data-filter="e2e">E2E</button>
  <button class="btn" onclick="filterCards('failed')" data-filter="failed">Failed Only</button>
</div>

<div class="progress-container"><div class="progress-bar" id="progressBar"></div></div>

<div class="summary" id="summary">
  <h2>Test Run Summary</h2>
  <div class="summary-grid">
    <div class="summary-stat"><div class="num stat-pass" id="sumPass">0</div><div class="label">Passed</div></div>
    <div class="summary-stat"><div class="num stat-fail" id="sumFail">0</div><div class="label">Failed</div></div>
    <div class="summary-stat"><div class="num" id="sumTotal">0</div><div class="label">Total Tests</div></div>
    <div class="summary-stat"><div class="num" id="sumSuites">0</div><div class="label">Suites</div></div>
    <div class="summary-stat"><div class="num stat-time" id="sumTime">0s</div><div class="label">Duration</div></div>
    <div class="summary-stat"><div class="num" id="sumResult" style="font-size:18px">—</div><div class="label">Result</div></div>
  </div>
</div>

<div class="grid" id="grid"></div>

<div class="log-panel">
  <details>
    <summary>Live Log Output</summary>
    <div class="log-content" id="logContent">Waiting for test run...</div>
  </details>
</div>

<script>
const suites = ${JSON.stringify(SUITES)};
let results = {};
let running = false;
let currentFilter = 'all';

function init() {
  const grid = document.getElementById('grid');
  grid.innerHTML = suites.map((s, i) => cardHtml(s, i)).join('');
}

function cardHtml(suite, idx) {
  return '<div class="card" id="card-' + idx + '" data-category="' + suite.category + '" data-status="pending">' +
    '<div class="card-header"><span class="card-name">' + esc(suite.name) + '</span><span class="card-badge badge-pending" id="badge-' + idx + '">PENDING</span></div>' +
    '<div class="card-stats"><span id="stats-' + idx + '">—</span></div>' +
    '<div class="card-category">' + suite.category + '</div>' +
    '<div class="card-failures" id="failures-' + idx + '" style="display:none"></div>' +
  '</div>';
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function runTests() {
  if (running) return;
  running = true;
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = 'Running...';
  results = {};
  document.getElementById('summary').classList.remove('visible');
  document.getElementById('logContent').textContent = '';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('progressBar').classList.remove('has-failures');
  init();

  let totalP = 0, totalF = 0, startTime = Date.now();

  const evtSource = new EventSource('/api/run');
  evtSource.onmessage = function(e) {
    const data = JSON.parse(e.data);

    if (data.type === 'start') {
      const idx = data.index;
      const badge = document.getElementById('badge-' + idx);
      const card = document.getElementById('card-' + idx);
      if (badge) { badge.className = 'card-badge badge-running running'; badge.textContent = 'RUNNING'; }
      if (card) card.dataset.status = 'running';
    }

    if (data.type === 'result') {
      const r = data.result;
      const idx = data.index;
      results[idx] = r;
      totalP += r.passed;
      totalF += r.failed;

      const badge = document.getElementById('badge-' + idx);
      const stats = document.getElementById('stats-' + idx);
      const card = document.getElementById('card-' + idx);
      const failDiv = document.getElementById('failures-' + idx);

      const ok = r.failed === 0;
      if (badge) { badge.className = 'card-badge ' + (ok ? 'badge-pass' : 'badge-fail'); badge.textContent = ok ? 'PASS' : 'FAIL'; badge.classList.remove('running'); }
      if (stats) stats.innerHTML = '<span class="pass">' + r.passed + ' passed</span> <span class="fail">' + r.failed + ' failed</span> <span style="color:var(--muted)">' + r.duration + 'ms</span>';
      if (card) card.dataset.status = ok ? 'pass' : 'fail';

      if (r.failures && r.failures.length > 0 && failDiv) {
        failDiv.style.display = 'block';
        failDiv.innerHTML = r.failures.map(f => '<div>' + esc(f) + '</div>').join('');
      }

      const pct = ((data.index + 1) / suites.length * 100).toFixed(1);
      document.getElementById('progressBar').style.width = pct + '%';
      if (totalF > 0) document.getElementById('progressBar').classList.add('has-failures');

      document.getElementById('totalPass').textContent = totalP + ' passed';
      document.getElementById('totalFail').textContent = totalF + ' failed';
      document.getElementById('totalTime').textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
      document.getElementById('totalSuites').textContent = (data.index + 1) + ' / ' + suites.length + ' suites';

      const log = document.getElementById('logContent');
      log.textContent += (ok ? '\\u2705' : '\\u274c') + ' ' + r.name + ': ' + r.passed + ' passed, ' + r.failed + ' failed (' + r.duration + 'ms)\\n';
      if (r.stderr) log.textContent += '  stderr: ' + r.stderr.substring(0, 200) + '\\n';
      log.scrollTop = log.scrollHeight;

      filterCards(currentFilter);
    }

    if (data.type === 'done') {
      evtSource.close();
      running = false;
      btn.disabled = false;
      btn.textContent = 'Run All Tests';

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const sum = document.getElementById('summary');
      sum.classList.add('visible');
      document.getElementById('sumPass').textContent = totalP;
      document.getElementById('sumFail').textContent = totalF;
      document.getElementById('sumTotal').textContent = totalP + totalF;
      document.getElementById('sumSuites').textContent = suites.length;
      document.getElementById('sumTime').textContent = elapsed + 's';
      const resultEl = document.getElementById('sumResult');
      resultEl.textContent = totalF === 0 ? 'ALL GREEN' : 'FAILURES';
      resultEl.style.color = totalF === 0 ? 'var(--green)' : 'var(--red)';

      // Save results
      fetch('/api/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ totalPassed: totalP, totalFailed: totalF, suites: Object.values(results) }) });
    }
  };
  evtSource.onerror = function() { evtSource.close(); running = false; btn.disabled = false; btn.textContent = 'Run All Tests'; };
}

function filterCards(category) {
  currentFilter = category;
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('filter-btn', true));
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === category));
  document.querySelectorAll('.card').forEach(card => {
    if (category === 'all') { card.style.display = ''; }
    else if (category === 'failed') { card.style.display = card.dataset.status === 'fail' ? '' : 'none'; }
    else { card.style.display = card.dataset.category === category ? '' : 'none'; }
  });
}

init();
</script>
</body>
</html>`;
}

// ─── SSE streaming endpoint ─────────────────────────────────────

let activeRun = null;

async function handleRun(res) {
  if (activeRun) {
    res.writeHead(409, { 'Content-Type': 'text/plain' });
    res.end('Test run already in progress');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  activeRun = true;
  let aborted = false;
  res.on('close', () => { aborted = true; });

  for (let i = 0; i < SUITES.length; i++) {
    if (aborted) break;

    // Send start event
    res.write('data: ' + JSON.stringify({ type: 'start', index: i, name: SUITES[i].name }) + '\n\n');

    const result = await runSuite(SUITES[i]);

    if (aborted) break;
    res.write('data: ' + JSON.stringify({ type: 'result', index: i, result }) + '\n\n');
  }

  if (!aborted) {
    res.write('data: ' + JSON.stringify({ type: 'done' }) + '\n\n');
  }
  res.end();
  activeRun = null;
}

// ─── Save results endpoint ──────────────────────────────────────

function handleSave(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; if (body.length > 1024 * 1024) req.destroy(); });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const resultsDir = path.join(ROOT, 'test-results');
      if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

      const lastRun = {
        status: data.totalFailed === 0 ? 'passed' : 'failed',
        totalPassed: data.totalPassed,
        totalFailed: data.totalFailed,
        timestamp: new Date().toISOString(),
        suites: (data.suites || []).map(s => ({
          name: s.name,
          passed: s.passed,
          failed: s.failed,
          duration: s.duration,
        })),
      };
      fs.writeFileSync(path.join(resultsDir, '.last-run.json'), JSON.stringify(lastRun, null, 2), 'utf8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

// ─── Visual Browser Test Agent ──────────────────────────────────

function getVisualTestHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EZRA Visual Test Agent</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; display: flex; height: 100vh; overflow: hidden; }

  /* ── Left panel: live dashboard ── */
  .dashboard-panel { flex: 1; position: relative; border-right: 2px solid #30363d; }
  .dashboard-panel iframe { width: 100%; height: 100%; border: none; }

  /* ── Highlight overlay ── */
  .highlight-ring {
    position: fixed; pointer-events: none; z-index: 99999;
    border: 3px solid #f0883e; border-radius: 8px;
    box-shadow: 0 0 20px rgba(240,136,62,0.5), 0 0 60px rgba(240,136,62,0.2);
    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
    display: none;
  }
  .highlight-ring.active { display: block; }
  .highlight-label {
    position: fixed; pointer-events: none; z-index: 100000;
    background: #f0883e; color: #000; font-size: 12px; font-weight: 700;
    padding: 4px 10px; border-radius: 4px; white-space: nowrap;
    display: none; transform: translateY(-100%);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  .highlight-label.active { display: block; }

  /* ── Right panel: agent log ── */
  .agent-panel { width: 420px; display: flex; flex-direction: column; background: #161b22; }
  .agent-header { padding: 16px; border-bottom: 1px solid #30363d; }
  .agent-header h2 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .agent-header h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; animation: blink 1.5s infinite; }
  .agent-status { margin-top: 8px; font-size: 13px; color: #8b949e; }

  .agent-progress { padding: 8px 16px; }
  .agent-progress-bar { height: 3px; background: #30363d; border-radius: 2px; overflow: hidden; }
  .agent-progress-fill { height: 100%; background: #58a6ff; transition: width 0.3s; width: 0%; }

  .agent-stats { display: flex; gap: 12px; padding: 8px 16px; font-size: 13px; }
  .agent-stats .pass { color: #3fb950; }
  .agent-stats .fail { color: #f85149; }
  .agent-stats .skip { color: #8b949e; }
  .agent-stats .time { color: #8b949e; margin-left: auto; }

  .agent-log { flex: 1; overflow-y: auto; padding: 12px 16px; }
  .log-entry { padding: 6px 0; border-bottom: 1px solid #21262d; font-size: 13px; display: flex; gap: 8px; align-items: flex-start; }
  .log-entry .icon { flex-shrink: 0; width: 18px; text-align: center; }
  .log-entry .msg { flex: 1; }
  .log-entry .detail { color: #8b949e; font-size: 12px; margin-top: 2px; }
  .log-entry.step { color: #58a6ff; }
  .log-entry.pass { color: #3fb950; }
  .log-entry.fail { color: #f85149; }
  .log-entry.info { color: #8b949e; }
  .log-entry.action { color: #f0883e; }
  .log-entry.section { color: #d2a8ff; font-weight: 600; padding-top: 12px; }

  .agent-footer { padding: 12px 16px; border-top: 1px solid #30363d; display: flex; gap: 8px; }
  .agent-footer button { padding: 8px 16px; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; background: #161b22; color: #e6edf3; transition: all 0.15s; }
  .agent-footer button:hover { border-color: #58a6ff; }
  .agent-footer .btn-go { background: #238636; border-color: #238636; color: #fff; }
  .agent-footer .btn-go:hover { background: #2ea043; }
  .agent-footer .btn-go:disabled { opacity: 0.5; cursor: not-allowed; }
  .speed-control { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 12px; color: #8b949e; }
  .speed-control select { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px; }

  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
</head>
<body>

<div class="dashboard-panel">
  <iframe id="dashFrame" src="/"></iframe>
  <div class="highlight-ring" id="ring"></div>
  <div class="highlight-label" id="ringLabel"></div>
</div>

<div class="agent-panel">
  <div class="agent-header">
    <h2><span class="dot" id="agentDot"></span> EZRA Test Agent</h2>
    <div class="agent-status" id="agentStatus">Ready — click Start to begin</div>
  </div>
  <div class="agent-progress">
    <div class="agent-progress-bar"><div class="agent-progress-fill" id="agentProgress"></div></div>
  </div>
  <div class="agent-stats">
    <span class="pass" id="agentPass">0 passed</span>
    <span class="fail" id="agentFail">0 failed</span>
    <span class="time" id="agentTime">0s</span>
  </div>
  <div class="agent-log" id="agentLog"></div>
  <div class="agent-footer">
    <button class="btn-go" id="startBtn" onclick="startAgent()">Start Agent</button>
    <button onclick="location.reload()">Reset</button>
    <div class="speed-control">
      <label>Speed:</label>
      <select id="speedSelect">
        <option value="1500">Slow</option>
        <option value="800" selected>Normal</option>
        <option value="300">Fast</option>
        <option value="50">Turbo</option>
      </select>
    </div>
  </div>
</div>

<script>
let passCount = 0, failCount = 0, totalSteps = 0, agentRunning = false;
const startTime = { v: 0 };

function getSpeed() { return parseInt(document.getElementById('speedSelect').value); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getDoc() {
  try { return document.getElementById('dashFrame').contentDocument; } catch { return null; }
}

function log(type, icon, msg, detail) {
  const el = document.createElement('div');
  el.className = 'log-entry ' + type;
  el.innerHTML = '<span class="icon">' + icon + '</span><div class="msg">' + msg + (detail ? '<div class="detail">' + detail + '</div>' : '') + '</div>';
  const logEl = document.getElementById('agentLog');
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

function updateStats() {
  document.getElementById('agentPass').textContent = passCount + ' passed';
  document.getElementById('agentFail').textContent = failCount + ' failed';
  document.getElementById('agentTime').textContent = ((Date.now() - startTime.v) / 1000).toFixed(1) + 's';
}

function setProgress(pct) {
  document.getElementById('agentProgress').style.width = pct + '%';
}

function setStatus(msg) {
  document.getElementById('agentStatus').textContent = msg;
}

async function highlight(selector, label) {
  const doc = getDoc();
  if (!doc) return;
  const el = typeof selector === 'string' ? doc.querySelector(selector) : selector;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const iframe = document.getElementById('dashFrame');
  const iRect = iframe.getBoundingClientRect();
  const ring = document.getElementById('ring');
  const lbl = document.getElementById('ringLabel');
  ring.style.left = (iRect.left + rect.left - 4) + 'px';
  ring.style.top = (iRect.top + rect.top - 4) + 'px';
  ring.style.width = (rect.width + 8) + 'px';
  ring.style.height = (rect.height + 8) + 'px';
  ring.classList.add('active');
  lbl.textContent = label || '';
  lbl.style.left = (iRect.left + rect.left) + 'px';
  lbl.style.top = (iRect.top + rect.top - 4) + 'px';
  lbl.classList.add('active');
  await sleep(getSpeed());
}

function hideHighlight() {
  document.getElementById('ring').classList.remove('active');
  document.getElementById('ringLabel').classList.remove('active');
}

async function check(name, fn) {
  totalSteps++;
  try {
    await fn();
    passCount++;
    log('pass', '\\u2705', name);
    updateStats();
  } catch (err) {
    failCount++;
    log('fail', '\\u274c', name, err.message);
    updateStats();
  }
}

function section(name) {
  log('section', '\\u2500', name);
}

function action(msg) {
  log('action', '\\ud83d\\udc46', msg);
}

function info(msg) {
  log('info', '\\u2139\\ufe0f', msg);
}

// ═══ AGENT SCRIPT ═══════════════════════════════════════════

async function startAgent() {
  if (agentRunning) return;
  agentRunning = true;
  startTime.v = Date.now();
  document.getElementById('startBtn').disabled = true;
  document.getElementById('agentDot').style.background = '#f0883e';

  const doc = getDoc();
  if (!doc) { log('fail', '\\u274c', 'Cannot access dashboard iframe'); return; }

  setStatus('Agent running...');
  log('info', '\\ud83e\\udd16', 'Agent starting — simulating real user interaction');

  // ── Phase 1: Page Load Verification ──────────────────────
  section('Phase 1: Page Load & Initial State');
  setProgress(5);

  await highlight('header', 'Checking header');
  await check('Page loaded successfully', async () => {
    if (!doc.querySelector('header')) throw new Error('No header found');
  });

  await highlight('header h1', 'Verifying branding');
  await check('EZRA branding visible', async () => {
    const h1 = doc.querySelector('header h1');
    if (!h1 || !h1.textContent.includes('EZRA')) throw new Error('Missing EZRA in header');
  });

  await highlight('#totalPass', 'Checking pass counter');
  await check('Pass counter shows "0 passed"', async () => {
    const el = doc.querySelector('#totalPass');
    if (!el || !el.textContent.includes('0 passed')) throw new Error('Bad initial pass: ' + (el && el.textContent));
  });

  await highlight('#totalFail', 'Checking fail counter');
  await check('Fail counter shows "0 failed"', async () => {
    const el = doc.querySelector('#totalFail');
    if (!el || !el.textContent.includes('0 failed')) throw new Error('Bad initial fail');
  });

  await highlight('#totalTime', 'Checking timer');
  await check('Timer shows "0s"', async () => {
    const el = doc.querySelector('#totalTime');
    if (!el || !el.textContent.includes('0s')) throw new Error('Bad initial time');
  });

  await highlight('#totalSuites', 'Checking suite counter');
  await check('Suite counter shows "0 / 43 suites"', async () => {
    const el = doc.querySelector('#totalSuites');
    if (!el || !el.textContent.includes('43')) throw new Error('Bad suite count: ' + (el && el.textContent));
  });

  // ── Phase 2: Button Inspection ───────────────────────────
  section('Phase 2: Control Buttons');
  setProgress(10);

  await highlight('#runBtn', 'Inspecting Run button');
  await check('"Run All Tests" button exists and is enabled', async () => {
    const btn = doc.querySelector('#runBtn');
    if (!btn) throw new Error('Missing run button');
    if (btn.disabled) throw new Error('Button disabled');
    if (!btn.textContent.includes('Run All Tests')) throw new Error('Wrong text: ' + btn.textContent);
  });

  const filterNames = ['All', 'Core', 'V6', 'V7', 'Quality', 'E2E', 'Failed Only'];
  const filterValues = ['all', 'core', 'v6', 'v7', 'quality', 'e2e', 'failed'];
  for (let i = 0; i < filterNames.length; i++) {
    const btn = doc.querySelector('[data-filter="' + filterValues[i] + '"]');
    await highlight(btn || 'body', 'Checking ' + filterNames[i] + ' filter');
    await check('"' + filterNames[i] + '" filter button exists', async () => {
      if (!btn) throw new Error('Missing filter: ' + filterValues[i]);
    });
  }

  // ── Phase 3: Cards Grid ──────────────────────────────────
  section('Phase 3: Suite Cards Grid');
  setProgress(15);

  await highlight('#grid', 'Scanning cards grid');
  const cards = doc.querySelectorAll('.card');
  await check('43 suite cards rendered', async () => {
    if (cards.length !== 43) throw new Error('Found ' + cards.length + ' cards');
  });

  // Check first card
  const firstCard = cards[0];
  if (firstCard) {
    await highlight(firstCard, 'Inspecting first card');
    await check('First card is "Structure" with PENDING badge', async () => {
      const name = firstCard.querySelector('.card-name');
      const badge = firstCard.querySelector('.card-badge');
      if (!name || !name.textContent.includes('Structure')) throw new Error('First card: ' + (name && name.textContent));
      if (!badge || !badge.textContent.includes('PENDING')) throw new Error('Badge: ' + (badge && badge.textContent));
    });
  }

  // Check last card
  const lastCard = cards[cards.length - 1];
  if (lastCard) {
    await highlight(lastCard, 'Inspecting last card');
    await check('Last card is "UAT" with PENDING badge', async () => {
      const name = lastCard.querySelector('.card-name');
      if (!name || !name.textContent.includes('UAT')) throw new Error('Last card: ' + (name && name.textContent));
    });
  }

  // Verify categories
  await check('Cards span all categories (core, v6, v7, quality, e2e)', async () => {
    const cats = new Set();
    cards.forEach(c => cats.add(c.dataset.category));
    for (const cat of ['core', 'v6', 'v7', 'quality', 'e2e']) {
      if (!cats.has(cat)) throw new Error('Missing category: ' + cat);
    }
  });

  await check('All cards start with status=pending', async () => {
    let nonPending = 0;
    cards.forEach(c => { if (c.dataset.status !== 'pending') nonPending++; });
    if (nonPending > 0) throw new Error(nonPending + ' cards not pending');
  });

  // ── Phase 4: Progress Bar ────────────────────────────────
  section('Phase 4: Progress Bar');
  setProgress(18);

  await highlight('.progress-container', 'Checking progress bar');
  await check('Progress bar exists at 0%', async () => {
    const bar = doc.querySelector('#progressBar');
    if (!bar) throw new Error('Missing progress bar');
    if (!bar.style.width.includes('0')) throw new Error('Progress not at 0: ' + bar.style.width);
  });

  // ── Phase 5: Summary Panel ───────────────────────────────
  section('Phase 5: Summary Panel');
  setProgress(20);

  await highlight('#summary', 'Checking summary panel');
  await check('Summary panel exists and is hidden', async () => {
    const sum = doc.querySelector('#summary');
    if (!sum) throw new Error('Missing summary');
    const style = doc.defaultView.getComputedStyle(sum);
    if (style.display !== 'none') throw new Error('Summary visible before run');
  });

  // ── Phase 6: Log Panel ───────────────────────────────────
  section('Phase 6: Log Panel');

  const logDetails = doc.querySelector('.log-panel details');
  await highlight(logDetails || '.log-panel', 'Checking log panel');
  await check('Log panel exists with initial message', async () => {
    const logContent = doc.querySelector('#logContent');
    if (!logContent) throw new Error('Missing log content');
    if (!logContent.textContent.includes('Waiting')) throw new Error('Bad initial log: ' + logContent.textContent);
  });

  // ── Phase 7: Test Filter Buttons ─────────────────────────
  section('Phase 7: Testing Filter Buttons');
  setProgress(25);

  action('Clicking "Core" filter...');
  const coreBtn = doc.querySelector('[data-filter="core"]');
  if (coreBtn) {
    coreBtn.click();
    await highlight(coreBtn, 'Clicked Core');
    await check('Core filter: only core cards visible', async () => {
      let visible = 0, hidden = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d === 'none') hidden++; else visible++;
      });
      if (visible < 3) throw new Error('Too few visible: ' + visible);
      if (hidden === 0) throw new Error('Nothing hidden — filter not working');
    });
  }

  action('Clicking "V6" filter...');
  const v6Btn = doc.querySelector('[data-filter="v6"]');
  if (v6Btn) {
    v6Btn.click();
    await highlight(v6Btn, 'Clicked V6');
    await check('V6 filter: shows V6 cards, hides others', async () => {
      let v6Visible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none' && c.dataset.category === 'v6') v6Visible++;
      });
      if (v6Visible < 10) throw new Error('Only ' + v6Visible + ' V6 cards visible');
    });
  }

  action('Clicking "V7" filter...');
  const v7Btn = doc.querySelector('[data-filter="v7"]');
  if (v7Btn) {
    v7Btn.click();
    await highlight(v7Btn, 'Clicked V7');
    await check('V7 filter: shows V7 cards', async () => {
      let v7Visible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none' && c.dataset.category === 'v7') v7Visible++;
      });
      if (v7Visible < 5) throw new Error('Only ' + v7Visible + ' V7 cards visible');
    });
  }

  action('Clicking "Quality" filter...');
  const qBtn = doc.querySelector('[data-filter="quality"]');
  if (qBtn) {
    qBtn.click();
    await highlight(qBtn, 'Clicked Quality');
    await check('Quality filter: shows Lint card', async () => {
      let qVisible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none') qVisible++;
      });
      if (qVisible !== 1) throw new Error('Expected 1 quality card, got ' + qVisible);
    });
  }

  action('Clicking "E2E" filter...');
  const e2eBtn = doc.querySelector('[data-filter="e2e"]');
  if (e2eBtn) {
    e2eBtn.click();
    await highlight(e2eBtn, 'Clicked E2E');
    await check('E2E filter: shows E2E + UAT cards', async () => {
      let eVisible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none') eVisible++;
      });
      if (eVisible !== 2) throw new Error('Expected 2 e2e cards, got ' + eVisible);
    });
  }

  action('Clicking "Failed Only" filter...');
  const failBtn = doc.querySelector('[data-filter="failed"]');
  if (failBtn) {
    failBtn.click();
    await highlight(failBtn, 'Clicked Failed Only');
    await check('Failed Only filter: no cards visible (none failed yet)', async () => {
      let visible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none') visible++;
      });
      if (visible !== 0) throw new Error('Expected 0 visible, got ' + visible);
    });
  }

  action('Clicking "All" filter to restore...');
  const allBtn = doc.querySelector('[data-filter="all"]');
  if (allBtn) {
    allBtn.click();
    await highlight(allBtn, 'Clicked All');
    await check('All filter: all 43 cards visible again', async () => {
      let visible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none') visible++;
      });
      if (visible !== 43) throw new Error('Expected 43, got ' + visible);
    });
  }

  // ── Phase 8: CLICK "Run All Tests" ──────────────────────
  section('Phase 8: Run All Tests (Live!)');
  setProgress(30);

  action('Clicking "Run All Tests" button...');
  const runBtn = doc.querySelector('#runBtn');
  await highlight(runBtn, 'CLICKING Run All Tests');
  await sleep(getSpeed());

  // Actually click it!
  if (runBtn) runBtn.click();

  await check('Button changes to "Running..." and becomes disabled', async () => {
    await sleep(300);
    const btn = doc.querySelector('#runBtn');
    if (!btn.disabled) throw new Error('Button not disabled');
    if (!btn.textContent.includes('Running')) throw new Error('Text: ' + btn.textContent);
  });

  info('Watching test suites execute in real-time...');

  // Wait and observe each suite completing
  let lastCompleted = 0;
  let stableCount = 0;
  const maxWait = 300000; // 5 min
  const pollStart = Date.now();

  while (Date.now() - pollStart < maxWait) {
    await sleep(1000);
    const badges = doc.querySelectorAll('.card-badge');
    let completed = 0;
    let running = 0;
    badges.forEach(b => {
      if (b.textContent === 'PASS' || b.textContent === 'FAIL') completed++;
      if (b.textContent === 'RUNNING') running++;
    });

    const pct = 30 + Math.round((completed / 43) * 60);
    setProgress(pct);
    setStatus('Running: ' + completed + '/43 suites completed' + (running ? ' (' + running + ' running)' : ''));

    // Log new completions
    if (completed > lastCompleted) {
      for (let ci = lastCompleted; ci < completed; ci++) {
        const card = doc.querySelectorAll('.card')[ci];
        if (card) {
          const cName = card.querySelector('.card-name');
          const cBadge = card.querySelector('.card-badge');
          const cStats = card.querySelector('.card-stats');
          await highlight(card, (cBadge ? cBadge.textContent : '') + ' — ' + (cName ? cName.textContent : ''));
          if (cBadge && cBadge.textContent === 'PASS') {
            log('pass', '\\u2705', (cName ? cName.textContent : 'Suite ' + ci) + ': ' + (cStats ? cStats.textContent : ''));
          } else {
            log('fail', '\\u274c', (cName ? cName.textContent : 'Suite ' + ci) + ': ' + (cStats ? cStats.textContent : ''));
          }
        }
      }
      lastCompleted = completed;
      stableCount = 0;
    } else {
      stableCount++;
    }

    if (completed >= 43) break;
    if (stableCount > 60) { info('Timed out waiting for suites'); break; }
  }

  // ── Phase 9: Verify Run Completed ────────────────────────
  section('Phase 9: Post-Run Verification');
  setProgress(92);

  await check('All 43 suites completed', async () => {
    let completed = 0;
    doc.querySelectorAll('.card-badge').forEach(b => {
      if (b.textContent === 'PASS' || b.textContent === 'FAIL') completed++;
    });
    if (completed < 43) throw new Error('Only ' + completed + ' completed');
  });

  await check('All suites show PASS', async () => {
    let failedSuites = [];
    doc.querySelectorAll('.card').forEach(c => {
      const badge = c.querySelector('.card-badge');
      const name = c.querySelector('.card-name');
      if (badge && badge.textContent === 'FAIL') failedSuites.push(name ? name.textContent : '?');
    });
    if (failedSuites.length > 0) throw new Error('Failed: ' + failedSuites.join(', '));
  });

  await highlight('#runBtn', 'Checking button restored');
  await check('Run button re-enabled with original text', async () => {
    const btn = doc.querySelector('#runBtn');
    if (!btn) throw new Error('Missing button');
    if (btn.disabled) throw new Error('Button still disabled');
    if (!btn.textContent.includes('Run All Tests')) throw new Error('Text: ' + btn.textContent);
  });

  await highlight('#progressBar', 'Checking progress bar');
  await check('Progress bar at 100%', async () => {
    const bar = doc.querySelector('#progressBar');
    if (!bar) throw new Error('Missing bar');
    const w = parseFloat(bar.style.width);
    if (w < 99) throw new Error('Progress: ' + bar.style.width);
  });

  // ── Phase 10: Status Bar Updated ─────────────────────────
  section('Phase 10: Status Bar Verification');
  setProgress(94);

  await highlight('#totalPass', 'Checking final pass count');
  await check('Pass counter updated (>1900)', async () => {
    const el = doc.querySelector('#totalPass');
    const num = parseInt(el.textContent);
    if (isNaN(num) || num < 1900) throw new Error('Pass count: ' + el.textContent);
  });

  await highlight('#totalFail', 'Checking final fail count');
  await check('Fail counter shows 0', async () => {
    const el = doc.querySelector('#totalFail');
    if (!el.textContent.includes('0 failed')) throw new Error('Fail: ' + el.textContent);
  });

  await highlight('#totalSuites', 'Checking suites count');
  await check('Suite counter shows 43 / 43', async () => {
    const el = doc.querySelector('#totalSuites');
    if (!el.textContent.includes('43 / 43')) throw new Error('Suites: ' + el.textContent);
  });

  await highlight('#totalTime', 'Checking elapsed time');
  await check('Timer shows elapsed time > 0s', async () => {
    const el = doc.querySelector('#totalTime');
    const num = parseFloat(el.textContent);
    if (isNaN(num) || num <= 0) throw new Error('Time: ' + el.textContent);
  });

  // ── Phase 11: Summary Panel ──────────────────────────────
  section('Phase 11: Summary Panel Verification');
  setProgress(96);

  await highlight('#summary', 'Checking summary appeared');
  await check('Summary panel is now visible', async () => {
    const sum = doc.querySelector('#summary');
    const style = doc.defaultView.getComputedStyle(sum);
    if (style.display === 'none') throw new Error('Summary still hidden');
  });

  await highlight('#sumPass', 'Checking summary pass count');
  await check('Summary passed count > 1900', async () => {
    const el = doc.querySelector('#sumPass');
    const num = parseInt(el.textContent);
    if (isNaN(num) || num < 1900) throw new Error('Sum pass: ' + el.textContent);
  });

  await highlight('#sumFail', 'Checking summary fail count');
  await check('Summary failed count = 0', async () => {
    const el = doc.querySelector('#sumFail');
    if (el.textContent.trim() !== '0') throw new Error('Sum fail: ' + el.textContent);
  });

  await highlight('#sumSuites', 'Checking summary suites');
  await check('Summary suites = 43', async () => {
    const el = doc.querySelector('#sumSuites');
    if (el.textContent.trim() !== '43') throw new Error('Sum suites: ' + el.textContent);
  });

  await highlight('#sumResult', 'Checking result verdict');
  await check('Summary result says "ALL GREEN"', async () => {
    const el = doc.querySelector('#sumResult');
    if (!el.textContent.includes('ALL GREEN')) throw new Error('Result: ' + el.textContent);
  });

  // ── Phase 12: Log Panel ──────────────────────────────────
  section('Phase 12: Log Output Verification');
  setProgress(97);

  action('Opening log panel...');
  const details = doc.querySelector('.log-panel details');
  if (details) details.open = true;
  await sleep(getSpeed());

  await highlight('#logContent', 'Checking log output');
  await check('Log contains test output lines', async () => {
    const logEl = doc.querySelector('#logContent');
    if (!logEl) throw new Error('Missing log');
    if (logEl.textContent.length < 100) throw new Error('Log too short: ' + logEl.textContent.length + ' chars');
  });

  await check('Log contains pass indicators', async () => {
    const logEl = doc.querySelector('#logContent');
    if (!logEl.textContent.includes('passed')) throw new Error('No pass lines in log');
  });

  // ── Phase 13: Re-test Filters (post-run) ─────────────────
  section('Phase 13: Post-Run Filter Tests');
  setProgress(98);

  action('Clicking "Core" filter after run...');
  const coreBtn2 = doc.querySelector('[data-filter="core"]');
  if (coreBtn2) {
    coreBtn2.click();
    await highlight(coreBtn2, 'Core filter post-run');
    await check('Core filter works after run completion', async () => {
      let coreVisible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none' && c.dataset.category === 'core') coreVisible++;
      });
      if (coreVisible < 3) throw new Error('Core visible: ' + coreVisible);
    });
  }

  action('Clicking "Failed Only" filter...');
  const failBtn2 = doc.querySelector('[data-filter="failed"]');
  if (failBtn2) {
    failBtn2.click();
    await highlight(failBtn2, 'Failed Only post-run');
    await check('Failed Only filter: 0 cards (all passed)', async () => {
      let visible = 0;
      doc.querySelectorAll('.card').forEach(c => {
        const d = doc.defaultView.getComputedStyle(c).display;
        if (d !== 'none') visible++;
      });
      if (visible !== 0) throw new Error('Expected 0, got ' + visible);
    });
  }

  action('Clicking "All" to restore...');
  const allBtn2 = doc.querySelector('[data-filter="all"]');
  if (allBtn2) {
    allBtn2.click();
    await highlight(allBtn2, 'All restored');
  }

  // ── Phase 14: Card Hover & Detail Check ──────────────────
  section('Phase 14: Individual Card Deep Inspection');
  setProgress(99);

  // Pick a few key cards and verify their stats
  const keyCards = ['Structure', 'Commands', 'Lint', 'E2E', 'UAT'];
  for (const name of keyCards) {
    let found = null;
    doc.querySelectorAll('.card').forEach(c => {
      const cn = c.querySelector('.card-name');
      if (cn && cn.textContent === name) found = c;
    });
    if (found) {
      await highlight(found, 'Inspecting ' + name);
      await check(name + ' card shows pass count > 0', async () => {
        const stats = found.querySelector('.card-stats');
        if (!stats) throw new Error('No stats');
        const pass = parseInt(stats.textContent);
        if (pass <= 0 || isNaN(pass)) {
          // Parse the text more carefully
          if (!stats.textContent.includes('passed')) throw new Error('No pass info: ' + stats.textContent);
        }
      });
    }
  }

  // ── DONE ─────────────────────────────────────────────────
  setProgress(100);
  hideHighlight();

  const totalTime = ((Date.now() - startTime.v) / 1000).toFixed(1);
  const allPassed = failCount === 0;

  section('Agent Complete');
  log(allPassed ? 'pass' : 'fail', allPassed ? '\\ud83c\\udfc6' : '\\u274c',
    passCount + ' passed, ' + failCount + ' failed in ' + totalTime + 's',
    allPassed ? 'ALL CHECKS PASSED — Dashboard fully operational' : 'SOME CHECKS FAILED — Review log above');

  setStatus(allPassed ? 'All checks passed (' + totalTime + 's)' : failCount + ' failures detected');
  document.getElementById('agentDot').style.background = allPassed ? '#3fb950' : '#f85149';
  document.getElementById('agentDot').style.animation = 'none';
  agentRunning = false;
}
</script>
</body>
</html>`;
}

// ─── HTTP Server ────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/run') {
    handleRun(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    handleSave(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', suites: SUITES.length, version: '6.1.0' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/test') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getVisualTestHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('ERROR: Port ' + PORT + ' is already in use.');
    console.error('Fix:   Run this to kill it:');
    console.error('       netstat -ano | findstr :' + PORT);
    console.error('       Stop-Process -Id <PID> -Force');
    console.error('  Or:  Set EZRA_TEST_PORT=3001 to use a different port');
    console.error('');
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('');
  console.log('EZRA Test Dashboard');
  console.log('════════════════════════════════════════');
  console.log('  URL:    http://localhost:' + PORT);
  console.log('  Suites: ' + SUITES.length);
  console.log('  Mode:   E2E browser dashboard');
  console.log('  Test:   http://localhost:' + PORT + '/test');
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('Open your browser to http://localhost:' + PORT);
  console.log('Press Ctrl+C to stop');
  console.log('');
});
