#!/usr/bin/env node
'use strict';

/**
 * hooks/ezra-quiz2build-client.js — Quiz2Build API client for EZRA v7
 * Zero external dependencies. Uses ezra-http.js for SSRF-protected requests.
 * Reads endpoint + credentials from .ezra/settings.yaml via ezra-settings.js.
 */

const fs   = require('fs');
const path = require('path');

let _http;
try { _http = require('./ezra-http'); } catch (_e) { _http = null; }
let _settings;
try { _settings = require('./ezra-settings'); } catch (_e) { _settings = null; }

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_ENDPOINT = 'http://localhost:3000';

const Q2B_DOCUMENT_TYPES = [
  'architecture_dossier',
  'sdlc_playbook',
  'test_strategy',
  'security_framework',
  'api_specification',
  'deployment_guide',
  'data_model',
  'risk_register',
];

const Q2B_DIMENSIONS = [
  'modern_architecture',
  'ai_assisted_development',
  'coding_standards',
  'testing_qa',
  'security_devsecops',
  'workflow_operations',
  'documentation',
];

const EZRA_DOMAIN_MAP = {
  modern_architecture:     ['tech_stack', 'deployment_target'],
  ai_assisted_development: ['ai_tooling'],
  coding_standards:        ['standards_level'],
  testing_qa:              ['testing_requirements'],
  security_devsecops:      ['security_level'],
  workflow_operations:     ['rollback_strategy'],
  documentation:           ['documentation_level'],
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function getEndpoint(projectDir) {
  if (_settings) {
    try {
      const s = _settings.loadSettings(projectDir);
      return (s && s.quiz2build && s.quiz2build.endpoint) || DEFAULT_ENDPOINT;
    } catch (_e) { /* fallthrough */ }
  }
  return DEFAULT_ENDPOINT;
}

function getApiKey(projectDir) {
  if (_settings) {
    try {
      const s = _settings.loadSettings(projectDir);
      return (s && s.quiz2build && s.quiz2build.api_key) || null;
    } catch (_e) { /* fallthrough */ }
  }
  return null;
}

function buildHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (apiKey) h['Authorization'] = 'Bearer ' + apiKey;
  return h;
}

function apiRequest(endpoint, urlPath, options) {
  if (!_http) {
    return { error: 'ezra-http not available', skipped: true };
  }
  // Warn if endpoint is plain HTTP and not localhost (will fail SSRF check in production)
  if (endpoint && endpoint.startsWith('http://') && !endpoint.includes('localhost') && !endpoint.includes('127.0.0.1')) {
    process.stderr.write('[Q2B] Warning: endpoint "' + endpoint + '" uses plain HTTP. Production endpoints must use HTTPS.\n');
  }
  const url = endpoint.replace(/\/$/, '') + urlPath;
  try {
    return _http.request(url, options);
  } catch (e) {
    return { error: e.message, skipped: true };
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function login(endpoint, email, password) {
  return apiRequest(endpoint, '/auth/login', {
    method: 'POST',
    headers: buildHeaders(null),
    body: JSON.stringify({ email, password }),
  });
}

function refreshToken(endpoint, refreshToken_) {
  return apiRequest(endpoint, '/auth/refresh', {
    method: 'POST',
    headers: buildHeaders(null),
    body: JSON.stringify({ refresh_token: refreshToken_ }),
  });
}

// ── Session / Score / Heatmap ─────────────────────────────────────────────────

function getSession(projectDir, sessionId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/scoring/' + sessionId, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
}

function importScore(projectDir, sessionId) {
  const result = getSession(projectDir, sessionId);
  if (result.error) return result;
  return { sessionId, score: result.score || result.readiness_score || null, raw: result };
}

function importHeatmap(projectDir, sessionId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  const result = apiRequest(endpoint, '/heatmap/' + sessionId, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
  if (result.error) return result;
  return { sessionId, heatmap: result, dimensions: Q2B_DIMENSIONS, ezra_domain_map: EZRA_DOMAIN_MAP };
}

// ── Facts ─────────────────────────────────────────────────────────────────────

function importFacts(projectDir, q2bProjectId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/facts/' + q2bProjectId, {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
}

function submitFacts(projectDir, q2bProjectId, facts) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  if (!Array.isArray(facts) || facts.length === 0) {
    return { error: 'facts must be a non-empty array', skipped: true };
  }
  return apiRequest(endpoint, '/questionnaires/dynamic/' + q2bProjectId, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ facts }),
  });
}

// ── Score ─────────────────────────────────────────────────────────────────────

function calculateScore(projectDir, sessionId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  const invalidate = apiRequest(endpoint, '/scoring/' + sessionId + '/invalidate', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({}),
  });
  if (invalidate.error) return invalidate;
  return apiRequest(endpoint, '/scoring/calculate', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ session_id: sessionId }),
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

