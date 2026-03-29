'use strict';

const path = require('path');

let _http, _settings, _log;
try { _http = require('./ezra-http.js'); } catch { _http = null; }
try { _settings = require('./ezra-settings.js'); } catch { _settings = null; }
try { _log = require('./ezra-hook-logger.js').logHookEvent; } catch { _log = () => {}; }

// Notification types with default titles
const NOTIFICATION_TYPES = {
  decision_needed: 'Decision Required',
  phase_complete: 'Phase Complete',
  gate_failed: 'Gate Failed',
  gate_passed: 'Gate Passed',
  test_failed: 'Tests Failing',
  deployment_complete: 'Deployment Complete',
  audit_ready: 'Audit Ready',
  commit_created: 'Commit Created',
  achievement_earned: 'Achievement Unlocked',
  run_started: 'Execution Started',
  run_completed: 'Execution Complete',
};

const CHANNELS = ['email', 'slack', 'teams', 'dashboard'];

/**
 * Format a notification body for a given type and payload.
 */
function formatBody(type, payload) {
  const title = NOTIFICATION_TYPES[type] || type;
  const lines = [`**${title}**`];
  if (payload.project) lines.push(`Project: ${payload.project}`);
  if (payload.phase != null) lines.push(`Phase: ${payload.phase}`);
  if (payload.message) lines.push(payload.message);
  if (payload.details) lines.push(payload.details);
  return lines.join('\n');
}

/**
 * Send email via Resend API.
 * Returns { sent: true } or { sent: false, error }
 */
async function sendEmail(settings, type, payload, title) {
  const email = settings.notifications && settings.notifications.email;
  if (!email || !email.api_key || !email.to) {
    return { sent: false, error: 'Email not configured' };
  }
  if (!_http) return { sent: false, error: 'ezra-http not available' };

  const provider = email.provider || 'resend';
  const body = formatBody(type, payload);

  try {
    if (provider === 'resend') {
      const result = await _http.post('https://api.resend.com/emails', {
        from: email.from || 'EZRA <noreply@ezra.dev>',
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: title || NOTIFICATION_TYPES[type] || type,
        text: body,
      }, { 'Authorization': `Bearer ${email.api_key}`, 'Content-Type': 'application/json' });
      return { sent: true, provider: 'resend', result };
    }
    return { sent: false, error: `Unknown email provider: ${provider}` };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/**
 * Send Slack notification via incoming webhook.
 * Returns { sent: true } or { sent: false, error }
 */
async function sendSlack(settings, type, payload, title) {
  const slack = settings.notifications && settings.notifications.slack;
  if (!slack || !slack.webhook_url) return { sent: false, error: 'Slack not configured' };
  if (!_http) return { sent: false, error: 'ezra-http not available' };

  const text = `*${title || NOTIFICATION_TYPES[type] || type}*\n${formatBody(type, payload)}`;
  try {
    await _http.post(slack.webhook_url, { text }, { 'Content-Type': 'application/json' });
    return { sent: true, provider: 'slack' };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/**
 * Send Teams notification via Adaptive Card webhook.
 */
async function sendTeams(settings, type, payload, title) {
  const teams = settings.notifications && settings.notifications.teams;
  if (!teams || !teams.webhook_url) return { sent: false, error: 'Teams not configured' };
  if (!_http) return { sent: false, error: 'ezra-http not available' };

  const card = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: type.includes('fail') ? 'FF0000' : type.includes('complete') ? '00FF00' : '0076D7',
    summary: title || NOTIFICATION_TYPES[type] || type,
    sections: [{
      activityTitle: title || NOTIFICATION_TYPES[type] || type,
      activityText: formatBody(type, payload),
    }],
  };

  try {
    await _http.post(teams.webhook_url, card, { 'Content-Type': 'application/json' });
    return { sent: true, provider: 'teams' };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/**
 * Write notification to dashboard (Supabase insert via HTTP or local queue).
 * In production this calls the dashboard API. In EZRA CLI context, writes to
 * .ezra/events/dashboard-queue.yaml for the dashboard to pick up.
 */
function sendDashboard(projectDir, type, payload, title) {
  try {
    const fs = require('fs');
    const eventsDir = require('path').join(projectDir, '.ezra', 'events');
    if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
    const queuePath = require('path').join(eventsDir, 'dashboard-queue.yaml');
    const entry = {
      type,
      title: title || NOTIFICATION_TYPES[type] || type,
      payload,
      created_at: new Date().toISOString(),
      read: false,
    };
    const existing = fs.existsSync(queuePath) ? fs.readFileSync(queuePath, 'utf8') : '';
    const line = `- ${JSON.stringify(entry)}\n`;
    fs.appendFileSync(queuePath, line, 'utf8');
    return { sent: true, provider: 'dashboard' };
  } catch (e) {
    return { sent: false, error: e.message };
  }
}

/**
 * Main dispatcher. Sends to all configured channels.
 * Returns { channels: { email: result, slack: result, ... } }
 */
async function notify(projectDir, type, payload, options = {}) {
  const settings = _settings ? _settings.loadSettings(projectDir) : {};
  const notifSettings = settings.notifications || {};
  const onEvents = notifSettings.on_events || Object.keys(NOTIFICATION_TYPES);
  const title = options.title || NOTIFICATION_TYPES[type] || type;

  // Check if this event type should trigger notifications
  if (!onEvents.includes(type) && !onEvents.includes('*')) {
    return { skipped: true, reason: `Event type '${type}' not in on_events list` };
  }

  const results = {};

  // Dashboard is always on
  results.dashboard = sendDashboard(projectDir, type, payload, title);

  // Email
  if (notifSettings.email && notifSettings.email.api_key) {
    results.email = await sendEmail(settings, type, payload, title);
  }

  // Slack
  if (notifSettings.slack && notifSettings.slack.webhook_url) {
    results.slack = await sendSlack(settings, type, payload, title);
  }

  // Teams
  if (notifSettings.teams && notifSettings.teams.webhook_url) {
    results.teams = await sendTeams(settings, type, payload, title);
  }

  const sent = Object.values(results).filter(r => r.sent).length;
  _log(projectDir, 'ezra-notifier', 'info', `Sent ${type} to ${sent} channel(s)`);

  return { sent: sent > 0, channels: results, type, title };
}

module.exports = {
  NOTIFICATION_TYPES,
  CHANNELS,
  notify,
  sendEmail,
  sendSlack,
  sendTeams,
  sendDashboard,
  formatBody,
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
        const type = event.notification_type || event.type;
        const payload = event.payload || {};
        if (!type) { process.stdout.write(JSON.stringify({ error: 'notification_type required' })); process.exit(0); return; }
        const result = await notify(cwd, type, payload);
        process.stdout.write(JSON.stringify(result));
      } catch (e) {
        process.stderr.write('ezra-notifier: ' + e.message + '\n');
        process.stdout.write(JSON.stringify({ sent: false, error: e.message }));
      }
      process.exit(0);
    })();
  });
}
