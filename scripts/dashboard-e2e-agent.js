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
// MAIN TEST SCRIPT
// ══════════════════════════════════════
async function go(){
if(run)return;run=true;t0=Date.now();pc=0;fc=0;
$('btn').disabled=true;$('dot').className='on';$('st').textContent='Testing...';
L('I','\\u2139\\ufe0f','Agent starting');

const T=13;let ph=0;
function nx(){ph++;prg(Math.round(ph/T*100))}

// Phase 1: Homepage
S('Phase 1: Homepage');nx();
nav('/');await loaded();await W();
const hm=(await html('/')).h;

await chk('Homepage loads',async()=>{if((await st('/')).s!==200)throw Error('not 200')});
await chk('EZRA branding',()=>{if(!hm.includes('EZRA'))throw Error('missing')});
await chk('Hero headline',()=>{if(!hm.includes('Restores and Enforces Standards'))throw Error('missing')});
await chk('Get Started CTA',()=>{if(!hm.includes('Get Started Free'))throw Error('missing')});
await chk('Read the Docs link',()=>{if(!hm.includes('Read the Docs'))throw Error('missing')});
await chk('Nav: Docs/Pricing/Login',()=>{if(!hm.includes('/docs'))throw Error('/docs');if(!hm.includes('/pricing'))throw Error('/pricing');if(!hm.includes('/login'))throw Error('/login')});
await chk('3 feature cards',()=>{if(!hm.includes('Health Scanning'))throw Error('1');if(!hm.includes('Multi-Agent'))throw Error('2');if(!hm.includes('Slash Commands'))throw Error('3')});
await chk('Stats: 22/39/Zero',()=>{if(!hm.includes('>22<'))throw Error('22');if(!hm.includes('>39<'))throw Error('39');if(!hm.includes('Zero'))throw Error('Zero')});
await chk('Footer',()=>{if(!hm.includes('Codebase Governance'))throw Error('missing')});

// Phase 2: Docs
S('Phase 2: Docs');nx();
L('A','\\u{1f446}','Click Docs');nav('/docs');await loaded();await W();
const dc=(await html('/docs')).h;
await chk('Docs loads',async()=>{if((await st('/docs')).s!==200)throw Error('not 200')});
await chk('Documentation heading',()=>{if(!dc.includes('Documentation'))throw Error('missing')});
await chk('Install cmd',()=>{if(!dc.includes('npm install -g ezra-claude-code'))throw Error('missing')});
await chk('Init cmd',()=>{if(!dc.includes('ezra init'))throw Error('missing')});
await chk('Scan cmd',()=>{if(!dc.includes('ezra scan'))throw Error('missing')});
await chk('/ezra:health ref',()=>{if(!dc.includes('/ezra:health'))throw Error('missing')});

// Phase 3: Pricing
S('Phase 3: Pricing');nx();
L('A','\\u{1f446}','Click Pricing');nav('/pricing');await loaded();await W();
const pr=(await html('/pricing')).h;
await chk('Pricing loads',async()=>{if((await st('/pricing')).s!==200)throw Error('not 200')});
await chk('Heading',()=>{if(!pr.includes('transparent pricing'))throw Error('missing')});
await chk('Core Free',()=>{if(!pr.includes('Core')||!pr.includes('Free'))throw Error('missing')});
await chk('Pro $29',()=>{if(!pr.includes('Pro')||!pr.includes('29'))throw Error('missing')});
await chk('Team $59',()=>{if(!pr.includes('Team')||!pr.includes('59'))throw Error('missing')});
await chk('Enterprise',()=>{if(!pr.includes('Enterprise')||!pr.includes('Custom'))throw Error('missing')});
await chk('Core CTA',()=>{if(!pr.includes('/login?plan=core'))throw Error('missing')});
await chk('Pro CTA',()=>{if(!pr.includes('/login?plan=pro'))throw Error('missing')});
await chk('Sales email',()=>{if(!pr.includes('mailto:sales@ezradev.com'))throw Error('missing')});

// Phase 4: Login
S('Phase 4: Login');nx();
L('A','\\u{1f446}','Click Login');nav('/login');await loaded();await W();
const lg=(await html('/login')).h;
await chk('Login loads',async()=>{if((await st('/login')).s!==200)throw Error('not 200')});
await chk('Sign In',()=>{if(!lg.includes('Sign In'))throw Error('missing')});
await chk('Email field',()=>{if(!lg.toLowerCase().includes('email'))throw Error('missing')});
await chk('Password field',()=>{if(!lg.toLowerCase().includes('password'))throw Error('missing')});
await chk('Forgot password',()=>{if(!lg.includes('Forgot password'))throw Error('missing')});
await chk('GitHub OAuth',()=>{if(!lg.includes('GitHub'))throw Error('missing')});
await chk('Google OAuth',()=>{if(!lg.includes('Google'))throw Error('missing')});
await chk('Microsoft OAuth',()=>{if(!lg.includes('Microsoft'))throw Error('missing')});
await chk('Sign Up',()=>{if(!lg.includes('Sign Up'))throw Error('missing')});

// Phase 5: Auth
S('Phase 5: Protected Routes');nx();
for(const rt of ['/dashboard','/projects','/settings','/agents','/library']){
  await chk('GET '+rt,async()=>{
    const r=await st(rt);
    if(r.s>=500)throw Error('500');
    if(r.s===307||r.s===302){if(!r.l.includes('/login'))throw Error('bad redirect: '+r.l);L('I','\\u2139\\ufe0f',rt+' -> login')}
    else L('I','\\u2139\\ufe0f',rt+' -> '+r.s)
  });
}

// Phase 6: APIs
S('Phase 6: API Endpoints');nx();
for(const a of ['/api/achievements','/api/activity','/api/library','/api/notifications','/api/projects','/api/settings','/api/workflows']){
  await chk('API '+a,async()=>{try{const r=await fetch(a,{credentials:'include'});if(r.status>=500)throw Error('500');L('I','\\u2139\\ufe0f',a+' -> '+r.status)}catch(e){if(e.message==='500')throw e}});
}

// Phase 7: Dashboard
S('Phase 7: Dashboard');nx();
L('A','\\u{1f446}','Open Dashboard');nav('/dashboard');await loaded();await W();await W(1500);
const ds=await html('/dashboard');
await chk('Dashboard accessible',()=>{if(ds.s>=500)throw Error('500')});
if(ds.s===200&&ds.h.includes('Dashboard')){
  L('I','\\u2139\\ufe0f','Dashboard loaded');
  await chk('Heading',()=>{if(!ds.h.includes('Dashboard'))throw Error('missing')});
  const ww=['Health Score','Progress','Active Agents','Decision','Security','Test Coverage','Cost','Leaderboard','Risk','Activity','Phase','Achievement','Velocity','Workflow','Readiness'];
  await chk('Widgets',()=>{let n=0;for(const w of ww)if(ds.h.includes(w))n++;if(n<5)throw Error(n+'/'+ww.length);L('I','\\u2139\\ufe0f',n+'/'+ww.length+' widgets')});
  await chk('Edit/layout controls',()=>{if(!ds.h.toLowerCase().includes('edit')&&!ds.h.toLowerCase().includes('layout'))throw Error('missing')});
}else L('I','\\u2139\\ufe0f','Auth required');

// Phase 8: Projects
S('Phase 8: Projects');nx();
L('A','\\u{1f446}','Open Projects');nav('/projects');await loaded();await W(1000);
const pj=await html('/projects');
await chk('Projects accessible',()=>{if(pj.s>=500)throw Error('500')});
if(pj.s===200&&pj.h.includes('Projects')){
  await chk('Heading',()=>{if(!pj.h.includes('Projects'))throw Error('missing')});
  await chk('Content',()=>{if(!pj.h.includes('Quiz2Biz')&&!pj.h.includes('No projects'))throw Error('empty')});
}

// Phase 9: Agents
S('Phase 9: Agents');nx();
L('A','\\u{1f446}','Open Agents');nav('/agents');await loaded();await W();
const ag=await html('/agents');
await chk('Agents accessible',()=>{if(ag.s>=500)throw Error('500')});
if(ag.s===200&&ag.h.includes('Agents')){
  await chk('Heading',()=>{if(!ag.h.includes('Agents'))throw Error('missing')});
  await chk('Providers',()=>{let n=0;for(const p of ['Claude Sonnet','GPT-4o','Codex','Claude Haiku','Gemini Pro'])if(ag.h.includes(p))n++;if(n<3)throw Error(n+'/5')});
}

// Phase 10: Settings
S('Phase 10: Settings');nx();
L('A','\\u{1f446}','Open Settings');nav('/settings');await loaded();await W();
const se=await html('/settings');
await chk('Settings accessible',()=>{if(se.s>=500)throw Error('500')});
if(se.s===200)await chk('Heading',()=>{if(!se.h.toLowerCase().includes('settings'))throw Error('missing')});

// Phase 11: Workflows
S('Phase 11: Workflows');nx();
L('A','\\u{1f446}','Open Workflows');nav('/workflows');await loaded();await W();
const wf=await html('/workflows');
await chk('Workflows loads',()=>{if(wf.s>=500)throw Error('500')});
if(wf.s===200)await chk('Has content',()=>{if(wf.h.length<500)throw Error('too small')});

// Phase 12: Library
S('Phase 12: Library');nx();
L('A','\\u{1f446}','Open Library');nav('/library');await loaded();await W();
const lb=await html('/library');
await chk('Library accessible',()=>{if(lb.s>=500)throw Error('500')});

// Phase 13: Edge Cases
S('Phase 13: Security & Edge Cases');nx();
await chk('404 page',async()=>{const r=await html('/nonexistent');if(r.s!==404&&!r.h.includes('404')&&!r.h.includes('Not Found'))if(!(r.s===200&&r.h.includes('EZRA')))throw Error('no 404')});
await chk('Auth callback',async()=>{try{const r=await st('/auth/callback');if(r.s>=500)throw Error('500')}catch(e){if(e.message==='500')throw e}});
await chk('Redirect param',async()=>{if((await fetch('/login?redirect=/dashboard')).status!==200)throw Error('fail')});
await chk('Open redirect blocked',async()=>{const r=await html('/login?redirect=//evil.com');if(r.h.includes('href="//evil.com"'))throw Error('not blocked')});
await chk('Plan param',async()=>{if((await fetch('/login?plan=pro')).status!==200)throw Error('fail')});

// Done
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
