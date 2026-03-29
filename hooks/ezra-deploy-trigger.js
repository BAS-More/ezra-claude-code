'use strict';

let _http, _settings, _log;
try { _http = require('./ezra-http.js'); } catch { _http = null; }
try { _settings = require('./ezra-settings.js'); } catch { _settings = null; }
try { _log = require('./ezra-hook-logger.js').logHookEvent; } catch { _log = () => {}; }

// Supported deploy targets
const DEPLOY_TARGETS = ['vercel', 'railway', 'netlify', 'custom'];

/**
 * Trigger a Vercel deploy via deploy hook URL.
 */
async function triggerVercel(hookUrl, options = {}) {
  if (!_http) return { success: false, error: 'ezra-http not available' };
  try {
    const result = await _http.post(hookUrl, {}, { 'Content-Type': 'application/json' });
    return { success: true, provider: 'vercel', job: result.job };
  } catch (e) {
    return { success: false, provider: 'vercel', error: e.message };
  }
}

/**
 * Trigger a Railway deploy via webhook URL.
 */
async function triggerRailway(hookUrl, options = {}) {
  if (!_http) return { success: false, error: 'ezra-http not available' };
  try {
    await _http.post(hookUrl, { ref: options.branch || 'main' }, { 'Content-Type': 'application/json' });
    return { success: true, provider: 'railway' };
  } catch (e) {
    return { success: false, provider: 'railway', error: e.message };
  }
}

/**
 * Trigger a custom webhook deploy.
 */
async function triggerCustom(hookUrl, payload, headers) {
  if (!_http) return { success: false, error: 'ezra-http not available' };
  try {
    await _http.post(hookUrl, payload || {}, headers || { 'Content-Type': 'application/json' });
    return { success: true, provider: 'custom', url: hookUrl };
  } catch (e) {
    return { success: false, provider: 'custom', error: e.message };
  }
}

/**
 * Main deploy dispatcher.
 * Reads deploy settings from project config and triggers the right provider.
 */
async function triggerDeploy(projectDir, options = {}) {
  const settings = _settings ? _settings.loadSettings(projectDir) : {};
  const deploy = settings.deploy || {};

  if (!deploy.hook_url) {
    return { success: false, skipped: true, reason: 'No deploy hook_url configured' };
  }

  if (!deploy.auto_deploy && !options.force) {
    return { success: false, skipped: true, reason: 'auto_deploy is disabled — pass force: true to override' };
  }

  // Check production approval requirement
  if (deploy.production_approval && !options.approved) {
    return {
      success: false,
      requires_approval: true,
      reason: 'Production deploy requires explicit approval',
    };
  }

  const target = deploy.target || 'custom';
  const branch = options.branch || 'main';

  let result;
  if (target === 'vercel') {
    result = await triggerVercel(deploy.hook_url, { branch });
  } else if (target === 'railway') {
    result = await triggerRailway(deploy.hook_url, { branch });
  } else {
    result = await triggerCustom(deploy.hook_url, { branch, ...options.payload });
  }

  if (result.success) {
    _log(projectDir, 'ezra-deploy-trigger', 'info', `Deploy triggered via ${target}`);
  } else {
    _log(projectDir, 'ezra-deploy-trigger', 'warn', `Deploy failed: ${result.error}`);
  }

  return result;
}

module.exports = {
  DEPLOY_TARGETS,
  triggerDeploy,
  triggerVercel,
  triggerRailway,
  triggerCustom,
};

// Hook protocol
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    (async () => {
      try {
        const event = JSON.parse(input);
        const cwd = event.cwd || process.cwd();
        const result = await triggerDeploy(cwd, event.options || {});
        process.stdout.write(JSON.stringify(result));
      } catch (e) {
        process.stderr.write('ezra-deploy-trigger: ' + e.message + '\n');
        process.stdout.write(JSON.stringify({ success: false, error: e.message }));
      }
      process.exit(0);
    })();
  });
}