function generateDocument(projectDir, q2bProjectId, docType) {
  if (!Q2B_DOCUMENT_TYPES.includes(docType)) {
    return { error: 'Unknown document type: ' + docType, valid_types: Q2B_DOCUMENT_TYPES };
  }
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/documents/project/' + q2bProjectId + '/generate', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ type: docType }),
  });
}

function downloadDocument(projectDir, docId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/documents/' + docId + '/download', {
    method: 'GET',
    headers: buildHeaders(apiKey),
  });
}

function importDocuments(projectDir, sessionId, docTypes) {
  const types = Array.isArray(docTypes) ? docTypes : Q2B_DOCUMENT_TYPES;
  const results = [];
  for (const t of types) {
    if (!Q2B_DOCUMENT_TYPES.includes(t)) { results.push({ type: t, error: 'unknown type' }); continue; }
    const endpoint = getEndpoint(projectDir);
    const apiKey = getApiKey(projectDir);
    const r = apiRequest(endpoint, '/documents/session/' + sessionId + '?type=' + t, {
      method: 'GET',
      headers: buildHeaders(apiKey),
    });
    results.push({ type: t, ...(r.error ? { error: r.error } : { data: r }) });
  }
  return { sessionId, documents: results };
}

// ── Next questions ────────────────────────────────────────────────────────────

function getNextQuestions(projectDir, q2bProjectId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/scoring/next-questions', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ project_id: q2bProjectId }),
  });
}

// ── Adapter ───────────────────────────────────────────────────────────────────

function registerGithubAdapter(projectDir, q2bAdapterId, repoUrl, token) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/adapters/webhooks/github', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ adapter_id: q2bAdapterId, repo_url: repoUrl, token }),
  });
}

function syncAdapter(projectDir, adapterId) {
  const endpoint = getEndpoint(projectDir);
  const apiKey = getApiKey(projectDir);
  return apiRequest(endpoint, '/adapters/configs/' + adapterId + '/sync', {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify({}),
  });
}

// ── Heatmap → EZRA risk register ──────────────────────────────────────────────

function heatmapToRiskRegister(heatmap) {
  const risks = [];
  const severityOrder = { red: 'CRITICAL', amber: 'HIGH', green: 'LOW' };

  for (const dim of Q2B_DIMENSIONS) {
    const cells = Array.isArray(heatmap[dim]) ? heatmap[dim] :
                  (heatmap.matrix && heatmap.matrix[dim]) ? heatmap.matrix[dim] : [];
    for (const cell of cells) {
      const colour = (cell.colour || cell.color || cell.level || 'green').toLowerCase();
      if (colour === 'green') continue;
      risks.push({
        id: 'Q2B-' + dim.toUpperCase().replace(/_/g, '-') + '-' + risks.length,
        source: 'quiz2build',
        dimension: dim,
        description: cell.gap || cell.description || ('Gap in ' + dim),
        severity: severityOrder[colour] || 'MEDIUM',
        recommendation: cell.recommendation || cell.action || '',
        domains: EZRA_DOMAIN_MAP[dim] || [],
      });
    }
  }
  return risks;
}

// ── Stdin hook mode ───────────────────────────────────────────────────────────

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => { raw += c; });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw); } catch (_e) { /* empty input */ }
    const projectDir = input.cwd || process.cwd();
    const action = (input.action || '').toLowerCase();

    let output = {};
    try {
      if (action === 'import_heatmap') output = importHeatmap(projectDir, input.session_id);
      else if (action === 'import_score') output = importScore(projectDir, input.session_id);
      else if (action === 'import_facts') output = importFacts(projectDir, input.project_id);
      else if (action === 'submit_facts') output = submitFacts(projectDir, input.project_id, input.facts);
      else if (action === 'calculate_score') output = calculateScore(projectDir, input.session_id);
      else if (action === 'generate_document') output = generateDocument(projectDir, input.project_id, input.doc_type);
      else if (action === 'import_documents') output = importDocuments(projectDir, input.session_id, input.doc_types);
      else if (action === 'heatmap_to_risks') output = { risks: heatmapToRiskRegister(input.heatmap || {}) };
      else output = { error: 'Unknown action', valid_actions: ['import_heatmap', 'import_score', 'import_facts', 'submit_facts', 'calculate_score', 'generate_document', 'import_documents', 'heatmap_to_risks'] };
    } catch (e) {
      output = { error: e.message };
    }

    process.stdout.write(JSON.stringify(output) + '\n');
    process.exit(0);
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  Q2B_DOCUMENT_TYPES,
  Q2B_DIMENSIONS,
  EZRA_DOMAIN_MAP,
  login,
  refreshToken,
  getSession,
  importScore,
  importHeatmap,
  importFacts,
  submitFacts,
  calculateScore,
  generateDocument,
  downloadDocument,
  importDocuments,
  getNextQuestions,
  registerGithubAdapter,
  syncAdapter,
  heatmapToRiskRegister,
};
