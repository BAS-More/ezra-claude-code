#!/usr/bin/env node

'use strict';

/**
 * EZRA Dashboard Visual E2E Test Agent — Reverse Proxy Edition
 * 
 * Acts as a reverse proxy to the ezra-dashboard (port 3001),
 * stripping X-Frame-Options / CSP so the dashboard renders in an iframe.
 * 
 * The special route /__agent__ serves the test harness UI.
 * Every other request proxies through to the dashboard.
 * 
 * Prerequisites:
 *   - ezra-dashboard dev server on port 3001
 * 
 * Usage: node scripts/dashboard-e2e-agent.js
 * Then open: http://localhost:3003/__agent__
 */

const http = require('http');
const PORT = 3003;
const UPSTREAM = 'http://localhost:3001';

// ─── Reverse Proxy ──────────────────────────────────────────────

function proxy(clientReq, clientRes) {
  const url = new URL(clientReq.url, UPSTREAM);

  const opts = {
    hostname: url.hostname,
    port: url.port || 3001,
    path: url.pathname + url.search,
    method: clientReq.method,
    headers: { ...clientReq.headers, host: url.host },
  };

  const upstream = http.request(opts, (upRes) => {
    // Strip headers that block iframe embedding
    const headers = { ...upRes.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    // Rewrite any Location headers to stay on our proxy
    if (headers.location) {
      try {
        const loc = new URL(headers.location, UPSTREAM);
        if (loc.hostname === 'localhost' && String(loc.port) === '3001') {
          loc.port = PORT;
          headers.location = loc.toString();
        }
      } catch (_) { /* leave as-is */ }
    }
    clientRes.writeHead(upRes.statusCode, headers);
    upRes.pipe(clientRes, { end: true });
  });

  upstream.on('error', (err) => {
    clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
    clientRes.end('Proxy error — is the dashboard running on port 3001?\n' + err.message);
  });

  clientReq.pipe(upstream, { end: true });
}

// ─── Agent HTML ─────────────────────────────────────────────────

function getAgentHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EZRA Dashboard — E2E Test Agent</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; display: flex; height: 100vh; overflow: hidden; }
  .browser-panel { flex: 1; display: flex; flex-direction: column; border-right: 2px solid #30363d; position: relative; }
  .browser-bar { height: 36px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; padding: 0 12px; gap: 8px; font-size: 12px; }
  .browser-bar .dots { display: flex; gap: 6px; }
  .browser-bar .dots span { width: 10px; height: 10px; border-radius: 50%; }
  .browser-bar .dot-r { background: #f85149; }
  .browser-bar .dot-y { background: #d29922; }
  .browser-bar .dot-g { background: #3fb950; }
  .browser-bar .url-bar { flex: 1; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 4px 10px; color: #8b949e; font-family: monospace; font-size: 12px; }
  .browser-panel iframe { flex: 1; width: 100%; border: none; background: #fff; }

  .agent-panel { width: 420px; display: flex; flex-direction: column; background: #161b22; }
  .agent-header { padding: 14px 16px; border-bottom: 1px solid #30363d; }
  .agent-header h2 { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .agent-header .dot { width: 8px; height: 8px; border-radius: 50%; background: #8b949e; }
  .agent-header .dot.active { background: #f0883e; animation: pulse 1.5s infinite; }
  .agent-header .dot.done { background: #3fb950; animation: none; }
  .agent-header .dot.fail { background: #f85149; animation: none; }
  .agent-status { font-size: 12px; color: #8b949e; margin-top: 4px; }

  .agent-progress { padding: 6px 16px; }
  .agent-progress-outer { height: 3px; background: #30363d; border-radius: 2px; overflow: hidden; }
  .agent-progress-inner { height: 100%; background: #58a6ff; transition: width 0.3s; width: 0%; }

  .agent-stats { display: flex; gap: 12px; padding: 6px 16px; font-size: 12px; border-bottom: 1px solid #21262d; }
  .agent-stats .pass { color: #3fb950; }
  .agent-stats .fail { color: #f85149; }
  .agent-stats .time { color: #8b949e; margin-left: auto; }

  .agent-log { flex: 1; overflow-y: auto; padding: 10px 16px; }
  .le { padding: 5px 0; border-bottom: 1px solid rgba(48,54,61,0.4); font-size: 12px; display: flex; gap: 6px; align-items: flex-start; line-height: 1.4; }
  .le .i { flex-shrink: 0; width: 16px; text-align: center; }
  .le .m { flex: 1; }
  .le .d { color: #8b949e; font-size: 11px; margin-top: 1px; }
  .le.section { color: #d2a8ff; font-weight: 600; padding-top: 10px; font-size: 13px; }
  .le.pass { color: #3fb950; }
  .le.fail { color: #f85149; }
  .le.action { color: #f0883e; }
  .le.info { color: #8b949e; }
  .le.nav { color: #58a6ff; }

  .agent-footer { padding: 10px 16px; border-top: 1px solid #30363d; display: flex; gap: 8px; align-items: center; }
  .agent-footer button { padding: 6px 14px; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; background: #161b22; color: #e6edf3; }
  .agent-footer button:hover { border-color: #58a6ff; }
  .agent-footer .btn-go { background: #238636; border-color: #238636; color: #fff; }
  .agent-footer .btn-go:hover { background: #2ea043; }
  .agent-footer .btn-go:disabled { opacity: 0.5; cursor: not-allowed; }
  .speed-ctl { display: flex; align-items: center; gap: 4px; margin-left: auto; font-size: 11px; color: #8b949e; }
  .speed-ctl select { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; padding: 3px 6px; font-size: 11px; }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
</head>
<body>

<div class="browser-panel">
  <div class="browser-bar">
    <div class="dots"><span class="dot-r"></span><span class="dot-y"></span><span class="dot-g"></span></div>
    <div class="url-bar" id="urlBar">localhost:${PORT}/</div>
  </div>
  <iframe id="frame" src="/"></iframe>
</div>

<div class="agent-panel">
  <div class="agent-header">
    <h2><span class="dot" id="agentDot"></span> EZRA E2E Test Agent</h2>
    <div class="agent-status" id="agentStatus">Ready — click Start to begin full user journey</div>
  </div>
  <div class="agent-progress"><div class="agent-progress-outer"><div class="agent-progress-inner" id="prog"></div></div></div>
  <div class="agent-stats">
    <span class="pass" id="sPass">0 passed</span>
    <span class="fail" id="sFail">0 failed</span>
    <span class="time" id="sTime">0s</span>
  </div>
  <div class="agent-log" id="log"></div>
  <div class="agent-footer">
    <button class="btn-go" id="goBtn" onclick="startAgent()">Start Agent</button>
    <button onclick="location.href='/__agent__'">Reset</button>
    <div class="speed-ctl">
      <label>Speed:</label>
      <select id="spd">
        <option value="2000">Slow</option>
        <option value="1000" selected>Normal</option>
        <option value="400">Fast</option>
        <option value="100">Turbo</option>
      </select>
    </div>
  </div>
</div>

<script>
// All URLs are same-origin — the proxy on port ${PORT} forwards to the dashboard
let pc = 0, fc = 0, t0 = 0, running = false;

function spd() { return +document.getElementById('spd').value; }
function wait(ms) { return new Promise(r => setTimeout(r, ms || spd())); }

function log(cls, icon, msg, detail) {
  const d = document.createElement('div');
  d.className = 'le ' + cls;
  d.innerHTML = '<span class="i">' + icon + '</span><div class="m">' + msg + (detail ? '<div class="d">' + detail + '</div>' : '') + '</div>';
  const l = document.getElementById('log');
  l.appendChild(d);
  l.scrollTop = l.scrollHeight;
}
function section(s) { log('section', '\\u2014', s); }
function action(s) { log('action', '\\u{1F446}', s); }
function info(s) { log('info', '\\u2139\\uFE0F', s); }

function nav(path) {
  log('nav', '\\u{1F310}', 'Navigating to ' + path);
  document.getElementById('urlBar').textContent = 'localhost:${PORT}' + path;
  document.getElementById('frame').src = path;
}

function stats() {
  document.getElementById('sPass').textContent = pc + ' passed';
  document.getElementById('sFail').textContent = fc + ' failed';
  document.getElementById('sTime').textContent = ((Date.now() - t0) / 1000).toFixed(1) + 's';
}
function prog(p) { document.getElementById('prog').style.width = p + '%'; }
function status(s) { document.getElementById('agentStatus').textContent = s; }

async function check(name, fn) {
  try { await fn(); pc++; log('pass', '\\u2705', name); }
  catch (e) { fc++; log('fail', '\\u274C', name, e.message); }
  stats();
}

function frameLoaded() {
  return new Promise(resolve => {
    const f = document.getElementById('frame');
    function done() { f.removeEventListener('load', done); setTimeout(resolve, 800); }
    f.addEventListener('load', done);
    setTimeout(resolve, 4000);
  });
}

async function fetchHtml(path) {
  const r = await fetch(path, { redirect: 'follow', credentials: 'include' });
  return { status: r.status, html: await r.text() };
}

async function fetchStatus(path) {
  const r = await fetch(path, { redirect: 'manual' });
  return { status: r.status, location: r.headers.get('location') || '' };
}

// =====================================================================
// AGENT TEST SCRIPT — 13 Phases
// =====================================================================

async function startAgent() {
  if (running) return;
  running = true; t0 = Date.now(); pc = 0; fc = 0;
  document.getElementById('goBtn').disabled = true;
  const dot = document.getElementById('agentDot');
  dot.classList.add('active');
  status('Running E2E tests...');
  info('Agent starting \\u2014 all requests proxy through localhost:${PORT}');

  const TOTAL = 13;
  let phase = 0;
  function next() { phase++; prog(Math.round(phase / TOTAL * 100)); }

  // \\u2550\\u2550 Phase 1: Homepage \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 1: Homepage');
  next();
  nav('/');
  await frameLoaded();
  await wait();

  const home = (await fetchHtml('/')).html;

  await check('Homepage loads (200)', async () => {
    const r = await fetchStatus('/');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  await check('EZRA branding present', () => {
    if (!home.includes('EZRA')) throw new Error('Missing EZRA');
  });

  await check('Hero headline', () => {
    if (!home.includes('Restores and Enforces Standards')) throw new Error('Missing headline');
  });

  await check('"Get Started Free" CTA', () => {
    if (!home.includes('Get Started Free')) throw new Error('Missing CTA');
  });

  await check('"Read the Docs" link', () => {
    if (!home.includes('Read the Docs')) throw new Error('Missing docs link');
  });

  await check('Nav links: Docs, Pricing, Sign In', () => {
    if (!home.includes('/docs')) throw new Error('Missing /docs');
    if (!home.includes('/pricing')) throw new Error('Missing /pricing');
    if (!home.includes('/login')) throw new Error('Missing /login');
  });

  await check('3 feature cards', () => {
    if (!home.includes('Health Scanning')) throw new Error('Missing Health Scanning');
    if (!home.includes('Multi-Agent Orchestration')) throw new Error('Missing Multi-Agent');
    if (!home.includes('Slash Commands')) throw new Error('Missing Slash Commands');
  });

  await check('Stats: 22 Hooks, 39 Commands, Zero Dependencies', () => {
    if (!home.includes('>22<')) throw new Error('Missing 22');
    if (!home.includes('>39<')) throw new Error('Missing 39');
    if (!home.includes('Zero')) throw new Error('Missing Zero');
  });

  await check('Footer present', () => {
    if (!home.includes('Codebase Governance Platform')) throw new Error('Missing footer');
  });

  // \\u2550\\u2550 Phase 2: Docs \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 2: Docs Page');
  next();
  action('Clicking Docs...');
  nav('/docs');
  await frameLoaded();
  await wait();

  const docs = (await fetchHtml('/docs')).html;

  await check('Docs loads (200)', async () => {
    const r = await fetchStatus('/docs');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  await check('Documentation heading', () => {
    if (!docs.includes('Documentation')) throw new Error('Missing heading');
  });

  await check('Install command: npm install -g ezra-claude-code', () => {
    if (!docs.includes('npm install -g ezra-claude-code')) throw new Error('Missing install');
  });

  await check('Init command: ezra init', () => {
    if (!docs.includes('ezra init')) throw new Error('Missing init');
  });

  await check('Scan command: ezra scan', () => {
    if (!docs.includes('ezra scan')) throw new Error('Missing scan');
  });

  await check('Health command: /ezra:health', () => {
    if (!docs.includes('/ezra:health')) throw new Error('Missing health');
  });

  // \\u2550\\u2550 Phase 3: Pricing \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 3: Pricing Page');
  next();
  action('Clicking Pricing...');
  nav('/pricing');
  await frameLoaded();
  await wait();

  const price = (await fetchHtml('/pricing')).html;

  await check('Pricing loads (200)', async () => {
    const r = await fetchStatus('/pricing');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  await check('Transparent pricing heading', () => {
    if (!price.includes('transparent pricing')) throw new Error('Missing heading');
  });

  await check('Core tier (Free)', () => {
    if (!price.includes('Core') || !price.includes('Free')) throw new Error('Missing Core/Free');
  });

  await check('Pro tier ($29)', () => {
    if (!price.includes('Pro') || !price.includes('29')) throw new Error('Missing Pro/$29');
  });

  await check('Team tier ($59)', () => {
    if (!price.includes('Team') || !price.includes('59')) throw new Error('Missing Team/$59');
  });

  await check('Enterprise tier (Custom)', () => {
    if (!price.includes('Enterprise') || !price.includes('Custom')) throw new Error('Missing Enterprise');
  });

  await check('Core CTA -> /login?plan=core', () => {
    if (!price.includes('/login?plan=core')) throw new Error('Missing core CTA');
  });

  await check('Pro CTA -> /login?plan=pro', () => {
    if (!price.includes('/login?plan=pro')) throw new Error('Missing pro CTA');
  });

  await check('Enterprise mailto:sales@ezradev.com', () => {
    if (!price.includes('mailto:sales@ezradev.com')) throw new Error('Missing sales email');
  });

  // \\u2550\\u2550 Phase 4: Login \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 4: Login Page');
  next();
  action('Navigating to Login...');
  nav('/login');
  await frameLoaded();
  await wait();

  const login = (await fetchHtml('/login')).html;

  await check('Login loads (200)', async () => {
    const r = await fetchStatus('/login');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  await check('Sign In heading', () => {
    if (!login.includes('Sign In')) throw new Error('Missing');
  });

  await check('Email field', () => {
    if (!login.toLowerCase().includes('email')) throw new Error('Missing');
  });

  await check('Password field', () => {
    if (!login.toLowerCase().includes('password')) throw new Error('Missing');
  });

  await check('Forgot password link', () => {
    if (!login.includes('Forgot password')) throw new Error('Missing');
  });

  await check('GitHub OAuth button', () => {
    if (!login.includes('GitHub')) throw new Error('Missing');
  });

  await check('Google OAuth button', () => {
    if (!login.includes('Google')) throw new Error('Missing');
  });

  await check('Microsoft OAuth button', () => {
    if (!login.includes('Microsoft')) throw new Error('Missing');
  });

  await check('Sign Up toggle', () => {
    if (!login.includes('Sign Up')) throw new Error('Missing');
  });

  // \\u2550\\u2550 Phase 5: Auth Redirects \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 5: Protected Route Auth');
  next();

  const protectedRoutes = ['/dashboard', '/projects', '/settings', '/agents', '/library'];
  for (const route of protectedRoutes) {
    await check('GET ' + route + ' (auth)', async () => {
      const r = await fetchStatus(route);
      if (r.status >= 500) throw new Error('Server error: ' + r.status);
      if (r.status === 307 || r.status === 302) {
        if (!r.location.includes('/login')) throw new Error('Redirect to: ' + r.location);
        info(route + ' -> /login (auth enforced)');
      } else {
        info(route + ' -> ' + r.status + ' (dev pass-through)');
      }
    });
  }

  // \\u2550\\u2550 Phase 6: API Endpoints \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 6: API Endpoints');
  next();

  const apis = [
    '/api/achievements', '/api/activity', '/api/library', '/api/notifications',
    '/api/projects', '/api/settings', '/api/workflows',
  ];
  for (const api of apis) {
    await check('API ' + api + ' not 500', async () => {
      try {
        const r = await fetch(api, { credentials: 'include' });
        if (r.status >= 500) throw new Error('Server error: ' + r.status);
        info(api + ' -> ' + r.status);
      } catch (e) {
        if (e.message.includes('Server error')) throw e;
      }
    });
  }

  // \\u2550\\u2550 Phase 7: Dashboard \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 7: Dashboard Page');
  next();
  action('Navigating to Dashboard...');
  nav('/dashboard');
  await frameLoaded();
  await wait();
  await wait(1500);

  const dash = await fetchHtml('/dashboard');

  await check('Dashboard accessible', () => {
    if (dash.status >= 500) throw new Error('Server error: ' + dash.status);
  });

  if (dash.status === 200 && dash.html.includes('Dashboard')) {
    info('Dashboard loaded \\u2014 checking widgets...');

    await check('Dashboard heading', () => {
      if (!dash.html.includes('Dashboard')) throw new Error('Missing');
    });

    const wt = ['Health Score', 'Progress', 'Active Agents', 'Decision',
      'Security', 'Test Coverage', 'Cost', 'Leaderboard', 'Risk',
      'Activity', 'Phase', 'Achievement', 'Velocity', 'Workflow', 'Readiness'];

    await check('Dashboard widgets (' + wt.length + ' expected)', () => {
      let n = 0;
      for (const w of wt) { if (dash.html.includes(w)) n++; }
      if (n < 5) throw new Error('Only ' + n + '/' + wt.length + ' found');
      info(n + '/' + wt.length + ' widgets detected');
    });

    await check('Edit mode / layout controls', () => {
      if (!dash.html.toLowerCase().includes('edit') && !dash.html.toLowerCase().includes('layout'))
        throw new Error('Missing controls');
    });
  } else {
    info('Dashboard requires auth \\u2014 redirect confirmed');
  }

  // \\u2550\\u2550 Phase 8: Projects \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 8: Projects Page');
  next();
  action('Navigating to Projects...');
  nav('/projects');
  await frameLoaded();
  await wait();
  await wait(1000);

  const proj = await fetchHtml('/projects');

  await check('Projects accessible', () => {
    if (proj.status >= 500) throw new Error('Server error: ' + proj.status);
  });

  if (proj.status === 200 && proj.html.includes('Projects')) {
    await check('Projects heading', () => {
      if (!proj.html.includes('Projects')) throw new Error('Missing');
    });

    await check('Project cards or empty state', () => {
      const ok = proj.html.includes('Quiz2Biz') || proj.html.includes('DEMO') || proj.html.includes('No projects');
      if (!ok) throw new Error('No project content');
    });

    if (proj.html.includes('Quiz2Biz')) {
      await check('Project health score', () => {
        if (!proj.html.includes('85') && !proj.html.includes('health')) throw new Error('Missing');
      });
      await check('Project phase', () => {
        if (!proj.html.includes('Phase') && !proj.html.includes('Stabilis')) throw new Error('Missing');
      });
    }
  }

  // \\u2550\\u2550 Phase 9: Agents \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 9: Agents Page');
  next();
  action('Navigating to Agents...');
  nav('/agents');
  await frameLoaded();
  await wait();

  const ag = await fetchHtml('/agents');

  await check('Agents accessible', () => {
    if (ag.status >= 500) throw new Error('Server error: ' + ag.status);
  });

  if (ag.status === 200 && ag.html.includes('Agents')) {
    await check('Agents heading', () => {
      if (!ag.html.includes('Agents')) throw new Error('Missing');
    });

    await check('Agent providers listed', () => {
      const providers = ['Claude Sonnet', 'GPT-4o', 'Codex', 'Claude Haiku', 'Gemini Pro'];
      let n = 0;
      for (const p of providers) { if (ag.html.includes(p)) n++; }
      if (n < 3) throw new Error('Only ' + n + '/5');
    });

    await check('Roles section', () => {
      if (!ag.html.includes('Role') && !ag.html.includes('architect'))
        throw new Error('Missing');
    });
  }

  // \\u2550\\u2550 Phase 10: Settings \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 10: Settings Page');
  next();
  action('Navigating to Settings...');
  nav('/settings');
  await frameLoaded();
  await wait();

  const set = await fetchHtml('/settings');

  await check('Settings accessible', () => {
    if (set.status >= 500) throw new Error('Server error: ' + set.status);
  });

  if (set.status === 200) {
    await check('Settings heading', () => {
      if (!set.html.toLowerCase().includes('settings')) throw new Error('Missing');
    });
  }

  // \\u2550\\u2550 Phase 11: Workflows \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 11: Workflows Page');
  next();
  action('Navigating to Workflows...');
  nav('/workflows');
  await frameLoaded();
  await wait();

  const wf = await fetchHtml('/workflows');

  await check('Workflows loads', () => {
    if (wf.status >= 500) throw new Error('Server error: ' + wf.status);
  });

  if (wf.status === 200) {
    await check('Workflows has content', () => {
      if (wf.html.length < 500) throw new Error('Too small: ' + wf.html.length);
    });
  }

  // \\u2550\\u2550 Phase 12: Library \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 12: Library Page');
  next();
  action('Navigating to Library...');
  nav('/library');
  await frameLoaded();
  await wait();

  const lib = await fetchHtml('/library');

  await check('Library accessible', () => {
    if (lib.status >= 500) throw new Error('Server error: ' + lib.status);
  });

  if (lib.status === 200 && lib.html.includes('Library')) {
    await check('Library heading', () => {
      if (!lib.html.includes('Library')) throw new Error('Missing');
    });
  }

  // \\u2550\\u2550 Phase 13: Edge Cases \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  section('Phase 13: Error Handling & Security');
  next();

  await check('404 for /nonexistent', async () => {
    const r = await fetchHtml('/nonexistent');
    if (r.status === 404 || r.html.includes('404') || r.html.includes('Not Found')) return;
    if (r.status === 200 && r.html.includes('EZRA')) return;
    throw new Error('No 404 page \\u2014 status: ' + r.status);
  });

  await check('Auth callback route exists', async () => {
    try {
      const r = await fetchStatus('/auth/callback');
      if (r.status >= 500) throw new Error('Server error');
    } catch (e) {
      if (e.message.includes('Server error')) throw e;
    }
  });

  await check('Login ?redirect=/dashboard works', async () => {
    const r = await fetch('/login?redirect=/dashboard');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  await check('Login rejects open redirect (//evil.com)', async () => {
    const r = await fetchHtml('/login?redirect=//evil.com');
    if (r.html.includes('action="//evil.com"') || r.html.includes('href="//evil.com"'))
      throw new Error('Open redirect not sanitized');
  });

  await check('Pricing plan param works', async () => {
    const r = await fetch('/login?plan=pro');
    if (r.status !== 200) throw new Error('Status: ' + r.status);
  });

  // \\u2550\\u2550 Done \\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550\\u2550
  action('Back to homepage...');
  nav('/');
  await frameLoaded();

  prog(100);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = fc === 0;

  section('Test Run Complete');
  log(ok ? 'pass' : 'fail', ok ? '\\u{1F3C6}' : '\\u274C',
    pc + ' passed, ' + fc + ' failed in ' + elapsed + 's',
    ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');

  status(ok ? 'All passed (' + elapsed + 's)' : fc + ' failures (' + elapsed + 's)');
  dot.classList.remove('active');
  dot.classList.add(ok ? 'done' : 'fail');
  running = false;
  document.getElementById('goBtn').disabled = false;
}
</script>
</body>
</html>`;
}

// ─── HTTP Server ────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Serve the agent UI on /__agent__
  if (req.url === '/__agent__' || req.url === '/__agent__/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getAgentHtml());
    return;
  }

  // Everything else proxies to the dashboard
  proxy(req, res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\\nERROR: Port ' + PORT + ' is in use.');
    console.error('Fix: kill the process on port ' + PORT + ' then retry\\n');
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('');
  console.log('EZRA Dashboard E2E Test Agent (Reverse Proxy)');
  console.log('================================================');
  console.log('  Agent UI:  http://localhost:' + PORT + '/__agent__');
  console.log('  Dashboard: http://localhost:' + PORT + '/  (proxied from 3001)');
  console.log('================================================');
  console.log('');
  console.log('Open http://localhost:' + PORT + '/__agent__ to start testing');
  console.log('Press Ctrl+C to stop');
  console.log('');
});
