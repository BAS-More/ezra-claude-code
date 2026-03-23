#!/usr/bin/env node
'use strict';

/**
 * EZRA v6 Phase 3 — Settings Writer Test Suite
 *
 * Tests serializeYaml, setSetting, addRule, removeRule,
 * resetSection, resetAll, exportSettings, diffSettings, initSettings.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Test Harness ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error('  FAIL: ' + name);
    console.error('    ' + (e.message || e));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertEqual') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertIncludes(arr, item, msg) {
  if (!arr.includes(item)) {
    throw new Error((msg || 'assertIncludes') + ': ' + JSON.stringify(item) + ' not in array');
  }
}

// ─── Setup ───────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const writer = require(path.join(ROOT, 'hooks', 'ezra-settings-writer'));
const settings = require(path.join(ROOT, 'hooks', 'ezra-settings'));

const {
  serializeYaml,
  serializeScalar,
  setSetting,
  addRule,
  removeRule,
  resetSection,
  resetAll,
  exportSettings,
  diffSettings,
  initSettings,
} = writer;

const { loadSettings, getDefault, parseYamlSimple, DEFAULTS } = settings;

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-test-sw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// 1. serializeScalar Tests
// ═══════════════════════════════════════════════════════════════

test('serializeScalar: null returns "null"', () => {
  assertEqual(serializeScalar(null), 'null');
});

test('serializeScalar: undefined returns "null"', () => {
  assertEqual(serializeScalar(undefined), 'null');
});

test('serializeScalar: boolean true', () => {
  assertEqual(serializeScalar(true), 'true');
});

test('serializeScalar: boolean false', () => {
  assertEqual(serializeScalar(false), 'false');
});

test('serializeScalar: number integer', () => {
  assertEqual(serializeScalar(42), '42');
});

test('serializeScalar: number float', () => {
  assertEqual(serializeScalar(3.14), '3.14');
});

test('serializeScalar: plain string', () => {
  assertEqual(serializeScalar('hello'), 'hello');
});

test('serializeScalar: string "true" gets quoted', () => {
  assertEqual(serializeScalar('true'), '"true"');
});

test('serializeScalar: string "false" gets quoted', () => {
  assertEqual(serializeScalar('false'), '"false"');
});

test('serializeScalar: string "null" gets quoted', () => {
  assertEqual(serializeScalar('null'), '"null"');
});

test('serializeScalar: empty string gets quoted', () => {
  assertEqual(serializeScalar(''), '""');
});

test('serializeScalar: numeric string gets quoted', () => {
  assertEqual(serializeScalar('42'), '"42"');
});

test('serializeScalar: string with colon gets quoted', () => {
  assert(serializeScalar('key: value').startsWith('"'), 'should be quoted');
});

test('serializeScalar: string with hash gets quoted', () => {
  assert(serializeScalar('has # comment').startsWith('"'), 'should be quoted');
});
