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

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('EZRA Test Dashboard');
  console.log('════════════════════════════════════════');
  console.log('  URL:    http://localhost:' + PORT);
  console.log('  Suites: ' + SUITES.length);
  console.log('  Mode:   E2E browser dashboard');
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('Open your browser to http://localhost:' + PORT);
  console.log('Press Ctrl+C to stop');
  console.log('');
});
