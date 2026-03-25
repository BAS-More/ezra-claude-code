const fs = require('fs');
const path = require('path');

const hookDir = path.join(__dirname, '..', 'hooks');
const files = fs.readdirSync(hookDir).filter(f => f.endsWith('.js'));

let gaps = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(hookDir, f), 'utf-8');
  const checks = [];
  
  // 1. Missing .ezra/ handling
  if (content.includes('.ezra') && !content.includes('existsSync') && !content.includes('exists')) {
    checks.push('NO_EZRA_DIR_CHECK');
  }
  
  // 2. Missing try/catch around file operations
  if ((content.includes('readFileSync') || content.includes('writeFileSync')) && !content.includes('try')) {
    checks.push('NO_TRY_CATCH');
  }
  
  // 3. Missing error exit safety (hooks should never block work)
  if (content.includes('process.stdin') && !content.includes('process.exit(0)')) {
    checks.push('MISSING_EXIT_0');
  }
  
  // 4. Missing stdin size limit for stdin-based hooks
  if (content.includes('process.stdin') && !content.includes('MAX_STDIN') && !content.includes('maxStdin')) {
    checks.push('NO_STDIN_LIMIT');
  }
  
  // 5. Uncaught JSON.parse
  if (content.includes('JSON.parse') && !content.includes('try')) {
    checks.push('UNGUARDED_JSON_PARSE');
  }
  
  if (checks.length > 0) {
    gaps.push({ file: f, issues: checks });
  }
}

console.log('=== PHASE 6: BEHAVIORAL GAP DETECTION ===\n');
if (gaps.length === 0) {
  console.log('No behavioral gaps found.\n');
} else {
  for (const g of gaps) {
    console.log(`${g.file}: ${g.issues.join(', ')}`);
  }
  console.log(`\nTotal hooks with gaps: ${gaps.length}`);
}

// Phase 7: Performance check - unbounded loops
console.log('\n=== PHASE 7: PERFORMANCE CHECK ===\n');
let perfIssues = 0;
for (const f of files) {
  const content = fs.readFileSync(path.join(hookDir, f), 'utf-8');
  // Check for recursive directory walks without depth limit
  if (content.includes('readdirSync') && content.includes('recursive') && !content.includes('depth') && !content.includes('maxDepth')) {
    console.log(`UNBOUNDED RECURSION: ${f}`);
    perfIssues++;
  }
  // Check for while(true) without break
  if (content.match(/while\s*\(\s*true\s*\)/) && !content.includes('break')) {
    console.log(`INFINITE LOOP: ${f}`);
    perfIssues++;
  }
}
if (perfIssues === 0) {
  console.log('No performance issues found.');
}
console.log(`Performance issues: ${perfIssues}`);
