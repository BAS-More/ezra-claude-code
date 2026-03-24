#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  HOOK_FILES,
  INSTALL_PATHS,
  install,
  uninstall,
  update,
  getInstallStatus,
  initProject,
  getEzraRoot,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-installer.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-installer-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// === 1. HOOK_FILES ===

test('HOOK_FILES is non-empty array', () => {
  assert(Array.isArray(HOOK_FILES));
  assert(HOOK_FILES.length > 0, 'Should have hook files');
});

test('HOOK_FILES contains known hooks', () => {
  assert(HOOK_FILES.includes('ezra-guard.js'), 'Should include ezra-guard.js');
  assert(HOOK_FILES.includes('ezra-settings.js'), 'Should include ezra-settings.js');
  assert(HOOK_FILES.includes('ezra-agents.js'), 'Should include ezra-agents.js');
});

test('HOOK_FILES entries are all .js files', () => {
  for (const f of HOOK_FILES) {
    assert(f.endsWith('.js'), 'Expected .js file: ' + f);
  }
});

test('HOOK_FILES entries are unique', () => {
  assert(new Set(HOOK_FILES).size === HOOK_FILES.length, 'Duplicate hook files');
});

// === 2. INSTALL_PATHS ===

test('INSTALL_PATHS has expected keys', () => {
  assert(INSTALL_PATHS.global_hooks, 'Missing global_hooks');
  assert(INSTALL_PATHS.global_commands, 'Missing global_commands');
  assert(INSTALL_PATHS.local_hooks, 'Missing local_hooks');
  assert(INSTALL_PATHS.local_commands, 'Missing local_commands');
});

test('INSTALL_PATHS global_hooks uses homedir', () => {
  assert(INSTALL_PATHS.global_hooks.includes('.claude'), 'Should include .claude');
});

// === 3. getEzraRoot ===

test('getEzraRoot returns a directory', () => {
  const root = getEzraRoot();
  assert(root, 'Should return a path');
  assert(fs.existsSync(root), 'Root should exist');
});

test('getEzraRoot returns directory with package.json', () => {
  const root = getEzraRoot();
  const pkgPath = path.join(root, 'package.json');
  assert(fs.existsSync(pkgPath), 'Should have package.json');
});

// === 4. install ===

test('install copies hooks to target directory', () => {
  const dir = makeTempDir();
  try {
    const hooksDir = path.join(dir, 'hooks');
    const result = install(hooksDir);
    assert(result.installed_hooks > 0, 'Should install hooks');
    assert(result.target === hooksDir, 'Target should match');
  } finally { cleanup(dir); }
});

test('install creates target directory', () => {
  const dir = makeTempDir();
  try {
    const hooksDir = path.join(dir, 'deep', 'nested', 'hooks');
    install(hooksDir);
    assert(fs.existsSync(hooksDir), 'Should create directory');
  } finally { cleanup(dir); }
});

// === 5. uninstall ===

test('uninstall removes installed hooks', () => {
  const dir = makeTempDir();
  try {
    const hooksDir = path.join(dir, 'hooks');
    install(hooksDir);
    const result = uninstall(hooksDir);
    assert(result.success === true);
    assert(result.removed > 0, 'Should remove hooks');
  } finally { cleanup(dir); }
});

test('uninstall on empty directory succeeds', () => {
  const dir = makeTempDir();
  try {
    const result = uninstall(path.join(dir, 'nonexistent'));
    assert(result.success === true);
    assert(result.removed === 0);
  } finally { cleanup(dir); }
});

// === 6. update ===

test('update reinstalls hooks', () => {
  const dir = makeTempDir();
  try {
    const hooksDir = path.join(dir, 'hooks');
    install(hooksDir);
    const result = update(hooksDir);
    assert(result.installed_hooks > 0, 'Should reinstall hooks');
  } finally { cleanup(dir); }
});

// === 7. getInstallStatus ===

test('getInstallStatus shows missing for empty dir', () => {
  const dir = makeTempDir();
  try {
    const status = getInstallStatus(path.join(dir, 'hooks'));
    assert(status.installed === false, 'Should not be installed');
    assert(status.missing > 0, 'Should have missing hooks');
    assert(status.present === 0, 'Should have 0 present');
  } finally { cleanup(dir); }
});

test('getInstallStatus shows installed after install', () => {
  const dir = makeTempDir();
  try {
    const hooksDir = path.join(dir, 'hooks');
    install(hooksDir);
    const status = getInstallStatus(hooksDir);
    assert(status.present > 0, 'Should have present hooks');
    assert(Array.isArray(status.missingFiles), 'Should have missingFiles array');
  } finally { cleanup(dir); }
});

// === 8. initProject ===

test('initProject creates .ezra directory', () => {
  const dir = makeTempDir();
  try {
    const result = initProject(dir);
    assert(result.success === true);
    assert(fs.existsSync(path.join(dir, '.ezra')), '.ezra should exist');
  } finally { cleanup(dir); }
});

test('initProject creates settings.yaml', () => {
  const dir = makeTempDir();
  try {
    initProject(dir);
    const settingsPath = path.join(dir, '.ezra', 'settings.yaml');
    assert(fs.existsSync(settingsPath), 'settings.yaml should exist');
    const content = fs.readFileSync(settingsPath, 'utf8');
    assert(content.includes('EZRA'), 'Should reference EZRA');
  } finally { cleanup(dir); }
});

test('initProject does not overwrite existing settings', () => {
  const dir = makeTempDir();
  try {
    initProject(dir);
    const settingsPath = path.join(dir, '.ezra', 'settings.yaml');
    fs.writeFileSync(settingsPath, 'custom: true\n');
    initProject(dir); // Call again
    const content = fs.readFileSync(settingsPath, 'utf8');
    assert(content.includes('custom'), 'Should preserve existing settings');
  } finally { cleanup(dir); }
});

test('initProject returns path', () => {
  const dir = makeTempDir();
  try {
    const result = initProject(dir);
    assert(result.path, 'Should return path');
    assert(result.path.includes('.ezra'));
  } finally { cleanup(dir); }
});

// === 9. Module exports all required items ===

test('Module exports all required items', () => {
  const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-installer.js'));
  const required = ['HOOK_FILES', 'INSTALL_PATHS', 'install', 'uninstall', 'update', 'getInstallStatus', 'initProject', 'getEzraRoot'];
  for (const name of required) {
    assert(name in mod, 'Missing export: ' + name);
  }
});

// === Summary ===

console.log('  V6-Installer: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Installer: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
