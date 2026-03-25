const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'hooks', 'ezra-settings-writer.js');
let c = fs.readFileSync(filePath, 'utf-8');

if (c.includes('validateProjectDir')) {
  console.log('Guard already exists');
  process.exit(0);
}

const old = `function settingsPath(projectDir) {
  return path.join(projectDir, '.ezra', 'settings.yaml');
}`;

const replacement = `function validateProjectDir(projectDir) {
  if (!projectDir || typeof projectDir !== 'string') return false;
  const normalized = path.normalize(projectDir);
  if (normalized.includes('..')) return false;
  return true;
}

function settingsPath(projectDir) {
  if (!validateProjectDir(projectDir)) throw new Error('Invalid project directory: path traversal detected');
  return path.join(projectDir, '.ezra', 'settings.yaml');
}`;

c = c.replace(old, replacement);
fs.writeFileSync(filePath, c, 'utf-8');
console.log('Added traversal guard to settingsPath');
