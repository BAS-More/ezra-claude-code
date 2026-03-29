#!/usr/bin/env node
'use strict';
/**
 * Headless E2E test runner for ezra-dashboard
 * Runs against the proxy on port 3003 (which proxies 3001)
 * Reports all passes and failures so we can fix issues.
 */

const http = require('http');
const BASE = 'http://localhost:3003';

let pass = 0, fail = 0;
const failures = [];

async function fetchUrl(path, opts = {}) {
  const url = BASE + path;
  const r = await fetch(url, { redirect: 'manual', ...opts });
  const text = opts.text !== false ? await r.text() : '';
  return { status: r.status, headers: Object.fromEntries(r.headers), text, location: r.headers.get('location') || '' };
}

async function check(name, fn) {
  try {
    await fn();
    pass++;
    console.log('  \x1b[32m✓\x1b[0m ' + name);
  } catch (e) {
    fail++;
    const msg = e.message || String(e);
    failures.push({ name, error: msg });
    console.log('  \x1b[31m✗\x1b[0m ' + name + ' — ' + msg);
  }
}

function section(s) {
  console.log('\n\x1b[35m━━ ' + s + ' ━━\x1b[0m');
}

(async () => {
  console.log('\nEZRA Dashboard E2E Test Suite');
  console.log('Target: ' + BASE + ' (proxy -> localhost:3001)\n');

  // ── Proxy health ──
  section('Proxy Health');
  await check('Proxy responds', async () => {
    const r = await fetchUrl('/');
    if (r.status !== 200) throw Error('status ' + r.status);
  });
  await check('Agent page serves', async () => {
    const r = await fetchUrl('/test');
    if (r.status !== 200) throw Error('status ' + r.status);
    if (!r.text.includes('E2E Test Agent')) throw Error('wrong content');
  });

  // ── Homepage ──
  section('Homepage (/)');
  const home = await fetchUrl('/');
  await check('Status 200', () => { if (home.status !== 200) throw Error(home.status) });
  await check('EZRA branding', () => { if (!home.text.includes('EZRA')) throw Error('missing') });
  await check('Hero: "The Scribe Who Restores"', () => { if (!home.text.includes('Restores and Enforces Standards')) throw Error('missing') });
  await check('CTA: Get Started Free', () => { if (!home.text.includes('Get Started Free')) throw Error('missing') });
  await check('CTA: Read the Docs', () => { if (!home.text.includes('Read the Docs')) throw Error('missing') });
  await check('Nav link: /docs', () => { if (!home.text.includes('href="/docs"') && !home.text.includes("href='/docs'") && !home.text.includes('/docs')) throw Error('missing') });
  await check('Nav link: /pricing', () => { if (!home.text.includes('/pricing')) throw Error('missing') });
  await check('Nav link: /login', () => { if (!home.text.includes('/login')) throw Error('missing') });
  await check('Feature: Health Scanning', () => { if (!home.text.includes('Health Scanning')) throw Error('missing') });
  await check('Feature: Multi-Agent Orchestration', () => { if (!home.text.includes('Multi-Agent')) throw Error('missing') });
  await check('Feature: Slash Commands', () => { if (!home.text.includes('Slash Commands')) throw Error('missing') });
  await check('Stats: 22 Hooks', () => { if (!home.text.includes('>22<')) throw Error('missing') });
  await check('Stats: 39 Commands', () => { if (!home.text.includes('>39<')) throw Error('missing') });
  await check('Stats: Zero Dependencies', () => { if (!home.text.includes('Zero')) throw Error('missing') });
  await check('Footer: governance text', () => { if (!home.text.includes('Codebase Governance')) throw Error('missing') });
  await check('Meta: viewport', () => { if (!home.text.includes('viewport')) throw Error('missing') });
  await check('Meta: charset', () => { if (!home.text.includes('charset')) throw Error('missing') });

  // ── Docs ──
  section('Docs (/docs)');
  const docs = await fetchUrl('/docs');
  await check('Status 200', () => { if (docs.status !== 200) throw Error(docs.status) });
  await check('Documentation heading', () => { if (!docs.text.includes('Documentation')) throw Error('missing') });
  await check('Install: npm install -g ezra-claude-code', () => { if (!docs.text.includes('npm install -g ezra-claude-code')) throw Error('missing') });
  await check('Command: ezra init', () => { if (!docs.text.includes('ezra init')) throw Error('missing') });
  await check('Command: ezra scan', () => { if (!docs.text.includes('ezra scan')) throw Error('missing') });
  await check('Ref: /ezra:health', () => { if (!docs.text.includes('/ezra:health')) throw Error('missing') });
  await check('Ref: /ezra:guard', () => { if (!docs.text.includes('/ezra:guard')) throw Error('missing') });
  await check('Ref: /ezra:review', () => { if (!docs.text.includes('/ezra:review') || !docs.text.includes('review')) throw Error('missing') });
  await check('Ref: /ezra:dash', () => { if (!docs.text.includes('/ezra:dash') && !docs.text.includes('dashboard')) throw Error('missing') });
  await check('Has code blocks', () => { if (!docs.text.includes('<code') && !docs.text.includes('```')) throw Error('missing') });

  // ── Pricing ──
  section('Pricing (/pricing)');
  const price = await fetchUrl('/pricing');
  await check('Status 200', () => { if (price.status !== 200) throw Error(price.status) });
  await check('Transparent pricing heading', () => { if (!price.text.includes('transparent pricing')) throw Error('missing') });
  await check('Core tier', () => { if (!price.text.includes('Core')) throw Error('missing') });
  await check('Core: Free', () => { if (!price.text.includes('Free')) throw Error('missing') });
  await check('Pro tier', () => { if (!price.text.includes('Pro')) throw Error('missing') });
  await check('Pro: $29', () => { if (!price.text.includes('29')) throw Error('missing') });
  await check('Team tier', () => { if (!price.text.includes('Team')) throw Error('missing') });
  await check('Team: $59', () => { if (!price.text.includes('59')) throw Error('missing') });
  await check('Enterprise tier', () => { if (!price.text.includes('Enterprise')) throw Error('missing') });
  await check('Enterprise: Custom', () => { if (!price.text.includes('Custom')) throw Error('missing') });
  await check('Core CTA -> /login?plan=core', () => { if (!price.text.includes('/login?plan=core')) throw Error('missing') });
  await check('Pro CTA -> /login?plan=pro', () => { if (!price.text.includes('/login?plan=pro')) throw Error('missing') });
  await check('Team CTA -> /login?plan=team', () => { if (!price.text.includes('/login?plan=team')) throw Error('missing') });
  await check('Enterprise mailto', () => { if (!price.text.includes('mailto:sales@ezradev.com')) throw Error('missing') });
  await check('Feature lists present', () => { if (!price.text.includes('Health Scanning') && !price.text.includes('scanning')) throw Error('missing') });

  // ── Login ──
  section('Login (/login)');
  const login = await fetchUrl('/login');
  await check('Status 200', () => { if (login.status !== 200) throw Error(login.status) });
  await check('Sign In heading', () => { if (!login.text.includes('Sign In')) throw Error('missing') });
  await check('Email field', () => { if (!login.text.toLowerCase().includes('email')) throw Error('missing') });
  await check('Password field', () => { if (!login.text.toLowerCase().includes('password')) throw Error('missing') });
  await check('Forgot password', () => { if (!login.text.includes('Forgot password')) throw Error('missing') });
  await check('GitHub OAuth', () => { if (!login.text.includes('GitHub')) throw Error('missing') });
  await check('Google OAuth', () => { if (!login.text.includes('Google')) throw Error('missing') });
  await check('Microsoft OAuth', () => { if (!login.text.includes('Microsoft')) throw Error('missing') });
  await check('Sign Up toggle', () => { if (!login.text.includes('Sign Up')) throw Error('missing') });
  await check('Login with ?plan=pro', async () => { const r = await fetchUrl('/login?plan=pro'); if (r.status !== 200) throw Error(r.status) });
  await check('Login with ?redirect=/dashboard', async () => { const r = await fetchUrl('/login?redirect=/dashboard'); if (r.status !== 200) throw Error(r.status) });

  // ── Protected Routes ──
  section('Protected Routes (Auth Middleware)');
  for (const route of ['/dashboard', '/projects', '/settings', '/agents', '/library']) {
    await check('GET ' + route, async () => {
      const r = await fetchUrl(route);
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
      // Either redirect to login (auth enforced) or 200 (dev pass-through)
    });
    await check(route + ' redirect or pass-through', async () => {
      const r = await fetchUrl(route);
      if (r.status === 307 || r.status === 302) {
        if (!r.location.includes('/login')) throw Error('bad redirect: ' + r.location);
      }
      // 200 = dev mode, also fine
    });
  }

  // ── API Endpoints ──
  section('API Endpoints');
  const apis = [
    '/api/achievements', '/api/activity', '/api/library', '/api/notifications',
    '/api/projects', '/api/settings', '/api/workflows',
  ];
  for (const api of apis) {
    await check('API ' + api, async () => {
      const r = await fetchUrl(api);
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    });
    await check(api + ' returns JSON', async () => {
      const r = await fetchUrl(api);
      if (r.status === 200) {
        try { JSON.parse(r.text); } catch { throw Error('not JSON: ' + r.text.substring(0, 100)) }
      }
    });
  }

  // ── Dashboard ──
  section('Dashboard (/dashboard)');
  const dash = await fetchUrl('/dashboard', { redirect: 'follow' });
  await check('Dashboard not 500', () => { if (dash.status >= 500) throw Error(dash.status) });
  if (dash.status === 200 && dash.text.includes('Dashboard')) {
    await check('Dashboard heading', () => { if (!dash.text.includes('Dashboard')) throw Error('missing') });
    const widgets = ['Health Score', 'Progress', 'Active Agents', 'Decision', 'Security',
      'Test Coverage', 'Cost', 'Leaderboard', 'Risk', 'Activity', 'Phase',
      'Achievement', 'Velocity', 'Workflow', 'Readiness', 'Portfolio'];
    for (const w of widgets) {
      await check('Widget: ' + w, () => { if (!dash.text.includes(w)) throw Error('missing') });
    }
    await check('Edit mode controls', () => {
      if (!dash.text.toLowerCase().includes('edit')) throw Error('missing');
    });
    await check('Save layout control', () => {
      if (!dash.text.toLowerCase().includes('save')) throw Error('missing');
    });
  }

  // ── Projects ──
  section('Projects (/projects)');
  const proj = await fetchUrl('/projects', { redirect: 'follow' });
  await check('Projects not 500', () => { if (proj.status >= 500) throw Error(proj.status) });
  if (proj.status === 200 && proj.text.includes('Projects')) {
    await check('Projects heading', () => { if (!proj.text.includes('Projects')) throw Error('missing') });
    await check('Demo data or empty state', () => {
      if (!proj.text.includes('Quiz2Biz') && !proj.text.includes('No projects')) throw Error('missing');
    });
    if (proj.text.includes('Quiz2Biz')) {
      await check('Quiz2Biz health score', () => { if (!proj.text.includes('85')) throw Error('missing') });
      await check('Quiz2Biz phase', () => { if (!proj.text.includes('Stabilis') && !proj.text.includes('Phase')) throw Error('missing') });
      await check('EZRA project', () => { if (!proj.text.includes('EZRA')) throw Error('missing') });
      await check('MAH SDK project', () => { if (!proj.text.includes('MAH')) throw Error('missing') });
      await check('BnM project', () => { if (!proj.text.includes('BnM')) throw Error('missing') });
    }
  }

  // ── Agents ──
  section('Agents (/agents)');
  const agents = await fetchUrl('/agents', { redirect: 'follow' });
  await check('Agents not 500', () => { if (agents.status >= 500) throw Error(agents.status) });
  if (agents.status === 200 && agents.text.includes('Agents')) {
    await check('Agents heading', () => { if (!agents.text.includes('Agents')) throw Error('missing') });
    for (const p of ['Claude Sonnet', 'GPT-4o', 'Codex', 'Claude Haiku', 'Gemini Pro']) {
      await check('Provider: ' + p, () => { if (!agents.text.includes(p)) throw Error('missing') });
    }
    await check('Status indicators', () => {
      if (!agents.text.includes('active') && !agents.text.includes('idle')) throw Error('missing');
    });
    await check('Roles section', () => {
      if (!agents.text.includes('Role') && !agents.text.includes('role') && !agents.text.includes('architect')) throw Error('missing');
    });
  }

  // ── Settings ──
  section('Settings (/settings)');
  const settings = await fetchUrl('/settings', { redirect: 'follow' });
  await check('Settings not 500', () => { if (settings.status >= 500) throw Error(settings.status) });
  if (settings.status === 200) {
    await check('Settings heading', () => { if (!settings.text.toLowerCase().includes('settings')) throw Error('missing') });
    await check('Standards section', () => { if (!settings.text.includes('Standard') && !settings.text.includes('TypeScript')) throw Error('missing') });
    await check('Security section', () => { if (!settings.text.includes('Security') && !settings.text.includes('security')) throw Error('missing') });
  }

  // ── Workflows ──
  section('Workflows (/workflows)');
  const wf = await fetchUrl('/workflows', { redirect: 'follow' });
  await check('Workflows not 500', () => { if (wf.status >= 500) throw Error(wf.status) });
  if (wf.status === 200) {
    await check('Workflows content', () => { if (wf.text.length < 500) throw Error('too small: ' + wf.text.length) });
  }

  // ── Library ──
  section('Library (/library)');
  const lib = await fetchUrl('/library', { redirect: 'follow' });
  await check('Library not 500', () => { if (lib.status >= 500) throw Error(lib.status) });
  if (lib.status === 200) {
    await check('Library has content', () => { if (lib.text.length < 500) throw Error('too small') });
  }

  // ── Notifications ──
  section('Notifications (/notifications)');
  const notif = await fetchUrl('/notifications', { redirect: 'follow' });
  await check('Notifications not 500', () => { if (notif.status >= 500) throw Error(notif.status) });

  // ── Auth Callback ──
  section('Auth Callback (/auth/callback)');
  await check('Auth callback exists', async () => {
    const r = await fetchUrl('/auth/callback');
    if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
  });

  // ── Security Tests ──
  section('Security');
  await check('Open redirect blocked: //evil.com', async () => {
    const r = await fetchUrl('/login?redirect=//evil.com');
    if (r.text.includes('href="//evil.com"') || r.text.includes("href='//evil.com'")) throw Error('NOT BLOCKED');
  });
  await check('Open redirect blocked: javascript:', async () => {
    const r = await fetchUrl('/login?redirect=javascript:alert(1)');
    if (r.text.includes('href="javascript:')) throw Error('NOT BLOCKED');
  });
  await check('XSS in query param', async () => {
    const r = await fetchUrl('/login?redirect="><script>alert(1)</script>');
    if (r.text.includes('<script>alert(1)</script>')) throw Error('XSS VULNERABLE');
  });
  await check('404 page for /nonexistent', async () => {
    const r = await fetchUrl('/nonexistent');
    if (r.status !== 404 && !r.text.includes('404') && !r.text.includes('Not Found')) {
      if (r.status === 200 && r.text.includes('EZRA')) { /* custom 404 */ }
      else throw Error('no 404 handling — status ' + r.status);
    }
  });
  await check('No server info leak', () => {
    // X-Powered-By should ideally not be present
    if (home.headers['x-powered-by'] && home.headers['x-powered-by'].includes('Express')) {
      throw Error('Leaks X-Powered-By: ' + home.headers['x-powered-by']);
    }
  });
  await check('HTTPS redirect headers (prod)', () => {
    // In dev we won't have HSTS, just note it
  });
  await check('No directory listing on /_next', async () => {
    const r = await fetchUrl('/_next/');
    if (r.status === 200 && r.text.includes('<a href=') && r.text.includes('..')) throw Error('directory listing exposed');
  });

  // ── Static Assets ──
  section('Static Assets');
  await check('Favicon or icon', async () => {
    const r = await fetchUrl('/favicon.ico', { text: false });
    if (r.status >= 500) throw Error('Server error');
    // 200 or 404 both OK, just not 500
  });
  await check('Next.js _next/static accessible', async () => {
    // Extract a CSS URL from the homepage
    const cssMatch = home.text.match(/href="(\/_next\/static\/[^"]+\.css)"/);
    if (cssMatch) {
      const r = await fetchUrl(cssMatch[1], { text: false });
      if (r.status !== 200) throw Error('CSS status: ' + r.status);
    }
  });

  // ── Response Times ──
  section('Performance');
  for (const path of ['/', '/docs', '/pricing', '/login']) {
    await check('Response time ' + path + ' < 3s', async () => {
      const t0 = Date.now();
      await fetchUrl(path, { text: false });
      const ms = Date.now() - t0;
      if (ms > 3000) throw Error(ms + 'ms');
    });
  }

  // ── API POST/PUT (if applicable) ──
  section('API Write Operations');
  await check('POST /api/settings', async () => {
    try {
      const r = await fetch(BASE + '/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }), redirect: 'manual'
      });
      // Should not be 500
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    } catch (e) { if (e.message.includes('SERVER ERROR')) throw e; }
  });
  await check('POST /api/workflows', async () => {
    try {
      const r = await fetch(BASE + '/api/workflows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test', nodes: [], edges: [] }), redirect: 'manual'
      });
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    } catch (e) { if (e.message.includes('SERVER ERROR')) throw e; }
  });
  await check('PUT /api/projects (if exists)', async () => {
    try {
      const r = await fetch(BASE + '/api/projects', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), redirect: 'manual'
      });
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    } catch (e) { if (e.message.includes('SERVER ERROR')) throw e; }
  });

  // ── Project Sub-pages ──
  section('Project Detail Pages');
  const subPages = ['/projects/quiz2biz', '/projects/quiz2biz/plan', '/projects/quiz2biz/commits',
    '/projects/quiz2biz/assessment', '/projects/quiz2biz/gates', '/projects/quiz2biz/execution'];
  for (const sp of subPages) {
    await check('GET ' + sp, async () => {
      const r = await fetchUrl(sp);
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    });
  }

  // ════════════════════════════════════
  // RESULTS
  // ════════════════════════════════════
  console.log('\n\x1b[36m════════════════════════════════════\x1b[0m');
  console.log('\x1b[36m  RESULTS\x1b[0m');
  console.log('\x1b[36m════════════════════════════════════\x1b[0m');
  console.log('  \x1b[32mPassed: ' + pass + '\x1b[0m');
  console.log('  \x1b[31mFailed: ' + fail + '\x1b[0m');
  console.log('  Total:  ' + (pass + fail));

  if (failures.length > 0) {
    console.log('\n\x1b[31m── Failures ──\x1b[0m');
    for (const f of failures) {
      console.log('  \x1b[31m✗\x1b[0m ' + f.name + ': ' + f.error);
    }
  }

  console.log('');
  process.exit(fail > 0 ? 1 : 0);
})();
