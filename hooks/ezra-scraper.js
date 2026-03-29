#!/usr/bin/env node
'use strict';
/**
 * hooks/ezra-scraper.js — Best Practice Web Scraper for EZRA v7
 * Whitelist-only: only fetches from approved domains.
 * ZERO external dependencies — uses built-in http/https.
 */

const https = require('https');
const http = require('http');

const ALLOWED_DOMAINS = [
  'owasp.org',
  'developer.mozilla.org',
  'react.dev',
  'nodejs.org',
  'www.typescriptlang.org',
  'eslint.org',
  'vitest.dev',
  'nextjs.org',
  'docs.expo.dev',
  'fastapi.tiangolo.com',
  'nvd.nist.gov',
  'github.com/advisories'
];

function getDomain(url) {
  try {
    const parsed = new URL(url);
    // For github.com/advisories, match path prefix too
    if (parsed.hostname === 'github.com') {
      return parsed.hostname + parsed.pathname.replace(/\/$/, '');
    }
    return parsed.hostname;
  } catch (_) {
    return null;
  }
}

function isAllowed(url) {
  const domain = getDomain(url);
  if (!domain) return false;
  return ALLOWED_DOMAINS.some(allowed => {
    if (allowed.includes('/')) return domain.startsWith(allowed) || domain === allowed;
    return domain === allowed || domain.endsWith('.' + allowed);
  });
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    if (!isAllowed(url)) {
      return reject(new Error(`Domain not in allowlist: ${url}`));
    }
    let parsed;
    try { parsed = new URL(url); } catch (e) { return reject(e); }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on('error', reject);
  });
}

function extractTextContent(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scrapeUrl(url) {
  if (!isAllowed(url)) {
    return Promise.reject(new Error(`Domain not in allowlist: ${url}`));
  }
  let parsed;
  try { parsed = new URL(url); } catch (e) { return Promise.reject(e); }
  const domain = parsed.hostname;
  return fetchUrl(url).then(html => {
    const content = extractTextContent(html);
    const word_count = content.split(/\s+/).filter(Boolean).length;
    return { url, domain, content, fetched_at: new Date().toISOString(), word_count };
  });
}

function diffAgainstLibrary(newEntries, existingEntries) {
  const key = e => `${e.title || ''}|${e.category || ''}`;
  const existingMap = new Map((existingEntries || []).map(e => [key(e), e]));
  const added = [];
  const updated = [];
  let unchanged_count = 0;
  for (const entry of (newEntries || [])) {
    const k = key(entry);
    if (!existingMap.has(k)) {
      added.push(entry);
    } else {
      const existing = existingMap.get(k);
      if (JSON.stringify(existing) !== JSON.stringify(entry)) {
        updated.push(entry);
      } else {
        unchanged_count++;
      }
    }
  }
  return { new: added, updated, unchanged_count };
}

function getDefaultSources(techFilter) {
  const sources = [
    { url: 'https://owasp.org/www-project-top-ten/', category: 'security', tech: 'general' },
    { url: 'https://react.dev/reference/react/hooks', category: 'patterns', tech: 'react' },
    { url: 'https://nodejs.org/en/docs/guides/security', category: 'security', tech: 'nodejs' },
    { url: 'https://www.typescriptlang.org/docs/handbook/intro.html', category: 'typing', tech: 'typescript' }
  ];
  if (techFilter && techFilter.length > 0) {
    return sources.filter(s => techFilter.includes(s.tech) || s.tech === 'general');
  }
  return sources;
}

function scrapeForTech(techFilter) {
  const sources = getDefaultSources(techFilter);
  const promises = sources.map(source =>
    scrapeUrl(source.url)
      .then(result => Object.assign({}, result, { category: source.category }))
      .catch(err => ({ url: source.url, category: source.category, error: err.message, fetched_at: new Date().toISOString(), word_count: 0 }))
  );
  return Promise.all(promises);
}

// stdin/stdout hook protocol
if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    let data = {};
    try { data = JSON.parse(raw || '{}'); } catch (_) { data = {}; }
    const action = data.action || 'scrape';
    let work;
    if (action === 'diff') {
      work = Promise.resolve(diffAgainstLibrary(data.new_entries || [], data.existing_entries || []));
    } else {
      work = scrapeForTech(data.tech_filter || null);
    }
    work.then(result => {
      process.stdout.write(JSON.stringify({ ok: true, action, result }) + '\n');
      process.exit(0);
    }).catch(err => {
      process.stdout.write(JSON.stringify({ ok: false, action, error: err.message }) + '\n');
      process.exit(0);
    });
  });
}

module.exports = { scrapeUrl, fetchUrl, extractTextContent, diffAgainstLibrary, getDefaultSources, scrapeForTech, ALLOWED_DOMAINS };
