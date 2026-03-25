const fs = require('fs');
const path = require('path');

const fp = path.join(__dirname, '..', 'README.md');
let c = fs.readFileSync(fp, 'utf-8');

// Add /ezra:handoff and /ezra:learn before the closing ``` after cost
c = c.replace(
  '/ezra:cost          Cost tracking and budget management for AI agent usage\n```',
  '/ezra:cost          Cost tracking and budget management for AI agent usage\n/ezra:handoff       Generate session handoff brief for continuity across conversations\n/ezra:learn         Capture learnings, patterns, and anti-patterns into project memory\n```'
);

fs.writeFileSync(fp, c, 'utf-8');
console.log('README: Added /ezra:handoff and /ezra:learn');
