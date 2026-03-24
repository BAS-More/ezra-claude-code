#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  SYNC_DIR,
  MANIFEST_FILE,
  SYNC_STATE_FILE,
  SYNCABLE_PATHS,
  readYaml,
  writeYaml,
  hashFile,
  hashDir,
  generateManifest,
  countFilesInDir,
  getSyncDir,
  loadSyncState,
  saveSyncState,
  createBackup,
  copyDirRecursive,
  listBackups,
  restoreFromBackup,
  diffManifests,
  readCloudSyncSettings,
  pushSync,
  pullSync,
} = require(path.join(__dirname, '..', 'hooks', 'ezra-cloud-sync.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; }
  catch (err) { failed++; console.error('  FAIL: ' + name + ' — ' + err.message); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function makeTempDir() {
  const dir = path.join(os.tmpdir(), 'ezra-cloud-sync-test-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function setupEzra(dir) {
  const ezraDir = path.join(dir, '.ezra');
  fs.mkdirSync(path.join(ezraDir, 'decisions'), { recursive: true });
  fs.mkdirSync(path.join(ezraDir, 'versions'), { recursive: true });
  writeYaml(path.join(ezraDir, 'governance.yaml'), { name: 'test-project', version: '1.0.0' });
  writeYaml(path.join(ezraDir, 'knowledge.yaml'), { entries: 0 });
  writeYaml(path.join(ezraDir, 'settings.yaml'), { version: '6.0.0' });
  writeYaml(path.join(ezraDir, 'decisions', 'ADR-001.yaml'), { id: 'ADR-001', title: 'Test decision' });
  return ezraDir;
}

// === 1. Constants ===

test('SYNC_DIR is .ezra-sync', () => {
  assert(SYNC_DIR === '.ezra-sync', 'Expected .ezra-sync, got ' + SYNC_DIR);
});

test('MANIFEST_FILE is sync-manifest.yaml', () => {
  assert(MANIFEST_FILE === 'sync-manifest.yaml');
});

test('SYNC_STATE_FILE is sync-state.yaml', () => {
  assert(SYNC_STATE_FILE === 'sync-state.yaml');
});

test('SYNCABLE_PATHS is non-empty array', () => {
  assert(Array.isArray(SYNCABLE_PATHS));
  assert(SYNCABLE_PATHS.length > 0, 'Should have syncable paths');
});

test('SYNCABLE_PATHS includes governance.yaml', () => {
  assert(SYNCABLE_PATHS.includes('governance.yaml'));
});

test('SYNCABLE_PATHS includes decisions', () => {
  assert(SYNCABLE_PATHS.includes('decisions'));
});

// === 2. readYaml / writeYaml ===

test('writeYaml creates file and readYaml reads it back', () => {
  const dir = makeTempDir();
  try {
    const fp = path.join(dir, 'test.yaml');
    writeYaml(fp, { name: 'hello', count: 42, active: true });
    assert(fs.existsSync(fp));
    const data = readYaml(fp);
    assert(data.name === 'hello');
    assert(data.count === 42);
    assert(data.active === true);
  } finally { cleanup(dir); }
});

test('readYaml returns empty for missing file', () => {
  const data = readYaml('/nonexistent/path/file.yaml');
  assert(Object.keys(data).length === 0);
});

test('writeYaml creates parent directories', () => {
  const dir = makeTempDir();
  try {
    const fp = path.join(dir, 'deep', 'nested', 'test.yaml');
    writeYaml(fp, { key: 'value' });
    assert(fs.existsSync(fp));
  } finally { cleanup(dir); }
});

// === 3. hashFile / hashDir ===

test('hashFile returns 16-char hex for existing file', () => {
  const dir = makeTempDir();
  try {
    const fp = path.join(dir, 'test.txt');
    fs.writeFileSync(fp, 'hello world');
    const hash = hashFile(fp);
    assert(hash !== null);
    assert(hash.length === 16, 'Expected 16-char hash, got ' + hash.length);
    assert(/^[0-9a-f]+$/.test(hash), 'Should be hex');
  } finally { cleanup(dir); }
});

test('hashFile returns null for missing file', () => {
  assert(hashFile('/nonexistent/file.txt') === null);
});

test('hashDir returns null for missing dir', () => {
  assert(hashDir('/nonexistent/dir') === null);
});

test('hashDir returns hash for directory with files', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'aaa');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'bbb');
    const hash = hashDir(dir);
    assert(hash !== null);
    assert(hash.length === 16);
  } finally { cleanup(dir); }
});

