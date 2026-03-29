#!/usr/bin/env node
'use strict';
// EZRA Document Ingester -- extracts tech signals, features, constraints from project docs.
// Zero external dependencies. Can be required as module or invoked as stdin hook.

const fs = require('fs');
const path = require('path');
const MAX_STDIN = 1024 * 1024;

let _log;
try { _log = require('./ezra-hook-logger').logHookEvent; } catch (_e) { _log = () => {}; }

const TECH_PATTERNS = {
  languages: [
    { re: /\bTypeScript\b/i, name: 'TypeScript' }, { re: /\bJavaScript\b/i, name: 'JavaScript' },
    { re: /\bPython\b/i, name: 'Python' }, { re: /\bGolang\b/i, name: 'Go' },
    { re: /\bRust\b/i, name: 'Rust' }, { re: /\bSwift\b/i, name: 'Swift' },
    { re: /\bKotlin\b/i, name: 'Kotlin' }, { re: /\bC#\b/i, name: 'C#' },
  ],
  frameworks: [
    { re: /\bNext\.js\b/i, name: 'Next.js' }, { re: /\bReact Native\b|\bExpo\b/i, name: 'React Native' },
    { re: /\bReact\b/i, name: 'React' }, { re: /\bVue\b/i, name: 'Vue.js' },
    { re: /\bFastAPI\b/i, name: 'FastAPI' }, { re: /\bDjango\b/i, name: 'Django' },
    { re: /\bExpress\b/i, name: 'Express' }, { re: /\bNestJS\b/i, name: 'NestJS' },
    { re: /\bAngular\b/i, name: 'Angular' }, { re: /\bFlask\b/i, name: 'Flask' },
  ],
  databases: [
    { re: /\bPostgreSQL\b|\bSupabase\b/i, name: 'PostgreSQL' },
    { re: /\bMySQL\b/i, name: 'MySQL' }, { re: /\bMongoDB\b/i, name: 'MongoDB' },
    { re: /\bRedis\b/i, name: 'Redis' }, { re: /\bSQLite\b/i, name: 'SQLite' },
    { re: /\bPrisma\b/i, name: 'Prisma' }, { re: /\bDrizzle\b/i, name: 'Drizzle' },
    { re: /\bFirebase\b/i, name: 'Firebase' },
  ],
  cloud: [
    { re: /\bVercel\b/i, name: 'Vercel' }, { re: /\bRailway\b/i, name: 'Railway' },
    { re: /\bAWS\b/i, name: 'AWS' }, { re: /\bGCP\b/i, name: 'GCP' },
    { re: /\bAzure\b/i, name: 'Azure' }, { re: /\bDocker\b/i, name: 'Docker' },
    { re: /\bNetlify\b/i, name: 'Netlify' }, { re: /\bFly\.io\b/i, name: 'Fly.io' },
  ],
  testing: [
    { re: /\bJest\b/i, name: 'Jest' }, { re: /\bVitest\b/i, name: 'Vitest' },
    { re: /\bPytest\b/i, name: 'Pytest' }, { re: /\bCypress\b/i, name: 'Cypress' },
    { re: /\bPlaywright\b/i, name: 'Playwright' },
  ],
};

const CONSTRAINT_PATTERNS = [
  { re: /\b(\d+)\s*ms\b/i, type: 'performance', extract: (m) => m[1] + 'ms target' },
  { re: /\bGDPR\b|\bHIPAA\b|\bSOC\s*2\b|\bPCI\b/i, type: 'compliance', extract: (m) => m[0] },
  { re: /\bMVP\b/i, type: 'scope', extract: () => 'MVP scope' },
  { re: /\bmobile.?first\b/i, type: 'ux', extract: () => 'mobile-first' },
  { re: /\breal.?time\b/i, type: 'architecture', extract: () => 'real-time' },
  { re: /\bmulti.?tenant\b|\bSaaS\b/i, type: 'architecture', extract: () => 'multi-tenant SaaS' },
];

function extractSignals(text, filename) {
  function addUnique(arr, val) { if (val && !arr.includes(val)) arr.push(val); }
  const signals = {
    tech_stack: { languages: [], frameworks: [], databases: [], cloud: [], testing: [] },
    features: [], constraints: [], existing_decisions: [], phases: [],
    word_count: text.split(/\s+/).filter(Boolean).length,
    source_file: filename || 'unknown',
  };
  for (const [cat, pats] of Object.entries(TECH_PATTERNS)) {
    for (const { re, name } of pats) { if (re.test(text)) addUnique(signals.tech_stack[cat], name); }
  }
  for (const { re, type, extract } of CONSTRAINT_PATTERNS) {
    const m = text.match(re);
    if (m && !signals.constraints.find(c => c.type === type)) signals.constraints.push({ type, value: extract(m) });
  }
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (/^[-*]\s+\w/.test(t) && t.length > 20 && t.length < 200) {
      addUnique(signals.features, t.replace(/^[-*]\s+/, ''));
      if (signals.features.length >= 30) break;
    }
  }
  const phaseRe = /(?:phase|milestone|sprint)\s+(\d+|[a-z]+)[:\s-]+([^\n]{5,80})/gi;
  let pm;
  while ((pm = phaseRe.exec(text)) !== null && signals.phases.length < 10) {
    if (!signals.phases.find(x => x.id === pm[1])) signals.phases.push({ id: pm[1], description: pm[2].trim() });
  }
  return signals;
}

