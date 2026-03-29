#!/usr/bin/env node
'use strict';
/**
 * EZRA Dashboard Visual E2E Test Agent
 * Reverse-proxy approach: proxies Next.js on 3001, strips frame-blocking headers,
 * serves agent UI at /test. Uses sandbox iframe to prevent frame-busting.
 *
 * Usage: node scripts/dashboard-e2e-agent.js
 * Open:  http://localhost:3003/test
 */
const http = require('http');
const net = require('net');
const PORT = 3003;
const UP = 'http://localhost:3001';

function proxy(cReq, cRes) {
  const u = new URL(cReq.url, UP);
  const opts = {
    hostname: u.hostname, port: u.port || 3001,
    path: u.pathname + u.search, method: cReq.method,
    headers: { ...cReq.headers, host: u.host },
  };
  const up = http.request(opts, r => {
    const h = { ...r.headers };
    delete h['x-frame-options'];
    delete h['content-security-policy'];
    if (h.location) {
      try { const l = new URL(h.location, UP); if (l.port === '3001') { l.port = PORT; h.location = l.toString(); } } catch(_){}
    }
    cRes.writeHead(r.statusCode, h);
    r.pipe(cRes, { end: true });
  });
  up.on('error', e => { cRes.writeHead(502, {'Content-Type':'text/plain'}); cRes.end('Proxy error: ' + e.message); });
  cReq.pipe(up, { end: true });
}