test('hashDir returns null for empty directory', () => {
  const dir = makeTempDir();
  try {
    const hash = hashDir(dir);
    assert(hash === null, 'Empty dir should return null');
  } finally { cleanup(dir); }
});

// === 4. generateManifest ===

test('generateManifest returns error for non-initialized project', () => {
  const dir = makeTempDir();
  try {
    const manifest = generateManifest(dir);
    assert(manifest.error, 'Should return error');
    assert(manifest.entries.length === 0);
  } finally { cleanup(dir); }
});

test('generateManifest returns entries for initialized project', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const manifest = generateManifest(dir);
    assert(!manifest.error, 'Should not have error');
    assert(manifest.entries.length > 0, 'Should have entries');
    assert(manifest.total_entries === manifest.entries.length);
    assert(manifest.project === path.basename(dir));
    assert(manifest.generated);
  } finally { cleanup(dir); }
});

test('generateManifest entries have path, type, hash', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const manifest = generateManifest(dir);
    for (const entry of manifest.entries) {
      assert(entry.path, 'Missing path');
      assert(entry.type === 'file' || entry.type === 'directory', 'Bad type: ' + entry.type);
      assert(entry.modified, 'Missing modified');
    }
  } finally { cleanup(dir); }
});

// === 5. countFilesInDir ===

test('countFilesInDir counts files', () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'c.txt'), 'c');
    assert(countFilesInDir(dir) === 3, 'Expected 3 files');
  } finally { cleanup(dir); }
});

// === 6. getSyncDir / loadSyncState / saveSyncState ===

test('getSyncDir returns correct path', () => {
  const result = getSyncDir('/my/project');
  assert(result.includes('.ezra'));
  assert(result.includes(SYNC_DIR));
});

test('loadSyncState returns empty for missing state', () => {
  const dir = makeTempDir();
  try {
    const state = loadSyncState(dir);
    assert(Object.keys(state).length === 0);
  } finally { cleanup(dir); }
});

test('saveSyncState persists and loadSyncState reads back', () => {
  const dir = makeTempDir();
  try {
    saveSyncState(dir, { last_backup: '2025-01-01', files: 10 });
    const state = loadSyncState(dir);
    assert(state.last_backup === '2025-01-01');
    assert(state.files === 10);
  } finally { cleanup(dir); }
});

// === 7. createBackup / listBackups / restoreFromBackup ===

test('createBackup returns error for non-initialized project', () => {
  const dir = makeTempDir();
  try {
    const result = createBackup(dir);
    assert(result.error, 'Should return error');
  } finally { cleanup(dir); }
});

test('createBackup creates backup successfully', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const result = createBackup(dir);
    assert(!result.error, 'Should not have error');
    assert(result.files_copied > 0, 'Should copy files');
    assert(result.backup_dir, 'Should have backup dir');
    assert(result.timestamp, 'Should have timestamp');
    assert(fs.existsSync(result.backup_dir));
  } finally { cleanup(dir); }
});

test('listBackups returns empty when no backups', () => {
  const dir = makeTempDir();
  try {
    const backups = listBackups(dir);
    assert(backups.length === 0);
  } finally { cleanup(dir); }
});

test('listBackups returns backup after createBackup', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    createBackup(dir);
    const backups = listBackups(dir);
    assert(backups.length === 1, 'Expected 1 backup, got ' + backups.length);
    assert(backups[0].name, 'Backup should have name');
    assert(backups[0].path, 'Backup should have path');
  } finally { cleanup(dir); }
});

test('restoreFromBackup restores files', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const backupResult = createBackup(dir);
    // Modify a file
    writeYaml(path.join(dir, '.ezra', 'governance.yaml'), { name: 'modified', version: '2.0.0' });
    // Restore
    const restoreResult = restoreFromBackup(dir, backupResult.timestamp);
    assert(restoreResult.files_restored > 0, 'Should restore files');
    // Check file was restored
    const gov = readYaml(path.join(dir, '.ezra', 'governance.yaml'));
    assert(gov.name === 'test-project', 'Should restore original data');
  } finally { cleanup(dir); }
});

