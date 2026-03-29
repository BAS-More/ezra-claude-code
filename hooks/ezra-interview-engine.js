#!/usr/bin/env node
'use strict';
// EZRA Interview Engine -- gap detection state machine for /ezra:interview
// 12 question domains, incremental save, readline for CLI mode.
// Zero external dependencies.

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

let _def;
try { _def = require('./ezra-project-definition'); } catch (_e) { _def = null; }
let _yaml;
try { _yaml = require('./ezra-yaml-utils'); } catch (_e) { _yaml = null; }

const MAX_STDIN = 1024 * 1024;

// ─── Question domains ────────────────────────────────────────────────────────────────────────────

const DOMAINS = [
  {
    id: 'project_name',
    question: 'What is the name of this project?',
    type: 'text',
    required: true,
  },
  {
    id: 'description',
    question: 'Describe what this project does in 2-3 sentences.',
    type: 'text',
    required: true,
  },
  {
    id: 'tech_stack',
    question: 'What is your primary tech stack? (e.g. TypeScript/Next.js/PostgreSQL)',
    type: 'text',
    required: true,
  },
  {
    id: 'features',
    question: 'List your top 5 core features (one per line, press Enter twice when done):',
    type: 'multiline',
    required: true,
  },
  {
    id: 'auth_strategy',
    question: 'How will users authenticate? (e.g. JWT, OAuth/SSO, email+password, magic link, none)',
    type: 'choice',
    choices: ['JWT', 'OAuth/SSO', 'email+password', 'magic link', 'supabase auth', 'none', 'other'],
    required: false,
  },
  {
    id: 'database_choice',
    question: 'Which database(s) will you use?',
    type: 'text',
    required: false,
  },
  {
    id: 'deployment_target',
    question: 'Where will this deploy? (e.g. Vercel, Railway, AWS, self-hosted)',
    type: 'choice',
    choices: ['Vercel', 'Railway', 'Render', 'AWS', 'GCP', 'Azure', 'Fly.io', 'self-hosted', 'unknown'],
    required: false,
  },
  {
    id: 'testing_requirements',
    question: 'What testing approach do you need? (unit/integration/e2e/all)',
    type: 'choice',
    choices: ['unit only', 'unit + integration', 'unit + integration + e2e', 'none for now'],
    required: false,
  },
  {
    id: 'security_level',
    question: 'Security sensitivity level?',
    type: 'choice',
    choices: ['standard', 'elevated (handles PII)', 'high (financial/medical)', 'critical (compliance required)'],
    required: false,
  },
  {
    id: 'performance_targets',
    question: 'Any specific performance targets? (e.g. <200ms API response, 10k concurrent users)',
    type: 'text',
    required: false,
  },
  {
    id: 'team_size',
    question: 'Team size (including yourself)?',
    type: 'choice',
    choices: ['1 (solo)', '2-3', '4-8', '9-20', '20+'],
    required: false,
  },
  {
    id: 'timeline',
    question: 'Target timeline / delivery date?',
    type: 'text',
    required: false,
  },
];

// ─── Gap detection ─────────────────────────────────────────────────────────────────────────────────

function detectGaps(existing) {
  const answered = new Set(Object.keys(existing || {}).filter(k => {
    const v = existing[k];
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }));
  return DOMAINS.filter(d => !answered.has(d.id));
}

// ─── CLI interview ────────────────────────────────────────────────────────────────────────────────

async function runInterviewCLI(projectDir, existingDef) {
  const def = Object.assign({}, existingDef || {});
  const gaps = detectGaps(def);

  if (gaps.length === 0) {
    console.log('EZRA: Project definition is complete. No gaps detected.');
    return def;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log('\nEZRA Gap Interview (' + gaps.length + ' questions)\n');

  for (const domain of gaps) {
    let answer = '';
    if (domain.type === 'choice' && domain.choices) {
      console.log('\n' + domain.question);
      domain.choices.forEach((c, i) => console.log('  ' + (i + 1) + '. ' + c));
      const raw = await ask('Enter number or type answer: ');
      const idx = parseInt(raw, 10) - 1;
      answer = (idx >= 0 && idx < domain.choices.length) ? domain.choices[idx] : raw.trim();
    } else if (domain.type === 'multiline') {
      console.log('\n' + domain.question);
      const lines = [];
      let line;
      while ((line = await ask('  > ')) !== '') {
        lines.push(line.trim());
        if (lines.length >= 10) break;
      }
      answer = lines;
    } else {
      answer = await ask('\n' + domain.question + '\n> ');
      answer = answer.trim();
    }

    if (answer && (typeof answer !== 'string' || answer.length > 0)) {
      def[domain.id] = answer;
      // Incremental save
      if (_def && projectDir) {
        try { _def.save(projectDir, def); } catch (_e) { /* non-blocking */ }
      }
    }
  }

  rl.close();
  return def;
}

// ─── SSE/API interview helper ────────────────────────────────────────────────────────────────────────────────

function getNextQuestion(existingDef) {
  const gaps = detectGaps(existingDef);
  if (gaps.length === 0) return null;
  return { domain: gaps[0], remaining: gaps.length };
}

function applyAnswer(existingDef, domainId, answer) {
  const def = Object.assign({}, existingDef || {});
  def[domainId] = answer;
  return def;
}

function getProgress(existingDef) {
  const answered = DOMAINS.filter(d => {
    const v = (existingDef || {})[d.id];
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  return { answered: answered.length, total: DOMAINS.length, pct: Math.round(answered.length / DOMAINS.length * 100) };
}

module.exports = { DOMAINS, detectGaps, runInterviewCLI, getNextQuestion, applyAnswer, getProgress };

if (require.main === module) {
  // Hook protocol: reads project dir from event, returns gap count
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; if (input.length > MAX_STDIN) process.exit(0); });
  process.stdin.on('end', async () => {
    try {
      const ev = JSON.parse(input);
      const cwd = ev.cwd || process.cwd();
      const existing = _def ? _def.load(cwd) : null;
      const gaps = detectGaps(existing);
      process.stdout.write(JSON.stringify({ gaps: gaps.map(d => d.id), count: gaps.length }));
    } catch (_e) { process.stdout.write('{}'); }
    process.exit(0);
  });
}