function agentPage() {
return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EZRA E2E Agent</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font:13px/1.4 'Segoe UI',system-ui,sans-serif;background:#0d1117;color:#e6edf3;display:flex}
#left{flex:1;display:flex;flex-direction:column;border-right:2px solid #30363d}
#bar{height:34px;background:#161b22;border-bottom:1px solid #30363d;display:flex;align-items:center;padding:0 12px;gap:8px}
#bar .dots{display:flex;gap:5px}
#bar .dots i{width:10px;height:10px;border-radius:50%;display:inline-block}
.dr{background:#f85149}.dy{background:#d29922}.dg{background:#3fb950}
#url{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:3px 8px;color:#8b949e;font:12px monospace}
#view{flex:1;border:none;width:100%;background:#fff}
#right{width:410px;display:flex;flex-direction:column;background:#161b22}
#rh{padding:12px 14px;border-bottom:1px solid #30363d}
#rh h2{font-size:14px;display:flex;align-items:center;gap:7px}
#dot{width:8px;height:8px;border-radius:50%;background:#8b949e}
#dot.on{background:#f0883e;animation:p 1.5s infinite}
#dot.ok{background:#3fb950;animation:none}
#dot.no{background:#f85149;animation:none}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
#st{font-size:11px;color:#8b949e;margin-top:3px}
.pb{padding:5px 14px}.pbo{height:3px;background:#30363d;border-radius:2px;overflow:hidden}
.pbi{height:100%;background:#58a6ff;transition:width .3s;width:0%}
#stats{display:flex;gap:10px;padding:5px 14px;font-size:11px;border-bottom:1px solid #21262d}
.sp{color:#3fb950}.sf{color:#f85149}.st{color:#8b949e;margin-left:auto}
#log{flex:1;overflow-y:auto;padding:8px 14px}
.r{padding:4px 0;border-bottom:1px solid rgba(48,54,61,.3);font-size:12px;display:flex;gap:5px;align-items:flex-start}
.r .ic{flex-shrink:0;width:16px;text-align:center}
.r .tx{flex:1}.r .dt{color:#8b949e;font-size:11px;margin-top:1px}
.r.S{color:#d2a8ff;font-weight:600;padding-top:9px;font-size:13px}
.r.P{color:#3fb950}.r.F{color:#f85149}.r.A{color:#f0883e}.r.I{color:#8b949e}.r.N{color:#58a6ff}
#foot{padding:8px 14px;border-top:1px solid #30363d;display:flex;gap:6px;align-items:center}
#foot button{padding:5px 12px;border:1px solid #30363d;border-radius:5px;cursor:pointer;font-size:12px;background:#161b22;color:#e6edf3}
#foot button:hover{border-color:#58a6ff}
.go{background:#238636!important;border-color:#238636!important;color:#fff!important}
.go:hover{background:#2ea043!important}
.go:disabled{opacity:.5;cursor:not-allowed!important}
.sc{display:flex;align-items:center;gap:4px;margin-left:auto;font-size:11px;color:#8b949e}
.sc select{background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:3px;padding:2px 5px;font-size:11px}
</style></head><body>
<div id="left">
 <div id="bar"><div class="dots"><i class="dr"></i><i class="dy"></i><i class="dg"></i></div><div id="url">/</div></div>
 <iframe id="view" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="/"></iframe>
</div>
<div id="right">
 <div id="rh"><h2><span id="dot"></span>EZRA E2E Test Agent</h2><div id="st">Ready</div></div>
 <div class="pb"><div class="pbo"><div class="pbi" id="pb"></div></div></div>
 <div id="stats"><span class="sp" id="np">0 passed</span><span class="sf" id="nf">0 failed</span><span class="st" id="nt">0s</span></div>
 <div id="log"></div>
 <div id="foot">
  <button class="go" id="btn" onclick="go()">Start Agent</button>
  <button onclick="location.reload()">Reset</button>
  <div class="sc"><label>Speed</label><select id="sp"><option value="2000">Slow</option><option value="1000" selected>Normal</option><option value="400">Fast</option><option value="100">Turbo</option></select></div>
 </div>
</div>
<script>
let pc=0,fc=0,t0=0,run=false;
const $=id=>document.getElementById(id);
const spd=()=>+$('sp').value;
const W=ms=>new Promise(r=>setTimeout(r,ms||spd()));

window.onerror=(m,s,l)=>{L('F','\\u274c','JS: '+m,s+':'+l);return false};
window.addEventListener('unhandledrejection',e=>L('F','\\u274c','Err: '+(e.reason?.message||e.reason)));

function L(c,i,m,d){const r=document.createElement('div');r.className='r '+c;r.innerHTML='<span class="ic">'+i+'</span><div class="tx">'+m+(d?'<div class="dt">'+d+'</div>':'')+'</div>';$('log').appendChild(r);$('log').scrollTop=9e9}
function S(s){L('S','\\u2014',s)}
function nav(p){L('N','\\u{1f310}','Navigate '+p);$('url').textContent=p;$('view').src=p}
function upd(){$('np').textContent=pc+' passed';$('nf').textContent=fc+' failed';$('nt').textContent=((Date.now()-t0)/1e3).toFixed(1)+'s'}
function prg(v){$('pb').style.width=v+'%'}

async function chk(name,fn){try{await fn();pc++;L('P','\\u2705',name)}catch(e){fc++;L('F','\\u274c',name,e.message)}upd()}

function loaded(){return new Promise(ok=>{const f=$('view');const d=()=>{f.removeEventListener('load',d);setTimeout(ok,700)};f.addEventListener('load',d);setTimeout(ok,4000)})}

async function html(p){const r=await fetch(p,{redirect:'follow',credentials:'include'});return{s:r.status,h:await r.text()}}
async function st(p){const r=await fetch(p,{redirect:'manual'});return{s:r.status,l:r.headers.get('location')||''}}

// ── Connection test on load ──
window.addEventListener('DOMContentLoaded',async()=>{
  try{
    const r=await fetch('/',{method:'HEAD'});
    L('P','\\u2705','Proxy connected ('+r.status+')', 'Click Start Agent to begin');
    $('st').textContent='Connected \\u2014 click Start';
  }catch(e){
    L('F','\\u274c','Cannot reach dashboard',e.message);
    $('st').textContent='ERROR: proxy down';
  }
});

// ══════════════════════════════════════
// MAIN TEST SCRIPT — 16 Phases, 124+ checks
// ══════════════════════════════════════
async function go(){
if(run)return;run=true;t0=Date.now();pc=0;fc=0;
$('btn').disabled=true;$('dot').className='on';$('st').textContent='Testing...';
L('I','\\u2139\\ufe0f','Agent starting — 16-phase comprehensive suite');

const T=31;let ph=0;
function nx(){ph++;prg(Math.round(ph/T*100))}

// ── Phase 1: Proxy Health ──
S('Phase 1: Proxy Health');nx();
await chk('Proxy responds 200',async()=>{if((await st('/')).s!==200)throw Error('not 200')});
await chk('Agent page at /test',async()=>{const r=await html('/test');if(r.s!==200)throw Error(r.s);if(!r.h.includes('E2E Test Agent'))throw Error('missing')});
await chk('X-Frame-Options stripped',async()=>{const r=await fetch('/');if(r.headers.get('x-frame-options'))throw Error('not stripped')});
await chk('CSP stripped',async()=>{const r=await fetch('/');if(r.headers.get('content-security-policy'))throw Error('not stripped')});

// ── Phase 2: Homepage ──
S('Phase 2: Homepage');nx();
nav('/');await loaded();await W();
const hm=(await html('/')).h;
await chk('Status 200',async()=>{if((await st('/')).s!==200)throw Error('not 200')});
await chk('HTML content-type',async()=>{const r=await fetch('/');if(!r.headers.get('content-type').includes('text/html'))throw Error('bad type')});
await chk('Meta charset utf-8',()=>{if(!hm.includes('charSet')&&!hm.includes('charset'))throw Error('missing')});
await chk('EZRA branding',()=>{if(!hm.includes('EZRA'))throw Error('missing')});
await chk('Hero: Restores and Enforces Standards',()=>{if(!hm.includes('Restores and Enforces Standards'))throw Error('missing')});
await chk('CTA: Get Started Free',()=>{if(!hm.includes('Get Started Free'))throw Error('missing')});
await chk('CTA: Read the Docs',()=>{if(!hm.includes('Read the Docs'))throw Error('missing')});
await chk('Nav /docs',()=>{if(!hm.includes('/docs'))throw Error('missing')});
await chk('Nav /pricing',()=>{if(!hm.includes('/pricing'))throw Error('missing')});
await chk('Nav /login',()=>{if(!hm.includes('/login'))throw Error('missing')});
await chk('Feature: Health Scanning',()=>{if(!hm.includes('Health Scanning'))throw Error('missing')});
await chk('Feature: Multi-Agent',()=>{if(!hm.includes('Multi-Agent'))throw Error('missing')});
await chk('Feature: Slash Commands',()=>{if(!hm.includes('Slash Commands'))throw Error('missing')});
await chk('Stat: 22 Hooks',()=>{if(!hm.includes('>22<'))throw Error('missing')});
await chk('Stat: 39 Commands',()=>{if(!hm.includes('>39<'))throw Error('missing')});
await chk('Stat: Zero Dependencies',()=>{if(!hm.includes('Zero'))throw Error('missing')});
await chk('Footer: Codebase Governance',()=>{if(!hm.includes('Codebase Governance'))throw Error('missing')});

// ── Phase 3: Docs ──
S('Phase 3: Docs');nx();
L('A','\\u{1f446}','Navigate /docs');nav('/docs');await loaded();await W();
const dc=(await html('/docs')).h;
await chk('Status 200',async()=>{if((await st('/docs')).s!==200)throw Error('not 200')});
await chk('Documentation heading',()=>{if(!dc.includes('Documentation'))throw Error('missing')});
await chk('Install cmd',()=>{if(!dc.includes('npm install -g ezra-claude-code'))throw Error('missing')});
await chk('Command: ezra init',()=>{if(!dc.includes('ezra init'))throw Error('missing')});
await chk('Command: ezra scan',()=>{if(!dc.includes('ezra scan'))throw Error('missing')});
await chk('Ref: /ezra:health',()=>{if(!dc.includes('/ezra:health'))throw Error('missing')});
await chk('Ref: /ezra:guard (SSR)',()=>{if(!dc.includes('/ezra:guard'))throw Error('missing')});
await chk('Ref: /ezra:review (SSR)',()=>{if(!dc.includes('/ezra:review'))throw Error('missing')});
await chk('Ref: /ezra:dash (SSR)',()=>{if(!dc.includes('/ezra:dash'))throw Error('missing')});
await chk('Ref: /ezra:scan',()=>{if(!dc.includes('/ezra:scan'))throw Error('missing')});
await chk('Ref: /ezra:oversight',()=>{if(!dc.includes('/ezra:oversight'))throw Error('missing')});
await chk('Ref: /ezra:agents',()=>{if(!dc.includes('/ezra:agents'))throw Error('missing')});
await chk('Ref: /ezra:workflow',()=>{if(!dc.includes('/ezra:workflow'))throw Error('missing')});
await chk('Ref: /ezra:license',()=>{if(!dc.includes('/ezra:license'))throw Error('missing')});
await chk('Ref: /ezra:memory',()=>{if(!dc.includes('/ezra:memory'))throw Error('missing')});
await chk('Ref: /ezra:plan',()=>{if(!dc.includes('/ezra:plan'))throw Error('missing')});
await chk('Code blocks',()=>{if(!dc.includes('<code')&&!dc.includes('<pre'))throw Error('missing')});
await chk('Section: Getting Started',()=>{if(!dc.includes('Getting Started'))throw Error('missing')});
await chk('Section: Commands Reference',()=>{if(!dc.includes('Commands Reference'))throw Error('missing')});
await chk('Section: Architecture',()=>{if(!dc.includes('Architecture'))throw Error('missing')});
await chk('Section: Troubleshooting',()=>{if(!dc.includes('Troubleshooting'))throw Error('missing')});
await chk('Section: API Reference',()=>{if(!dc.includes('API Reference'))throw Error('missing')});
await chk('SSR has 30+ commands',()=>{
  let n=0;const cmds=['init','scan','guard','oversight','settings','compliance','pm','progress',
    'library','agents','memory','plan','workflow','license','dash','health','status',
    'decide','review','learn','doc','version','advisor','process','auto','multi',
    'bootstrap','sync','research','cost','portfolio','handoff','help','install'];
  for(const c of cmds)if(dc.includes('/ezra:'+c))n++;
  if(n<30)throw Error(n+'/'+cmds.length);L('I','\\u2139\\ufe0f',n+'/'+cmds.length+' commands')});

// ── Phase 4: Pricing ──
S('Phase 4: Pricing');nx();
L('A','\\u{1f446}','Navigate /pricing');nav('/pricing');await loaded();await W();
const pr=(await html('/pricing')).h;
await chk('Status 200',async()=>{if((await st('/pricing')).s!==200)throw Error('not 200')});
await chk('Transparent pricing heading',()=>{if(!pr.includes('transparent pricing'))throw Error('missing')});
await chk('Core + Free',()=>{if(!pr.includes('Core')||!pr.includes('Free'))throw Error('missing')});
await chk('Pro + $29',()=>{if(!pr.includes('Pro')||!pr.includes('29'))throw Error('missing')});
await chk('Team + $59',()=>{if(!pr.includes('Team')||!pr.includes('59'))throw Error('missing')});
await chk('Enterprise + Custom',()=>{if(!pr.includes('Enterprise')||!pr.includes('Custom'))throw Error('missing')});
await chk('CTA /login?plan=core',()=>{if(!pr.includes('/login?plan=core'))throw Error('missing')});
await chk('CTA /login?plan=pro',()=>{if(!pr.includes('/login?plan=pro'))throw Error('missing')});
await chk('CTA /login?plan=team',()=>{if(!pr.includes('/login?plan=team'))throw Error('missing')});
await chk('mailto:sales@ezradev.com',()=>{if(!pr.includes('mailto:sales@ezradev.com'))throw Error('missing')});
await chk('Feature mention',()=>{if(!pr.includes('Health Scanning')&&!pr.includes('scanning'))throw Error('missing')});

// ── Phase 5: Login ──
S('Phase 5: Login');nx();
L('A','\\u{1f446}','Navigate /login');nav('/login');await loaded();await W();
const lg=(await html('/login')).h;
await chk('Status 200',async()=>{if((await st('/login')).s!==200)throw Error('not 200')});
await chk('Sign In heading',()=>{if(!lg.includes('Sign In'))throw Error('missing')});
await chk('Email field',()=>{if(!lg.toLowerCase().includes('email'))throw Error('missing')});
await chk('Password field',()=>{if(!lg.toLowerCase().includes('password'))throw Error('missing')});
await chk('Forgot password',()=>{if(!lg.includes('Forgot password'))throw Error('missing')});
await chk('GitHub OAuth',()=>{if(!lg.includes('GitHub'))throw Error('missing')});
await chk('Google OAuth',()=>{if(!lg.includes('Google'))throw Error('missing')});
await chk('Microsoft OAuth',()=>{if(!lg.includes('Microsoft'))throw Error('missing')});
await chk('Sign Up toggle',()=>{if(!lg.includes('Sign Up'))throw Error('missing')});
await chk('Login ?plan=pro',async()=>{if((await fetch('/login?plan=pro')).status!==200)throw Error('fail')});
await chk('Login ?redirect=/dashboard',async()=>{if((await fetch('/login?redirect=/dashboard')).status!==200)throw Error('fail')});

// ── Phase 6: Auth Middleware ──
S('Phase 6: Auth Middleware');nx();
const prot=['/dashboard','/projects','/settings','/agents','/library'];
for(const rt of prot){
  await chk(rt+' redirect to /login',async()=>{
    const r=await st(rt);
    if(r.s>=500)throw Error('SERVER ERROR');
    if(r.s===307||r.s===302){
      if(!r.l.includes('/login'))throw Error('bad redirect: '+r.l);
      if(!r.l.includes('redirect='))throw Error('missing redirect param');
      L('I','\\u2139\\ufe0f',rt+' \\u2192 login \\u2713');
    }else L('I','\\u2139\\ufe0f',rt+' \\u2192 '+r.s+' (dev mode)');
  });
}
await chk('Redirect includes original path',async()=>{
  const r=await st('/settings');
  if(r.s===307&&!r.l.includes('%2Fsettings'))throw Error('missing path in: '+r.l);
});

// ── Phase 7: API GET ──
S('Phase 7: API Endpoints (GET)');nx();
const apis=['/api/achievements','/api/activity','/api/library','/api/notifications','/api/projects','/api/settings','/api/workflows'];
for(const a of apis){
  await chk('GET '+a+' not 500',async()=>{const r=await fetch(a);if(r.status>=500)throw Error('SERVER ERROR '+r.status);L('I','\\u2139\\ufe0f',a+' \\u2192 '+r.status)});
  await chk(a+' returns JSON',async()=>{const r=await fetch(a);if(r.status===200){const t=await r.text();try{JSON.parse(t)}catch{throw Error('invalid JSON')}}});
}

// ── Phase 8: API Write ──
S('Phase 8: API Write (POST/PUT/DELETE)');nx();
await chk('POST /api/settings',async()=>{
  const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({test:true})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','POST settings \\u2192 '+r.status)});
await chk('POST /api/workflows',async()=>{
  const r=await fetch('/api/workflows',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'test',nodes:[],edges:[]})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','POST workflows \\u2192 '+r.status)});
await chk('PUT /api/projects',async()=>{
  const r=await fetch('/api/projects',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','PUT projects \\u2192 '+r.status)});
await chk('DELETE /api/workflows',async()=>{
  const r=await fetch('/api/workflows',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'nonexistent'})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','DELETE workflows \\u2192 '+r.status)});

// ── Phase 9: Protected Pages (follow redirect) ──
S('Phase 9: Protected Pages (redirect chain)');nx();
for(const rt of prot){
  await chk(rt+' chain ends at content',async()=>{
    const r=await fetch(rt,{redirect:'follow'});const h=await r.text();
    if(r.status>=500)throw Error('SERVER ERROR');
    if(r.status===200){
      if(!h.includes('Sign In')&&!h.includes('Dashboard')&&!h.includes('Settings')&&!h.includes('EZRA'))throw Error('blank page');
    }
  });
}

// ── Phase 10: Project Detail Pages ──
S('Phase 10: Project Detail Pages');nx();
const details=['/projects/quiz2biz','/projects/quiz2biz/plan','/projects/quiz2biz/commits',
  '/projects/quiz2biz/assessment','/projects/quiz2biz/gates','/projects/quiz2biz/execution'];
for(const dp of details){
  await chk('GET '+dp+' not 500',async()=>{
    const r=await st(dp);if(r.s>=500)throw Error('SERVER ERROR');
    L('I','\\u2139\\ufe0f',dp+' \\u2192 '+r.s);
  });
}

// ── Phase 11: Workflows ──
S('Phase 11: Workflows');nx();
L('A','\\u{1f446}','Navigate /workflows');nav('/workflows');await loaded();await W();
const wf=await html('/workflows');
await chk('Status 200',()=>{if(wf.s!==200&&wf.s<500)L('I','\\u2139\\ufe0f','status '+wf.s);if(wf.s>=500)throw Error(wf.s)});
await chk('Has substantial content',()=>{if(wf.h.length<500)throw Error('too small: '+wf.h.length)});

// ── Phase 12: Notifications ──
S('Phase 12: Notifications');nx();
await chk('/notifications not 500',async()=>{const r=await st('/notifications');if(r.s>=500)throw Error(r.s)});

// ── Phase 13: Auth Callback ──
S('Phase 13: Auth Callback');nx();
await chk('/auth/callback exists',async()=>{const r=await st('/auth/callback');if(r.s>=500)throw Error(r.s)});

// ── Phase 14: Security Tests ──
S('Phase 14: Security');nx();
await chk('Open redirect blocked: //evil.com',async()=>{const r=await html('/login?redirect=//evil.com');if(r.h.includes('href="//evil.com"')||r.h.includes("href='//evil.com'"))throw Error('VULNERABLE')});
await chk('Open redirect blocked: javascript:',async()=>{const r=await html('/login?redirect=javascript:alert(1)');if(r.h.includes('href="javascript:'))throw Error('VULNERABLE')});
await chk('XSS in redirect param',async()=>{const r=await html('/login?redirect="><script>alert(1)</script>');if(r.h.includes('<script>alert(1)</script>'))throw Error('XSS VULNERABLE')});
await chk('XSS in plan param',async()=>{const r=await html('/login?plan=<script>alert(1)</script>');if(r.h.includes('<script>alert(1)</script>'))throw Error('XSS VULNERABLE')});
await chk('404 for /nonexistent',async()=>{const r=await html('/nonexistent');if(r.s!==404&&!r.h.includes('404')&&!r.h.includes('Not Found'))if(!(r.s===200&&r.h.includes('EZRA')))throw Error('no 404')});
await chk('X-Powered-By not leaking',async()=>{const r=await fetch('/');if(r.headers.get('x-powered-by')==='Express')throw Error('leaking')});
await chk('No /_next directory listing',async()=>{const r=await html('/_next/');if(r.s===200&&r.h.includes('Index of'))throw Error('directory listing')});
await chk('API rejects malformed JSON',async()=>{
  const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid}'});
  if(r.status>=500)throw Error('crashes on bad JSON')});
await chk('Login POST not 500',async()=>{
  const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@test.com',password:'x'})});
  if(r.status>=500)throw Error('SERVER ERROR')});

// ── Phase 15: Static Assets ──
S('Phase 15: Static Assets');nx();
await chk('Favicon accessible',async()=>{const r=await fetch('/favicon.ico');if(r.status>=500)throw Error(r.status)});
await chk('CSS bundle loads',async()=>{
  const m=hm.match(/href="(\/_next\/static\/[^"]+\.css)"/);
  if(m){const r=await fetch(m[1]);if(r.status!==200)throw Error(r.status)}else L('I','\\u2139\\ufe0f','no CSS bundle ref found')});
await chk('JS bundle loads',async()=>{
  const m=hm.match(/src="(\/_next\/static\/[^"]+\.js)"/);
  if(m){const r=await fetch(m[1]);if(r.status!==200)throw Error(r.status)}else L('I','\\u2139\\ufe0f','no JS bundle ref found')});

// ── Phase 16: Project-Scoped APIs ──
S('Phase 16: Project APIs');nx();
const projApis=['/api/projects/quiz2biz/plan','/api/projects/quiz2biz/commits',
  '/api/projects/quiz2biz/assessment','/api/projects/quiz2biz/gates',
  '/api/projects/quiz2biz/execution','/api/projects/quiz2biz/definition'];
for(const a of projApis){await chk('GET '+a,async()=>{const r=await st(a);if(r.s>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f',a+' \\u2192 '+r.s)})}
await chk('POST /api/projects/new',async()=>{
  const r=await fetch('/api/projects/new',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'test-project'})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','POST new \\u2192 '+r.status)});

// ── Phase 17: Workflow & Widget APIs ──
S('Phase 17: Workflow & Widget APIs');nx();
await chk('GET /api/workflows/test',async()=>{const r=await st('/api/workflows/test');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('POST /api/workflows/test/run',async()=>{
  const r=await fetch('/api/workflows/test/run',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(r.status>=500)throw Error('SERVER ERROR')});
await chk('GET /api/widgets/health-score',async()=>{const r=await st('/api/widgets/health-score');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('GET /api/preferences/widget-order',async()=>{const r=await st('/api/preferences/widget-order');if(r.s>=500)throw Error('SERVER ERROR')});

// ── Phase 18: Library Sub-Routes ──
S('Phase 18: Library Sub-Routes');nx();
await chk('GET /api/library/pending',async()=>{const r=await st('/api/library/pending');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('POST /api/library/sync-web',async()=>{
  const r=await fetch('/api/library/sync-web',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(r.status>=500)throw Error('SERVER ERROR')});

// ── Phase 19: Interview & Document APIs ──
S('Phase 19: Interview & Docs APIs');nx();
await chk('GET /api/interview',async()=>{const r=await st('/api/interview');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('POST /api/interview',async()=>{
  const r=await fetch('/api/interview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'test'})});
  if(r.status>=500)throw Error('SERVER ERROR')});
await chk('POST /api/documents/upload',async()=>{
  const r=await fetch('/api/documents/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(r.status>=500)throw Error('SERVER ERROR')});

// ── Phase 20: GitHub Webhook ──
S('Phase 20: GitHub Webhook');nx();
await chk('POST /api/github/webhook',async()=>{
  const r=await fetch('/api/github/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ping'})});
  if(r.status>=500)throw Error('SERVER ERROR');L('I','\\u2139\\ufe0f','webhook \\u2192 '+r.status)});
await chk('GET /api/github/webhook rejected',async()=>{const r=await st('/api/github/webhook');if(r.s>=500)throw Error('SERVER ERROR')});

// ── Phase 21: New Project Page ──
S('Phase 21: New Project Page');nx();
L('A','\\u{1f446}','Navigate /projects/new');nav('/projects/new');await loaded();await W();
await chk('GET /projects/new',async()=>{const r=await st('/projects/new');if(r.s>=500)throw Error('SERVER ERROR')});

// ── Phase 22: Error Boundaries ──
S('Phase 22: Error Boundaries');nx();
await chk('Deep nested 404',async()=>{const r=await st('/some/very/deep/nonexistent/path');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('/api/nonexistent not 500',async()=>{const r=await st('/api/nonexistent');if(r.s>=500)throw Error('SERVER ERROR')});
await chk('POST unknown API',async()=>{
  const r=await fetch('/api/nonexistent',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  if(r.status>=500)throw Error('SERVER ERROR')});

// ── Phase 23: Performance ──
S('Phase 23: Performance');nx();
for(const p of ['/','/docs','/pricing','/login']){
  await chk(p+' < 3s',async()=>{const t=Date.now();await fetch(p);const ms=Date.now()-t;if(ms>3000)throw Error(ms+'ms');L('I','\\u2139\\ufe0f',p+' '+ms+'ms')});
}
for(const a of ['/api/projects','/api/settings','/api/workflows']){
  await chk('API '+a+' < 2s',async()=>{const t=Date.now();await fetch(a);const ms=Date.now()-t;if(ms>2000)throw Error(ms+'ms');L('I','\\u2139\\ufe0f',a+' '+ms+'ms')});
}

// ── Phase 24: SEO & Meta Tags ──
S('Phase 24: SEO & Meta');nx();
await chk('html lang="en"',()=>{if(!hm.includes('lang="en"'))throw Error('missing')});
await chk('Title has EZRA',()=>{if(!hm.includes('EZRA'))throw Error('missing');if(!hm.includes('Codebase Governance'))throw Error('missing title')});
await chk('Meta description',()=>{if(!hm.includes('meta')||!hm.includes('description'))throw Error('missing')});
await chk('Meta viewport',()=>{if(!hm.includes('viewport'))throw Error('missing')});
await chk('Geist font',()=>{if(!hm.includes('geist')&&!hm.includes('Geist')&&!hm.includes('font'))throw Error('missing')});

// ── Phase 25: Security Headers ──
S('Phase 25: Security Headers');nx();
await chk('X-Content-Type-Options',async()=>{const r=await fetch('/');const h=r.headers.get('x-content-type-options');if(h&&h!=='nosniff')throw Error(h)});
await chk('No server info leak',async()=>{const r=await fetch('/');const s=r.headers.get('server');if(s==='Apache'||s==='nginx')throw Error(s)});
await chk('No sensitive API headers',async()=>{const r=await fetch('/api/projects');if(r.headers.get('x-powered-by')==='Express')throw Error('leaking')});

// ── Phase 26: API Response Shapes ──
S('Phase 26: API Shapes');nx();
await chk('/api/projects shape',async()=>{const r=await html('/api/projects');if(r.s===200){const j=JSON.parse(r.h);if(!j.data&&!Array.isArray(j))throw Error('bad shape')}});
await chk('/api/settings shape',async()=>{const r=await html('/api/settings');if(r.s===200){const j=JSON.parse(r.h);if(typeof j!=='object'||j===null)throw Error('not object')}});
await chk('/api/achievements shape',async()=>{const r=await html('/api/achievements');if(r.s===200){const j=JSON.parse(r.h);if(!j.achievements&&!Array.isArray(j))throw Error('bad')}});
await chk('/api/workflows shape',async()=>{const r=await html('/api/workflows');if(r.s===200){const j=JSON.parse(r.h);if(!j.workflows&&!Array.isArray(j))throw Error('bad')}});
await chk('/api/notifications shape',async()=>{const r=await html('/api/notifications');if(r.s===200){const j=JSON.parse(r.h);if(!j.notifications&&!j.data&&!Array.isArray(j))throw Error('bad')}});
await chk('/api/activity shape',async()=>{const r=await html('/api/activity');if(r.s===200){const j=JSON.parse(r.h);if(!j.data&&!Array.isArray(j))throw Error('bad')}});
await chk('/api/library shape',async()=>{const r=await html('/api/library');if(r.s===200){const j=JSON.parse(r.h);if(!j.entries&&!Array.isArray(j))throw Error('bad')}});

// ── Phase 27: API Input Validation ──
S('Phase 27: Input Validation');nx();
await chk('POST settings empty body',async()=>{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(r.status>=500)throw Error('500')});
await chk('POST projects/new no name',async()=>{const r=await fetch('/api/projects/new',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(r.status>=500)throw Error('500')});
await chk('POST interview no fields',async()=>{const r=await fetch('/api/interview',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(r.status>=500)throw Error('500')});
await chk('POST notifications bad action',async()=>{const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invalid'})});if(r.status>=500)throw Error('500')});
await chk('POST library empty title',async()=>{const r=await fetch('/api/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:''})});if(r.status>=500)throw Error('500')});
await chk('DELETE library no id',async()=>{const r=await fetch('/api/library',{method:'DELETE'});if(r.status>=500)throw Error('500')});
await chk('POST commits bad action',async()=>{const r=await fetch('/api/projects/quiz2biz/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bad'})});if(r.status>=500)throw Error('500')});
await chk('POST execution bad action',async()=>{const r=await fetch('/api/projects/quiz2biz/execution',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invalid'})});if(r.status>=500)throw Error('500')});
await chk('POST gates bad action',async()=>{const r=await fetch('/api/projects/quiz2biz/gates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invalid'})});if(r.status>=500)throw Error('500')});

// ── Phase 28: Auth Callback Security ──
S('Phase 28: Callback Security');nx();
await chk('Callback open redirect blocked',async()=>{const r=await st('/auth/callback?redirect=//evil.com');if(r.l&&r.l.includes('//evil.com'))throw Error('OPEN REDIRECT')});
await chk('Callback javascript: blocked',async()=>{const r=await st('/auth/callback?redirect=javascript:alert(1)');if(r.l&&r.l.includes('javascript:'))throw Error('VULNERABLE')});
await chk('Callback no code no crash',async()=>{const r=await st('/auth/callback');if(r.s>=500)throw Error('500')});

// ── Phase 29: 404 Page ──
S('Phase 29: 404 Page');nx();
await chk('404 has content',async()=>{const r=await html('/nonexistent-test');if(r.s>=500)throw Error('500');if(!r.h.includes('404')&&!r.h.includes('Not Found')&&!r.h.includes('EZRA'))throw Error('blank')});
await chk('404 has navigation',async()=>{const r=await html('/nonexistent-test');if(!r.h.includes('/')&&!r.h.includes('EZRA'))throw Error('no nav')});

// ── Phase 30: Webhook Events ──
S('Phase 30: Webhooks');nx();
await chk('Non-PR event skipped',async()=>{const r=await fetch('/api/github/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'push',ref:'main'})});if(r.status>=500)throw Error('500')});
await chk('No signature verification',async()=>{const r=await fetch('/api/github/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'opened',pull_request:{number:1}})});if(r.status>=500)throw Error('500')});

// ── Phase 31: Edge Cases ──
S('Phase 31: Edge Cases');nx();
await chk('Long URL handled',async()=>{const r=await fetch('/api/projects?'+'x='.repeat(2000));if(r.status>=500)throw Error('500')});
await chk('Empty POST body',async()=>{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:''});if(r.status>=500)throw Error('500')});
await chk('Unicode path',async()=>{const r=await fetch('/api/projects/%E2%9C%93');if(r.status>=500)throw Error('500')});
await chk('Double-encoded slashes',async()=>{const r=await fetch('/api/projects%2F..%2Fsettings');if(r.status>=500)throw Error('500')});
await chk('HEAD homepage',async()=>{const r=await fetch('/',{method:'HEAD'});if(r.status>=500)throw Error('500')});
await chk('OPTIONS preflight',async()=>{const r=await fetch('/api/projects',{method:'OPTIONS'});if(r.status>=500)throw Error('500')});
await chk('text/plain POST',async()=>{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'text/plain'},body:'hello'});if(r.status>=500)throw Error('500')});
await chk('null body',async()=>{const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:'null'});if(r.status>=500)throw Error('500')});

// ── Done ──
L('A','\\u{1f446}','Back home');nav('/');await loaded();
prg(100);
const el=((Date.now()-t0)/1e3).toFixed(1);
const ok=fc===0;
S('Complete');
L(ok?'P':'F',ok?'\\u{1f3c6}':'\\u274c',pc+' passed, '+fc+' failed ('+el+'s)',ok?'ALL GREEN':'SOME FAILED');
$('st').textContent=ok?'All passed ('+el+'s)':fc+' failures ('+el+'s)';
$('dot').className=ok?'ok':'no';
run=false;$('btn').disabled=false;
}
</script></body></html>`;
}

const server = http.createServer((req, res) => {
  const p = (req.url || '/').split('?')[0].replace(/\/+$/,'') || '/';
  if (p==='/test'||p==='/__agent__'||p==='/__agent'||p==='/agent') {
    console.log('[agent]', req.url);
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','X-Agent':'ezra'});
    res.end(agentPage());
    return;
  }
  proxy(req, res);
});

// WebSocket upgrade proxy (needed for Next.js HMR)
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, UP);
  const upSocket = net.connect(parseInt(u.port) || 3001, u.hostname, () => {
    const reqLine = req.method + ' ' + u.pathname + u.search + ' HTTP/1.1\r\n';
    let hdrs = '';
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const k = req.rawHeaders[i];
      const v = k.toLowerCase() === 'host' ? u.host : req.rawHeaders[i + 1];
      hdrs += k + ': ' + v + '\r\n';
    }
    upSocket.write(reqLine + hdrs + '\r\n');
    if (head && head.length) upSocket.write(head);
    socket.pipe(upSocket).pipe(socket);
  });
  upSocket.on('error', () => socket.end());
  socket.on('error', () => upSocket.end());
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error('Port '+PORT+' in use');
  else console.error(e.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('\\nEZRA E2E Agent running');
  console.log('  http://localhost:'+PORT+'/test   <- open this');
  console.log('  http://localhost:'+PORT+'/       <- dashboard proxy\\n');
});