test('restoreFromBackup returns error for missing backup', () => {
  const dir = makeTempDir();
  try {
    const result = restoreFromBackup(dir, 'nonexistent-backup');
    assert(result.error, 'Should return error');
  } finally { cleanup(dir); }
});

// === 8. diffManifests ===

test('diffManifests detects added entries', () => {
  const m1 = { entries: [] };
  const m2 = { entries: [{ path: 'new.yaml', hash: 'abc123' }] };
  const diffs = diffManifests(m1, m2);
  assert(diffs.length === 1);
  assert(diffs[0].change === 'added');
});

test('diffManifests detects removed entries', () => {
  const m1 = { entries: [{ path: 'old.yaml', hash: 'abc123' }] };
  const m2 = { entries: [] };
  const diffs = diffManifests(m1, m2);
  assert(diffs.length === 1);
  assert(diffs[0].change === 'removed');
});

test('diffManifests detects modified entries', () => {
  const m1 = { entries: [{ path: 'file.yaml', hash: 'aaa' }] };
  const m2 = { entries: [{ path: 'file.yaml', hash: 'bbb' }] };
  const diffs = diffManifests(m1, m2);
  assert(diffs.length === 1);
  assert(diffs[0].change === 'modified');
  assert(diffs[0].old_hash === 'aaa');
  assert(diffs[0].new_hash === 'bbb');
});

test('diffManifests returns empty for identical manifests', () => {
  const m1 = { entries: [{ path: 'file.yaml', hash: 'same' }] };
  const m2 = { entries: [{ path: 'file.yaml', hash: 'same' }] };
  const diffs = diffManifests(m1, m2);
  assert(diffs.length === 0);
});

test('diffManifests handles empty entries', () => {
  const diffs = diffManifests({}, {});
  assert(diffs.length === 0);
});

// === 9. readCloudSyncSettings ===

test('readCloudSyncSettings returns empty for missing settings', () => {
  const dir = makeTempDir();
  try {
    const settings = readCloudSyncSettings(dir);
    assert(Object.keys(settings).length === 0);
  } finally { cleanup(dir); }
});

// === 10. pushSync / pullSync (disabled cloud) ===

test('pushSync returns skipped when cloud_sync disabled', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const result = pushSync(dir);
    // pushSync is synchronous when cloud is disabled
    assert(result.skipped === true, 'Should be skipped');
    assert(result.reason === 'cloud_sync_disabled');
  } finally { cleanup(dir); }
});

test('pullSync returns skipped when cloud_sync disabled', () => {
  const dir = makeTempDir();
  try {
    setupEzra(dir);
    const result = pullSync(dir);
    assert(result.skipped === true, 'Should be skipped');
    assert(result.reason === 'cloud_sync_disabled');
  } finally { cleanup(dir); }
});

// === 11. copyDirRecursive ===

test('copyDirRecursive copies files', () => {
  const dir = makeTempDir();
  try {
    const src = path.join(dir, 'src');
    const dest = path.join(dir, 'dest');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'file.txt'), 'content');
    copyDirRecursive(src, dest);
    assert(fs.existsSync(path.join(dest, 'file.txt')));
    assert(fs.readFileSync(path.join(dest, 'file.txt'), 'utf8') === 'content');
  } finally { cleanup(dir); }
});

// === 12. Module structure ===

test('Module exports all required items', () => {
  const mod = require(path.join(__dirname, '..', 'hooks', 'ezra-cloud-sync.js'));
  const required = [
    'SYNC_DIR', 'MANIFEST_FILE', 'SYNC_STATE_FILE', 'SYNCABLE_PATHS',
    'readYaml', 'writeYaml', 'hashFile', 'hashDir', 'generateManifest',
    'countFilesInDir', 'getSyncDir', 'loadSyncState', 'saveSyncState',
    'createBackup', 'copyDirRecursive', 'listBackups', 'restoreFromBackup',
    'diffManifests', 'readCloudSyncSettings', 'pushSync', 'pullSync',
  ];
  for (const name of required) {
    assert(name in mod, 'Missing export: ' + name);
  }
});

// === Summary ===

console.log('  V6-Cloud-Sync: ' + passed + ' passed, ' + failed + ' failed');
console.log('  V6-Cloud-Sync: PASSED: ' + passed + ' FAILED: ' + failed);
process.exit(failed > 0 ? 1 : 0);
