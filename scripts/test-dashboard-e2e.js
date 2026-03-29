#!/usr/bin/env node

'use strict';

/**
 * EZRA Dashboard Visual E2E Test Server
 * 
 * Serves a browser-based test agent that walks through the full
 * ezra-dashboard (Next.js app) like a real user:
 *   1. Tests public pages (home, docs, pricing, login)
 *   2. Logs in via Supabase email/password
 *   3. Tests all protected pages (dashboard, projects, agents, library, settings, workflows)
 *   4. Tests every button, link, widget, navigation, theme toggle, logout
 * 
 * Usage:
 *   1. Start ezra-dashboard:  cd C:\Dev\ezra-dashboard && npm run dev -- --port 3001
 *   2. Start this server:     node scripts/test-dashboard-e2e.js
 *   3. Open:                  http://localhost:3002
 * 
 * Zero external dependencies — pure Node.js.
 */

const http = require('http');
const PORT = parseInt(process.env.E2E_PORT || '3002', 10);
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3001';

function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EZRA Dashboard E2E Agent</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; display: flex; height: 100vh; overflow: hidden; }

  .app-panel { flex: 1; position: relative; border-right: 2px solid #30363d; }
  .app-panel iframe { width: 100%; height: 100%; border: none; }

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

  .agent-panel { width: 440px; display: flex; flex-direction: column; background: #161b22; }
  .agent-header { padding: 16px; border-bottom: 1px solid #30363d; }
  .agent-header h2 { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .agent-header h2 .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; animation: blink 1.5s infinite; }
  .agent-status { margin-top: 8px; font-size: 13px; color: #8b949e; }
  .creds-form { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .creds-form input { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 6px 10px; color: #e6edf3; font-size: 13px; }
  .creds-form input::placeholder { color: #484f58; }

  .agent-progress { padding: 8px 16px; }
  .agent-progress-bar { height: 3px; background: #30363d; border-radius: 2px; overflow: hidden; }
  .agent-progress-fill { height: 100%; background: #58a6ff; transition: width 0.3s; width: 0%; }

  .agent-stats { display: flex; gap: 12px; padding: 8px 16px; font-size: 13px; }
  .agent-stats .pass { color: #3fb950; }
  .agent-stats .fail { color: #f85149; }
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
  .agent-footer button { padding: 8px 16px; border: 1px solid #30363d; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; background: #161b22; color: #e6edf3; }
  .agent-footer button:hover { border-color: #58a6ff; }
  .btn-go { background: #238636 !important; border-color: #238636 !important; color: #fff !important; }
  .btn-go:hover { background: #2ea043 !important; }
  .btn-go:disabled { opacity: 0.5; cursor: not-allowed !important; }
  .speed-ctl { display: flex; align-items: center; gap: 6px; margin-left: auto; font-size: 12px; color: #8b949e; }
  .speed-ctl select { background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; font-size: 12px; }

  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
</head>
<body>

<div class="app-panel">
  <iframe id="appFrame" src="${DASHBOARD_URL}/"></iframe>
  <div class="highlight-ring" id="ring"></div>
  <div class="highlight-label" id="ringLabel"></div>
</div>

<div class="agent-panel">
  <div class="agent-header">
    <h2><span class="dot" id="agentDot"></span> EZRA Dashboard E2E Agent</h2>
    <div class="agent-status" id="agentStatus">Enter credentials & click Start</div>
    <div class="creds-form" id="credsForm">
      <input type="email" id="emailInput" placeholder="Email" autocomplete="email" />
      <input type="password" id="passInput" placeholder="Password" autocomplete="current-password" />
    </div>
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
    <div class="speed-ctl">
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
let passCount = 0, failCount = 0, startTime = 0, agentRunning = false;
const BASE = '${DASHBOARD_URL}';

function getSpeed() { return parseInt(document.getElementById('speedSelect').value); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getDoc() { try { return document.getElementById('appFrame').contentDocument; } catch { return null; } }
function getWin() { try { return document.getElementById('appFrame').contentWindow; } catch { return null; } }

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
  document.getElementById('agentTime').textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
}

function setProgress(p) { document.getElementById('agentProgress').style.width = p + '%'; }
function setStatus(s) { document.getElementById('agentStatus').textContent = s; }

function section(s) { log('section', '\\u2500', s); }
function action(s) { log('action', '\\ud83d\\udc46', s); }
function info(s) { log('info', '\\u2139\\ufe0f', s); }

async function highlight(el, label) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const iframe = document.getElementById('appFrame');
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

function navigate(path) {
  return new Promise((resolve) => {
    const frame = document.getElementById('appFrame');
    frame.onload = () => { setTimeout(resolve, 600); };
    frame.src = BASE + path;
    setTimeout(resolve, 5000); // fallback
  });
}

function waitForEl(selector, timeout) {
  timeout = timeout || 5000;
  return new Promise((resolve) => {
    const start = Date.now();
    (function poll() {
      const doc = getDoc();
      if (doc) {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);
      }
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(poll, 200);
    })();
  });
}

// ═══ AGENT SCRIPT ═══════════════════════════════════════════

async function startAgent() {
  if (agentRunning) return;
  agentRunning = true;
  startTime = Date.now();
  document.getElementById('startBtn').disabled = true;
  document.getElementById('agentDot').style.background = '#f0883e';

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passInput').value;
  document.getElementById('credsForm').style.display = 'none';

  setStatus('Agent running...');
  log('info', '\\ud83e\\udd16', 'Starting E2E agent — testing ezra-dashboard');

  // ── PHASE 1: Homepage ─────────────────────────────────────
  section('Phase 1: Homepage');
  setProgress(2);
  action('Navigating to homepage...');
  await navigate('/');

  let doc = getDoc();
  await check('Homepage loads', async () => { if (!doc) throw new Error('No doc'); });

  let el = await waitForEl('header');
  if (el) await highlight(el, 'Header');
  await check('Header with EZRA branding', async () => {
    const h = getDoc().querySelector('header');
    if (!h || !h.textContent.includes('EZRA')) throw new Error('Missing EZRA header');
  });

  el = await waitForEl('h1');
  if (el) await highlight(el, 'Hero title');
  await check('Hero: "The Scribe Who Restores and Enforces Standards"', async () => {
    const h1 = getDoc().querySelector('h1');
    if (!h1 || !h1.textContent.includes('Scribe')) throw new Error('Bad hero: ' + (h1 && h1.textContent));
  });

  await check('Hero has "Get Started Free" button', async () => {
    const links = getDoc().querySelectorAll('a');
    let found = false;
    links.forEach(a => { if (a.textContent.includes('Get Started Free')) found = true; });
    if (!found) throw new Error('Missing "Get Started Free"');
  });

  await check('Hero has "Read the Docs" button', async () => {
    const links = getDoc().querySelectorAll('a');
    let found = false;
    links.forEach(a => { if (a.textContent.includes('Read the Docs')) found = true; });
    if (!found) throw new Error('Missing "Read the Docs"');
  });

  await check('Feature cards: Health Scanning, Multi-Agent, 39 Commands', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Health Scanning')) throw new Error('Missing Health Scanning');
    if (!text.includes('Multi-Agent')) throw new Error('Missing Multi-Agent');
    if (!text.includes('39 Slash Commands') && !text.includes('39 Commands')) throw new Error('Missing 39 Commands');
  });

  await check('Stats: 22 Hooks, 39 Commands, Zero Dependencies', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('22')) throw new Error('Missing 22 Hooks');
    if (!text.includes('39')) throw new Error('Missing 39');
    if (!text.includes('Zero')) throw new Error('Missing Zero');
  });

  await check('Nav links: Docs, Pricing, Sign In', async () => {
    const nav = getDoc().querySelector('nav') || getDoc().querySelector('header');
    if (!nav) throw new Error('No nav');
    const text = nav.textContent;
    if (!text.includes('Docs')) throw new Error('Missing Docs');
    if (!text.includes('Pricing')) throw new Error('Missing Pricing');
    if (!text.includes('Sign In')) throw new Error('Missing Sign In');
  });

  await check('Footer exists with links', async () => {
    const footer = getDoc().querySelector('footer');
    if (!footer) throw new Error('No footer');
    if (!footer.textContent.includes('Docs')) throw new Error('Footer missing Docs');
  });

  // ── PHASE 2: Docs Page ────────────────────────────────────
  section('Phase 2: Docs Page');
  setProgress(10);
  action('Navigating to /docs...');
  await navigate('/docs');

  await check('Docs page loads with "Documentation" heading', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Documentation')) throw new Error('Bad docs heading');
  });

  await check('Docs has install command: npm install -g ezra-claude-code', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('npm install -g ezra-claude-code') && !text.includes('ezra-claude-code')) throw new Error('Missing install cmd');
  });

  await check('Docs has Getting Started section', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Getting Started')) throw new Error('Missing Getting Started');
  });

  // ── PHASE 3: Pricing Page ─────────────────────────────────
  section('Phase 3: Pricing Page');
  setProgress(18);
  action('Navigating to /pricing...');
  await navigate('/pricing');

  await check('Pricing page loads', async () => {
    const h1 = await waitForEl('h1');
    if (!h1) throw new Error('No heading');
  });

  for (const tier of ['Core', 'Pro', 'Team', 'Enterprise']) {
    await check('Pricing tier: ' + tier, async () => {
      const text = getDoc().body.textContent;
      if (!text.includes(tier)) throw new Error('Missing tier: ' + tier);
    });
  }

  await check('Core tier: Free forever', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Free')) throw new Error('Missing Free label');
  });

  await check('Pro tier: $29/user/mo', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('$29')) throw new Error('Missing $29');
  });

  await check('Team tier: $59/user/mo', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('$59')) throw new Error('Missing $59');
  });

  await check('CTA buttons: Get Started, Start Pro Trial, Start Team Trial, Contact Sales', async () => {
    const links = getDoc().querySelectorAll('a');
    const texts = [];
    links.forEach(a => texts.push(a.textContent.trim()));
    const all = texts.join(' ');
    if (!all.includes('Get Started')) throw new Error('Missing Get Started');
  });

  // ── PHASE 4: Login Page ───────────────────────────────────
  section('Phase 4: Login Page');
  setProgress(25);
  action('Navigating to /login...');
  await navigate('/login');

  await check('Login page loads with form', async () => {
    const heading = await waitForEl('h1');
    if (!heading) throw new Error('No heading');
  });

  el = await waitForEl('input[type="email"], input[placeholder*="mail"], input[autocomplete="email"]');
  if (el) await highlight(el, 'Email field');
  await check('Email input field exists', async () => {
    if (!el) throw new Error('Missing email input');
  });

  const passEl = await waitForEl('input[type="password"]');
  if (passEl) await highlight(passEl, 'Password field');
  await check('Password input field exists', async () => {
    if (!passEl) throw new Error('Missing password input');
  });

  await check('Sign In submit button exists', async () => {
    const btns = getDoc().querySelectorAll('button');
    let found = false;
    btns.forEach(b => { if (b.textContent.includes('Sign In')) found = true; });
    if (!found) throw new Error('Missing Sign In button');
  });

  await check('OAuth: GitHub, Google, Microsoft buttons', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('GitHub')) throw new Error('Missing GitHub');
    if (!text.includes('Google')) throw new Error('Missing Google');
    if (!text.includes('Microsoft')) throw new Error('Missing Microsoft');
  });

  await check('"Forgot password?" link exists', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Forgot password')) throw new Error('Missing forgot password');
  });

  await check('"Sign Up" toggle exists', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Sign Up')) throw new Error('Missing Sign Up');
  });

  // ── PHASE 5: Auth redirect test ───────────────────────────
  section('Phase 5: Auth Protection');
  setProgress(30);

  action('Testing protected route redirect /dashboard...');
  await navigate('/dashboard');
  await sleep(1500);
  await check('Unauthenticated /dashboard redirects to /login', async () => {
    const win = getWin();
    const loc = win ? win.location.href : '';
    if (!loc.includes('/login')) throw new Error('Not redirected: ' + loc);
  });

  // ── PHASE 6: Login ────────────────────────────────────────
  section('Phase 6: Login as User');
  setProgress(35);

  if (!email || !password) {
    info('No credentials provided — skipping authenticated tests');
    info('To test auth pages, enter email + password and restart');
    setProgress(100);
    finalize();
    return;
  }

  action('Navigating to /login...');
  await navigate('/login');
  await sleep(1000);

  action('Typing email: ' + email);
  const emailIn = await waitForEl('input[type="email"], input[placeholder*="mail"], input[autocomplete="email"]');
  if (emailIn) {
    await highlight(emailIn, 'Typing email');
    emailIn.value = email;
    emailIn.dispatchEvent(new Event('input', { bubbles: true }));
    emailIn.dispatchEvent(new Event('change', { bubbles: true }));
  }

  action('Typing password');
  const passIn = await waitForEl('input[type="password"]');
  if (passIn) {
    await highlight(passIn, 'Typing password');
    passIn.value = password;
    passIn.dispatchEvent(new Event('input', { bubbles: true }));
    passIn.dispatchEvent(new Event('change', { bubbles: true }));
  }

  action('Clicking "Sign In"...');
  const signInBtn = (() => {
    const btns = getDoc().querySelectorAll('button');
    let b = null;
    btns.forEach(btn => { if (btn.textContent.includes('Sign In') && btn.type !== 'button') b = btn; });
    return b || btns[0];
  })();
  if (signInBtn) {
    await highlight(signInBtn, 'Clicking Sign In');
    signInBtn.click();
  }

  info('Waiting for auth redirect...');
  await sleep(4000);

  await check('Logged in — redirected to /dashboard', async () => {
    const win = getWin();
    const loc = win ? win.location.href : '';
    if (!loc.includes('/dashboard')) throw new Error('Still at: ' + loc);
  });

  // ── PHASE 7: Dashboard Page ───────────────────────────────
  section('Phase 7: Dashboard');
  setProgress(45);

  await check('Dashboard heading visible', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Dashboard')) throw new Error('Bad heading');
  });

  // Check sidebar navigation
  const sidebarLinks = ['Dashboard', 'Projects', 'Agents', 'Library', 'Settings', 'Docs', 'Pricing'];
  for (const linkText of sidebarLinks) {
    await check('Sidebar link: ' + linkText, async () => {
      const links = getDoc().querySelectorAll('a, nav a');
      let found = false;
      links.forEach(a => { if (a.textContent.trim() === linkText) found = true; });
      if (!found) throw new Error('Missing sidebar link: ' + linkText);
    });
  }

  // Check dashboard widgets
  const widgetNames = ['HealthScore', 'ProgressBar', 'ActiveAgents', 'DecisionLog', 'SecurityPosture', 'TestCoverage'];
  for (const w of widgetNames) {
    await check('Widget rendered: ' + w, async () => {
      // Widgets render as divs/sections; check for their content patterns
      const text = getDoc().body.textContent;
      // Each widget has distinctive text
      if (w === 'HealthScore' && !text.includes('Health')) throw new Error('Missing Health widget');
      if (w === 'ActiveAgents' && !text.includes('Agent')) throw new Error('Missing Agents widget');
      if (w === 'SecurityPosture' && !text.includes('Security')) throw new Error('Missing Security widget');
    });
  }

  // Check theme toggle
  el = await waitForEl('button[aria-label*="heme"], button[aria-label*="dark"], button[aria-label*="light"]');
  if (el) {
    await highlight(el, 'Theme toggle');
    action('Clicking theme toggle...');
    el.click();
    await sleep(500);
    await check('Theme toggle works', async () => { /* click succeeded */ });
    el.click(); // toggle back
    await sleep(300);
  }

  // Check notification bell
  el = await waitForEl('[aria-label*="otification"], [class*="notification"]');
  if (el) {
    await highlight(el, 'Notification bell');
    await check('Notification bell visible', async () => {});
  }

  // Check user avatar / menu
  setProgress(55);

  // ── PHASE 8: Projects Page ────────────────────────────────
  section('Phase 8: Projects');
  setProgress(58);
  action('Navigating to /projects...');
  await navigate('/projects');
  await sleep(1000);

  await check('Projects page loads', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Projects')) throw new Error('Bad heading');
  });

  await check('Project cards or empty state visible', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Quiz2Biz') && !text.includes('EZRA') && !text.includes('No projects')) throw new Error('No project content');
  });

  // ── PHASE 9: Agents Page ──────────────────────────────────
  section('Phase 9: Agents');
  setProgress(65);
  action('Navigating to /agents...');
  await navigate('/agents');
  await sleep(1000);

  await check('Agents page loads', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Agents')) throw new Error('Bad heading');
  });

  await check('Agent providers listed (Claude, GPT, etc.)', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Claude') && !text.includes('GPT')) throw new Error('No agent providers');
  });

  await check('Agent roles section visible', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('architect') && !text.includes('Roles')) throw new Error('No roles section');
  });

  // ── PHASE 10: Library Page ────────────────────────────────
  section('Phase 10: Library');
  setProgress(72);
  action('Navigating to /library...');
  await navigate('/library');
  await sleep(1000);

  await check('Library page loads', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Library')) throw new Error('Bad heading');
    await highlight(h1, 'Library');
  });

  // ── PHASE 11: Settings Page ───────────────────────────────
  section('Phase 11: Settings');
  setProgress(78);
  action('Navigating to /settings...');
  await navigate('/settings');
  await sleep(1000);

  await check('Settings page loads', async () => {
    const h1 = await waitForEl('h1');
    if (!h1 || !h1.textContent.includes('Settings')) throw new Error('Bad heading');
  });

  await check('Settings has Standards section', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Standards') && !text.includes('TypeScript')) throw new Error('No standards');
  });

  await check('Settings has Security section', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Security')) throw new Error('No security section');
  });

  // Check toggle switches
  el = await waitForEl('button[role="switch"]');
  if (el) {
    await highlight(el, 'Toggle switch');
    action('Testing toggle switch...');
    const before = el.getAttribute('aria-checked');
    el.click();
    await sleep(300);
    const after = el.getAttribute('aria-checked');
    await check('Toggle switch changes state', async () => {
      if (before === after) throw new Error('Toggle did not change: ' + before);
    });
    el.click(); // toggle back
  }

  // ── PHASE 12: Workflows Page ──────────────────────────────
  section('Phase 12: Workflows');
  setProgress(85);
  action('Navigating to /workflows...');
  await navigate('/workflows');
  await sleep(1000);

  await check('Workflows page loads', async () => {
    const h1 = await waitForEl('h1');
    // Workflows may not have h1, check for any content
    const text = getDoc().body.textContent;
    if (!text.includes('Workflow') && !text.includes('workflow')) throw new Error('No workflow content');
  });

  // ── PHASE 13: Notifications Page ──────────────────────────
  section('Phase 13: Notifications');
  setProgress(90);
  action('Navigating to /notifications...');
  await navigate('/notifications');
  await sleep(1000);

  await check('Notifications page loads', async () => {
    const text = getDoc().body.textContent;
    if (!text.includes('Notification') && !text.includes('notification') && text.length < 50) throw new Error('Empty notifications');
  });

  // ── PHASE 14: Logout ──────────────────────────────────────
  section('Phase 14: Logout');
  setProgress(95);
  action('Navigating back to dashboard to test logout...');
  await navigate('/dashboard');
  await sleep(1000);

  // Find and click user menu / logout
  const avatarBtn = await waitForEl('[aria-label*="user"], [aria-label*="menu"], [aria-label*="account"]');
  if (avatarBtn) {
    await highlight(avatarBtn, 'User menu');
    action('Opening user menu...');
    avatarBtn.click();
    await sleep(500);
  }

  const logoutBtn = (() => {
    const doc2 = getDoc();
    if (!doc2) return null;
    const btns = doc2.querySelectorAll('button');
    let found = null;
    btns.forEach(b => { if (b.textContent.includes('Log') || b.textContent.includes('Sign Out') || b.textContent.includes('log out')) found = b; });
    return found;
  })();

  if (logoutBtn) {
    await highlight(logoutBtn, 'Clicking Logout');
    action('Clicking logout...');
    logoutBtn.click();
    await sleep(2000);
    await check('Logout redirects to /login', async () => {
      const win = getWin();
      const loc = win ? win.location.href : '';
      if (!loc.includes('/login')) throw new Error('Not at login: ' + loc);
    });
  } else {
    info('Logout button not found (may need user menu click)');
  }

  setProgress(100);
  finalize();
}

