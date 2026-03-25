const fs = require('fs');
const path = require('path');

// Phase 4: Import audit
const hookDir = path.join(__dirname, '..', 'hooks');
const files = fs.readdirSync(hookDir).filter(f => f.endsWith('.js'));
let brokenImports = 0;

for (const f of files) {
  const content = fs.readFileSync(path.join(hookDir, f), 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/require\(['"](\.[^'"]+)['"]\)/);
    if (match) {
      const mod = match[1];
      const resolved = path.resolve(hookDir, mod);
      if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.js') && !fs.existsSync(resolved + '.json')) {
        console.log(`BROKEN IMPORT: ${f}:${i+1} -> ${mod}`);
        brokenImports++;
      }
    }
  }
}
console.log(`\nBroken imports: ${brokenImports}`);

// Phase 5: Security scan - hardcoded secrets
const allFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.md') || entry.name.endsWith('.yaml')) allFiles.push(full);
  }
}
walk(path.join(__dirname, '..'));

let securityIssues = 0;
const secretPatterns = [
  /(?:api_key|apikey|secret_key|password|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}['"]/i,
  /sk[-_](?:live|test)_[A-Za-z0-9]{20,}/,
  /eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /AKIA[A-Z0-9]{16}/,
];

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  for (const pat of secretPatterns) {
    const match = content.match(pat);
    if (match) {
      const rel = path.relative(path.join(__dirname, '..'), f);
      // Skip test files and docs that reference patterns
      if (!rel.startsWith('tests') && !rel.startsWith('docs') && !rel.includes('CHANGELOG')) {
        console.log(`SECRET FOUND: ${rel} -> ${match[0].substring(0, 30)}...`);
        securityIssues++;
      }
    }
  }
}
console.log(`\nSecurity issues: ${securityIssues}`);

// Phase 5b: Path traversal protection
let pathTraversalChecks = 0;
for (const f of files) {
  const content = fs.readFileSync(path.join(hookDir, f), 'utf-8');
  if (content.includes('..') && (content.includes('readFile') || content.includes('writeFile'))) {
    if (content.includes('traversal') || content.includes('normalize') || content.includes('startsWith')) {
      pathTraversalChecks++;
    } else {
      console.log(`NO TRAVERSAL GUARD: ${f}`);
    }
  }
}
console.log(`\nHooks with traversal guards: ${pathTraversalChecks}`);

// Phase 7: Sync file reads
let syncReads = 0;
let asyncReads = 0;
for (const f of files) {
  const content = fs.readFileSync(path.join(hookDir, f), 'utf-8');
  syncReads += (content.match(/readFileSync/g) || []).length;
  asyncReads += (content.match(/readFile\b(?!Sync)/g) || []).length;
}
console.log(`\nSync reads: ${syncReads}, Async reads: ${asyncReads}`);
console.log('(Sync reads acceptable for CLI hooks that run once per invocation)');

// Summary
console.log('\n=== GAP ANALYSIS SUMMARY ===');
console.log(`Broken imports: ${brokenImports}`);
console.log(`Security issues: ${securityIssues}`);
console.log(`Path traversal guards: ${pathTraversalChecks}`);
