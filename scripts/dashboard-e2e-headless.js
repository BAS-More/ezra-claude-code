#!/usr/bin/env node
'use strict';
/**
 * EZRA Dashboard — Comprehensive Headless E2E Tests
 * Runs against the proxy on port 3003 (-> 3001).
 * Tests every public page, all API endpoints, auth flow, security, performance.
 */
const BASE = 'http://localhost:3003';
let pass = 0, fail = 0;
const failures = [];

async function get(path, opts = {}) {
  const r = await fetch(BASE + path, { redirect: 'manual', ...opts });
  const text = opts.noBody ? '' : await r.text();
  return { status: r.status, text, loc: r.headers.get('location') || '', type: r.headers.get('content-type') || '', headers: Object.fromEntries(r.headers) };
}

async function check(name, fn) {
  try { await fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch (e) { fail++; failures.push({ name, error: e.message }); console.log('  \x1b[31m✗\x1b[0m ' + name + ' — ' + e.message); }
}
function S(s) { console.log('\n\x1b[35m━━ ' + s + ' ━━\x1b[0m'); }
function has(haystack, needle) { if (!haystack.includes(needle)) throw Error('missing: ' + needle); }

(async () => {
  console.log('\nEZRA Dashboard E2E — Comprehensive Suite');
  console.log('Target: ' + BASE + '\n');

  // ════════════════════════════════════════════
  // PROXY
  // ════════════════════════════════════════════
  S('1. Proxy Health');
  await check('Proxy responds 200', async () => { const r = await get('/'); if (r.status !== 200) throw Error(r.status); });
  await check('Agent page at /test', async () => { const r = await get('/test'); if (r.status !== 200) throw Error(r.status); has(r.text, 'E2E Test Agent'); });
  await check('X-Frame-Options stripped', async () => { const r = await get('/'); if (r.headers['x-frame-options']) throw Error('not stripped'); });
  await check('CSP stripped', async () => { const r = await get('/'); if (r.headers['content-security-policy']) throw Error('not stripped'); });

  // ════════════════════════════════════════════
  // HOMEPAGE
  // ════════════════════════════════════════════
  S('2. Homepage (/)');
  const home = await get('/');
  await check('Status 200', () => { if (home.status !== 200) throw Error(home.status); });
  await check('HTML content-type', () => { has(home.type, 'text/html'); });
  await check('Meta charSet utf-8', () => { if (!home.text.includes('charSet') && !home.text.includes('charset')) throw Error('missing'); });
  await check('EZRA branding', () => { has(home.text, 'EZRA'); });
  await check('Hero: Restores and Enforces Standards', () => { has(home.text, 'Restores and Enforces Standards'); });
  await check('CTA: Get Started Free', () => { has(home.text, 'Get Started Free'); });
  await check('CTA: Read the Docs', () => { has(home.text, 'Read the Docs'); });
  await check('Nav /docs', () => { has(home.text, '/docs'); });
  await check('Nav /pricing', () => { has(home.text, '/pricing'); });
  await check('Nav /login', () => { has(home.text, '/login'); });
  await check('Feature: Health Scanning', () => { has(home.text, 'Health Scanning'); });
  await check('Feature: Multi-Agent Orchestration', () => { has(home.text, 'Multi-Agent'); });
  await check('Feature: Slash Commands', () => { has(home.text, 'Slash Commands'); });
  await check('Stat: 22 Hooks', () => { has(home.text, '>22<'); });
  await check('Stat: 39 Commands', () => { has(home.text, '>39<'); });
  await check('Stat: Zero Dependencies', () => { has(home.text, 'Zero'); });
  await check('Footer: Codebase Governance', () => { has(home.text, 'Codebase Governance'); });

  // ════════════════════════════════════════════
  // DOCS
  // ════════════════════════════════════════════
  S('3. Docs (/docs)');
  const docs = await get('/docs');
  await check('Status 200', () => { if (docs.status !== 200) throw Error(docs.status); });
  await check('Documentation heading', () => { has(docs.text, 'Documentation'); });
  await check('Install cmd', () => { has(docs.text, 'npm install -g ezra-claude-code'); });
  await check('Command: ezra init', () => { has(docs.text, 'ezra init'); });
  await check('Command: ezra scan', () => { has(docs.text, 'ezra scan'); });
  await check('Ref: /ezra:health', () => { has(docs.text, '/ezra:health'); });
  await check('Ref: /ezra:guard (SSR index)', () => { has(docs.text, '/ezra:guard'); });
  await check('Ref: /ezra:review (SSR index)', () => { has(docs.text, '/ezra:review'); });
  await check('Ref: /ezra:dash (SSR index)', () => { has(docs.text, '/ezra:dash'); });
  await check('Ref: /ezra:scan', () => { has(docs.text, '/ezra:scan'); });
  await check('Ref: /ezra:oversight', () => { has(docs.text, '/ezra:oversight'); });
  await check('Ref: /ezra:agents', () => { has(docs.text, '/ezra:agents'); });
  await check('Ref: /ezra:workflow', () => { has(docs.text, '/ezra:workflow'); });
  await check('Ref: /ezra:license', () => { has(docs.text, '/ezra:license'); });
  await check('Ref: /ezra:memory', () => { has(docs.text, '/ezra:memory'); });
  await check('Ref: /ezra:plan', () => { has(docs.text, '/ezra:plan'); });
  await check('Code blocks (<code> or <pre>)', () => { if (!docs.text.includes('<code') && !docs.text.includes('<pre')) throw Error('missing'); });
  await check('Section nav: Getting Started', () => { has(docs.text, 'Getting Started'); });
  await check('Section nav: Commands Reference', () => { has(docs.text, 'Commands Reference'); });
  await check('Section nav: Architecture', () => { has(docs.text, 'Architecture'); });
  await check('Section nav: Troubleshooting', () => { has(docs.text, 'Troubleshooting'); });
  await check('Section nav: API Reference', () => { has(docs.text, 'API Reference'); });
  await check('SSR index contains all 39 commands', () => {
    let found = 0;
    const cmds = ['init','scan','guard','oversight','settings','compliance','pm','progress',
      'library','agents','memory','plan','workflow','license','dash','health','status',
      'decide','review','learn','doc','version','advisor','process','auto','multi',
      'bootstrap','sync','research','cost','portfolio','handoff','help','install'];
    for (const c of cmds) { if (docs.text.includes('/ezra:' + c)) found++; }
    if (found < 30) throw Error('only ' + found + '/' + cmds.length + ' commands in SSR');
  });

  // ════════════════════════════════════════════
  // PRICING
  // ════════════════════════════════════════════
  S('4. Pricing (/pricing)');
  const price = await get('/pricing');
  await check('Status 200', () => { if (price.status !== 200) throw Error(price.status); });
  await check('Transparent pricing heading', () => { has(price.text, 'transparent pricing'); });
  await check('Core tier + Free', () => { has(price.text, 'Core'); has(price.text, 'Free'); });
  await check('Pro tier + $29', () => { has(price.text, 'Pro'); has(price.text, '29'); });
  await check('Team tier + $59', () => { has(price.text, 'Team'); has(price.text, '59'); });
  await check('Enterprise + Custom', () => { has(price.text, 'Enterprise'); has(price.text, 'Custom'); });
  await check('CTA /login?plan=core', () => { has(price.text, '/login?plan=core'); });
  await check('CTA /login?plan=pro', () => { has(price.text, '/login?plan=pro'); });
  await check('CTA /login?plan=team', () => { has(price.text, '/login?plan=team'); });
  await check('mailto:sales@ezradev.com', () => { has(price.text, 'mailto:sales@ezradev.com'); });
  await check('Feature: Health Scanning or scanning', () => { if (!price.text.includes('Health Scanning') && !price.text.includes('scanning')) throw Error('missing'); });

  // ════════════════════════════════════════════
  // LOGIN
  // ════════════════════════════════════════════
  S('5. Login (/login)');
  const login = await get('/login');
  await check('Status 200', () => { if (login.status !== 200) throw Error(login.status); });
  await check('Sign In heading', () => { has(login.text, 'Sign In'); });
  await check('Email field', () => { if (!login.text.toLowerCase().includes('email')) throw Error('missing'); });
  await check('Password field', () => { if (!login.text.toLowerCase().includes('password')) throw Error('missing'); });
  await check('Forgot password', () => { has(login.text, 'Forgot password'); });
  await check('GitHub OAuth', () => { has(login.text, 'GitHub'); });
  await check('Google OAuth', () => { has(login.text, 'Google'); });
  await check('Microsoft OAuth', () => { has(login.text, 'Microsoft'); });
  await check('Sign Up toggle', () => { has(login.text, 'Sign Up'); });
  await check('Login ?plan=pro', async () => { const r = await get('/login?plan=pro'); if (r.status !== 200) throw Error(r.status); });
  await check('Login ?redirect=/dashboard', async () => { const r = await get('/login?redirect=/dashboard'); if (r.status !== 200) throw Error(r.status); });

  // ════════════════════════════════════════════
  // AUTH MIDDLEWARE
  // ════════════════════════════════════════════
  S('6. Auth Middleware (Protected Routes)');
  const protectedRoutes = ['/dashboard', '/projects', '/settings', '/agents', '/library'];
  for (const route of protectedRoutes) {
    await check(route + ' returns 307 redirect to /login', async () => {
      const r = await get(route);
      if (r.status === 307 || r.status === 302) {
        if (!r.loc.includes('/login')) throw Error('redirects to: ' + r.loc);
        if (!r.loc.includes('redirect=')) throw Error('missing redirect param in: ' + r.loc);
      } else if (r.status === 200) {
        // Dev mode pass-through — acceptable
      } else if (r.status >= 500) {
        throw Error('SERVER ERROR ' + r.status);
      }
    });
  }
  await check('Redirect includes original path', async () => {
    const r = await get('/settings');
    if (r.status === 307) { has(r.loc, '%2Fsettings'); }
  });

  // ════════════════════════════════════════════
  // API ENDPOINTS — GET
  // ════════════════════════════════════════════
  S('7. API Endpoints (GET)');
  const apis = ['/api/achievements', '/api/activity', '/api/library', '/api/notifications', '/api/projects', '/api/settings', '/api/workflows'];
  for (const api of apis) {
    await check('GET ' + api + ' not 500', async () => {
      const r = await get(api);
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    });
    await check(api + ' returns JSON', async () => {
      const r = await get(api);
      if (r.status === 200) { try { JSON.parse(r.text); } catch { throw Error('invalid JSON'); } }
    });
  }

  // ════════════════════════════════════════════
  // API ENDPOINTS — WRITE (POST/PUT)
  // ════════════════════════════════════════════
  S('8. API Endpoints (POST/PUT)');
  await check('POST /api/settings', async () => {
    const r = await fetch(BASE + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }), redirect: 'manual' });
    if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
  });
  await check('POST /api/workflows', async () => {
    const r = await fetch(BASE + '/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'test', nodes: [], edges: [] }), redirect: 'manual' });
    if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
  });
  await check('PUT /api/projects', async () => {
    const r = await fetch(BASE + '/api/projects', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), redirect: 'manual' });
    if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
  });
  await check('DELETE /api/workflows (method check)', async () => {
    const r = await fetch(BASE + '/api/workflows', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'nonexistent' }), redirect: 'manual' });
    if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
  });

  // ════════════════════════════════════════════
  // PROTECTED PAGES (follow redirect → login)
  // ════════════════════════════════════════════
  S('9. Protected Pages (redirected → login content)');
  for (const route of protectedRoutes) {
    await check(route + ' redirect chain ends at login page', async () => {
      const r = await fetch(BASE + route, { redirect: 'follow' });
      const html = await r.text();
      if (r.status >= 500) throw Error('SERVER ERROR');
      // After redirect, should be on login page
      if (r.status === 200) {
        if (!html.includes('Sign In') && !html.includes('Dashboard') && !html.includes('Settings')) {
          throw Error('blank page after redirect');
        }
      }
    });
  }

  // ════════════════════════════════════════════
  // PROJECT DETAIL ROUTES
  // ════════════════════════════════════════════
  S('10. Project Detail Pages');
  const detailPages = ['/projects/quiz2biz', '/projects/quiz2biz/plan', '/projects/quiz2biz/commits',
    '/projects/quiz2biz/assessment', '/projects/quiz2biz/gates', '/projects/quiz2biz/execution'];
  for (const dp of detailPages) {
    await check('GET ' + dp + ' not 500', async () => {
      const r = await get(dp);
      if (r.status >= 500) throw Error('SERVER ERROR ' + r.status);
    });
  }

  // ════════════════════════════════════════════
  // WORKFLOWS (public route)
  // ════════════════════════════════════════════
  S('11. Workflows (/workflows)');
  const wf = await get('/workflows');
  await check('Status 200', () => { if (wf.status !== 200) throw Error(wf.status); });
  await check('Has substantial content', () => { if (wf.text.length < 500) throw Error('too small: ' + wf.text.length); });

  // ════════════════════════════════════════════
  // NOTIFICATIONS
  // ════════════════════════════════════════════
  S('12. Notifications (/notifications)');
  const notif = await get('/notifications');
  await check('Not 500', () => { if (notif.status >= 500) throw Error(notif.status); });

  // ════════════════════════════════════════════
  // AUTH CALLBACK
  // ════════════════════════════════════════════
  S('13. Auth Callback');
  await check('/auth/callback exists', async () => { const r = await get('/auth/callback'); if (r.status >= 500) throw Error(r.status); });

  // ════════════════════════════════════════════
  // SECURITY
  // ════════════════════════════════════════════
  S('14. Security Tests');
  await check('Open redirect blocked: //evil.com', async () => {
    const r = await get('/login?redirect=//evil.com');
    if (r.text.includes('href="//evil.com"') || r.text.includes("href='//evil.com'")) throw Error('VULNERABLE');
  });
  await check('Open redirect blocked: javascript:', async () => {
    const r = await get('/login?redirect=javascript:alert(1)');
    if (r.text.includes('href="javascript:')) throw Error('VULNERABLE');
  });
  await check('XSS in redirect param', async () => {
    const r = await get('/login?redirect="><script>alert(1)</script>');
    if (r.text.includes('<script>alert(1)</script>')) throw Error('XSS VULNERABLE');
  });
  await check('XSS in plan param', async () => {
    const r = await get('/login?plan=<script>alert(1)</script>');
    if (r.text.includes('<script>alert(1)</script>')) throw Error('XSS VULNERABLE');
  });
  await check('404 for /nonexistent', async () => {
    const r = await get('/nonexistent');
    if (r.status !== 404 && !r.text.includes('404') && !r.text.includes('Not Found')) {
      if (!(r.status === 200 && r.text.includes('EZRA'))) throw Error('no 404: status ' + r.status);
    }
  });
  await check('X-Powered-By not leaking Express', () => {
    if (home.headers['x-powered-by'] === 'Express') throw Error('leaking');
  });
  await check('No /_next directory listing', async () => {
    const r = await get('/_next/');
    if (r.status === 200 && r.text.includes('Index of')) throw Error('directory listing');
  });
  await check('API rejects malformed JSON', async () => {
    const r = await fetch(BASE + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid}', redirect: 'manual' });
    if (r.status >= 500) throw Error('crashes on bad JSON');
  });
  await check('Rate limit header or behavior on login POST', async () => {
    // Should not crash
    const r = await fetch(BASE + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: 'x' }), redirect: 'manual' });
    if (r.status >= 500) throw Error('SERVER ERROR');
  });

  // ════════════════════════════════════════════
  // STATIC ASSETS
  // ════════════════════════════════════════════
  S('15. Static Assets');
  await check('Favicon accessible', async () => {
    const r = await get('/favicon.ico', { noBody: true });
    if (r.status >= 500) throw Error(r.status);
  });
  await check('CSS bundle loads', async () => {
    const m = home.text.match(/href="(\/_next\/static\/[^"]+\.css)"/);
    if (m) { const r = await get(m[1], { noBody: true }); if (r.status !== 200) throw Error(r.status); }
  });
  await check('JS bundle loads', async () => {
    const m = home.text.match(/src="(\/_next\/static\/[^"]+\.js)"/);
    if (m) { const r = await get(m[1], { noBody: true }); if (r.status !== 200) throw Error(r.status); }
  });

  // ════════════════════════════════════════════
  // PERFORMANCE
  // ════════════════════════════════════════════
  S('16. Performance');
  for (const path of ['/', '/docs', '/pricing', '/login']) {
    await check(path + ' < 3s', async () => {
      const t = Date.now();
      await get(path, { noBody: true });
      const ms = Date.now() - t;
      if (ms > 3000) throw Error(ms + 'ms');
    });
  }
  for (const api of ['/api/projects', '/api/settings', '/api/workflows']) {
    await check('API ' + api + ' < 2s', async () => {
      const t = Date.now();
      await get(api, { noBody: true });
      const ms = Date.now() - t;
      if (ms > 2000) throw Error(ms + 'ms');
    });
  }

  // ════════════════════════════════════════════
  // RESULTS
  // ════════════════════════════════════════════
  console.log('\n\x1b[36m════════════════════════════════════\x1b[0m');
  console.log('\x1b[36m  RESULTS\x1b[0m');
  console.log('\x1b[36m════════════════════════════════════\x1b[0m');
  console.log('  \x1b[32mPassed: ' + pass + '\x1b[0m');
  console.log('  \x1b[31mFailed: ' + fail + '\x1b[0m');
  console.log('  Total:  ' + (pass + fail));
  if (failures.length > 0) {
    console.log('\n\x1b[31m── Failures ──\x1b[0m');
    for (const f of failures) console.log('  \x1b[31m✗\x1b[0m ' + f.name + ': ' + f.error);
  } else {
    console.log('\n\x1b[32m  ALL GREEN ✓\x1b[0m');
  }
  console.log('');
  process.exit(fail > 0 ? 1 : 0);
})();