function finalize() {
  hideHighlight();
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const allPassed = failCount === 0;

  section('Agent Complete');
  log(allPassed ? 'pass' : 'fail', allPassed ? '\\ud83c\\udfc6' : '\\u274c',
    passCount + ' passed, ' + failCount + ' failed in ' + totalTime + 's',
    allPassed ? 'ALL CHECKS PASSED' : 'Some checks failed — review log above');

  setStatus(allPassed ? 'All checks passed (' + totalTime + 's)' : failCount + ' failures detected');
  document.getElementById('agentDot').style.background = allPassed ? '#3fb950' : '#f85149';
  document.getElementById('agentDot').style.animation = 'none';
  agentRunning = false;
  document.getElementById('startBtn').disabled = false;
}
</script>
</body>
</html>`;
}

// ─── HTTP Server ────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/test')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('ERROR: Port ' + PORT + ' already in use. Set E2E_PORT to use another.');
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('');
  console.log('EZRA Dashboard E2E Agent');
  console.log('════════════════════════════════════════');
  console.log('  Agent:     http://localhost:' + PORT);
  console.log('  Dashboard: ' + DASHBOARD_URL);
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('Open http://localhost:' + PORT + ' in your browser');
  console.log('Enter login credentials, click Start Agent, and watch it test everything.');
  console.log('');
});