const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml', '.json', '.ts', '.js', '.py']);
const BINARY_EXTENSIONS    = new Set(['.pdf', '.docx', '.doc', '.pptx', '.xlsx']);

function ingestFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    const empty = { languages: [], frameworks: [], databases: [], cloud: [], testing: [] };
    return { signals: { tech_stack: empty, features: [], constraints: [], existing_decisions: [], phases: [],
      word_count: 0, source_file: path.basename(filePath), needs_manual_review: true,
      format: ext.slice(1).toUpperCase() }, error: null };
  }
  if (!SUPPORTED_EXTENSIONS.has(ext)) return { signals: null, error: 'Unsupported: ' + ext };
  try {
    const MAX_BYTES = 500 * 1024;
    const stat = fs.statSync(filePath);
    let text;
    if (stat.size > MAX_BYTES) {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(MAX_BYTES);
      fs.readSync(fd, buf, 0, MAX_BYTES, 0);
      fs.closeSync(fd);
      text = buf.toString('utf8');
    } else {
      text = fs.readFileSync(filePath, 'utf8');
    }
    return { signals: extractSignals(text, path.basename(filePath)), error: null };
  } catch (e) {
    return { signals: null, error: e.message };
  }
}

function ingestPaths(paths) {
  function addUnique(arr, val) { if (val && !arr.includes(val)) arr.push(val); }
  const merged = { tech_stack: { languages: [], frameworks: [], databases: [], cloud: [], testing: [] },
    features: [], constraints: [], existing_decisions: [], phases: [],
    files_processed: [], files_skipped: [], needs_manual_review: [], total_words: 0 };
  for (const p of paths) {
    if (!fs.existsSync(p)) { merged.files_skipped.push(p); continue; }
    const stat = fs.statSync(p);
    const files = stat.isDirectory()
      ? fs.readdirSync(p).map(f => path.join(p, f)).filter(f => fs.statSync(f).isFile())
      : [p];
    for (const fp of files) {
      const { signals, error } = ingestFile(fp);
      if (error || !signals) { merged.files_skipped.push(fp); continue; }
      merged.files_processed.push(path.basename(fp));
      merged.total_words += signals.word_count || 0;
      if (signals.needs_manual_review) { merged.needs_manual_review.push(path.basename(fp)); continue; }
      for (const cat of Object.keys(merged.tech_stack)) {
        for (const item of (signals.tech_stack[cat] || [])) addUnique(merged.tech_stack[cat], item);
      }
      for (const f of (signals.features || [])) addUnique(merged.features, f);
      for (const c of (signals.constraints || [])) {
        if (!merged.constraints.find(x => x.type === c.type)) merged.constraints.push(c);
      }
      for (const ph of (signals.phases || [])) {
        if (!merged.phases.find(x => x.id === ph.id)) merged.phases.push(ph);
      }
    }
  }
  return merged;
}

module.exports = { extractSignals, ingestFile, ingestPaths, SUPPORTED_EXTENSIONS, BINARY_EXTENSIONS, TECH_PATTERNS };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; if (input.length > MAX_STDIN) process.exit(0); });
  process.stdin.on('end', () => {
    try {
      const ev = JSON.parse(input);
      process.stdout.write(JSON.stringify(ingestPaths(ev.files || [])));
    } catch (_e) { process.stdout.write('{}'); }
    process.exit(0);
  });
}
