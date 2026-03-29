'use strict';

const fs = require('fs');
const path = require('path');

const EVENTS_DIR = '.ezra/events';
const QUEUE_FILE = 'queue.yaml';
const MAX_QUEUE = 500;

// Known event types
const EVENT_TYPES = [
  'decision_needed',
  'phase_complete',
  'gate_failed',
  'gate_passed',
  'test_failed',
  'deployment_complete',
  'audit_ready',
  'commit_created',
  'achievement_earned',
  'run_started',
  'run_paused',
  'run_aborted',
  'run_completed',
];

// In-memory handlers (registered per process)
const _handlers = {};

/**
 * Register a handler for an event type.
 * handler(payload, event) is called synchronously when emit() is called.
 */
function on(eventType, handler) {
  if (!_handlers[eventType]) _handlers[eventType] = [];
  _handlers[eventType].push(handler);
}

/**
 * Emit an event. Calls in-memory handlers, then persists to queue.yaml.
 */
function emit(projectDir, eventType, payload) {
  const event = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: eventType,
    payload: payload || {},
    emitted_at: new Date().toISOString(),
    processed: false,
  };

  // Call in-memory handlers
  const handlers = _handlers[eventType] || [];
  for (const h of handlers) {
    try { h(event.payload, event); } catch { /* silent */ }
  }
  // Also call wildcard handlers
  const wildcards = _handlers['*'] || [];
  for (const h of wildcards) {
    try { h(event.payload, event); } catch { /* silent */ }
  }

  // Persist to queue
  persistEvent(projectDir, event);
  return event;
}

/**
 * Persist event to .ezra/events/queue.yaml
 */
function persistEvent(projectDir, event) {
  try {
    const eventsDir = path.join(projectDir, EVENTS_DIR);
    if (!fs.existsSync(eventsDir)) fs.mkdirSync(eventsDir, { recursive: true });
    const queuePath = path.join(eventsDir, QUEUE_FILE);

    const queue = loadQueue(projectDir);
    queue.push(event);

    // Trim to MAX_QUEUE (keep most recent)
    const trimmed = queue.length > MAX_QUEUE ? queue.slice(queue.length - MAX_QUEUE) : queue;

    const yaml = trimmed.map(e => [
      `- id: '${e.id}'`,
      `  type: ${e.type}`,
      `  emitted_at: '${e.emitted_at}'`,
      `  processed: ${e.processed}`,
      `  payload: ${JSON.stringify(e.payload)}`,
    ].join('\n')).join('\n') + '\n';

    fs.writeFileSync(queuePath, yaml, 'utf8');
  } catch { /* silent */ }
}

/**
 * Load queue from .ezra/events/queue.yaml
 */
function loadQueue(projectDir) {
  try {
    const queuePath = path.join(projectDir, EVENTS_DIR, QUEUE_FILE);
    if (!fs.existsSync(queuePath)) return [];
    const text = fs.readFileSync(queuePath, 'utf8');
    // Simple parse: extract JSON payload lines
    const events = [];
    const blocks = text.split(/^- id:/m).filter(Boolean);
    for (const block of blocks) {
      try {
        const idMatch = block.match(/^['"]([\w]+)['"]/);
        const typeMatch = block.match(/\n  type:\s+(\S+)/);
        const timeMatch = block.match(/\n  emitted_at:\s+'([^']+)'/);
        const processedMatch = block.match(/\n  processed:\s+(true|false)/);
        const payloadMatch = block.match(/\n  payload:\s+(\{.*\}|\[.*\])/);
        if (idMatch && typeMatch) {
          events.push({
            id: idMatch[1],
            type: typeMatch[1],
            emitted_at: timeMatch ? timeMatch[1] : '',
            processed: processedMatch ? processedMatch[1] === 'true' : false,
            payload: payloadMatch ? JSON.parse(payloadMatch[1]) : {},
          });
        }
      } catch { /* skip malformed */ }
    }
    return events;
  } catch { return []; }
}

/**
 * Mark events as processed by ID.
 */
function markProcessed(projectDir, eventIds) {
  try {
    const queue = loadQueue(projectDir);
    const idSet = new Set(eventIds);
    const updated = queue.map(e => idSet.has(e.id) ? { ...e, processed: true } : e);
    const yaml = updated.map(e => [
      `- id: '${e.id}'`,
      `  type: ${e.type}`,
      `  emitted_at: '${e.emitted_at}'`,
      `  processed: ${e.processed}`,
      `  payload: ${JSON.stringify(e.payload)}`,
    ].join('\n')).join('\n') + '\n';
    const queuePath = path.join(projectDir, EVENTS_DIR, QUEUE_FILE);
    fs.writeFileSync(queuePath, yaml, 'utf8');
  } catch { /* silent */ }
}

/**
 * Get unprocessed events, optionally filtered by type.
 */
function getUnprocessed(projectDir, eventType) {
  const queue = loadQueue(projectDir);
  const unprocessed = queue.filter(e => !e.processed);
  return eventType ? unprocessed.filter(e => e.type === eventType) : unprocessed;
}

/**
 * Clear all events from the queue.
 */
function clearQueue(projectDir) {
  try {
    const queuePath = path.join(projectDir, EVENTS_DIR, QUEUE_FILE);
    if (fs.existsSync(queuePath)) fs.writeFileSync(queuePath, '', 'utf8');
  } catch { /* silent */ }
}

module.exports = {
  EVENT_TYPES,
  on,
  emit,
  loadQueue,
  persistEvent,
  markProcessed,
  getUnprocessed,
  clearQueue,
};

// Hook protocol
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(input);
      const cwd = event.cwd || process.cwd();
      const type = event.type || 'unknown';
      const payload = event.payload || {};
      const result = emit(cwd, type, payload);
      process.stdout.write(JSON.stringify({ emitted: true, event: result }));
    } catch (e) {
      process.stderr.write('ezra-event-bus: ' + e.message + '\n');
      process.stdout.write(JSON.stringify({ emitted: false, error: e.message }));
    }
    process.exit(0);
  });
}
