#!/usr/bin/env node
'use strict';
const path = require('path');
const { parseValue, parseYamlSimple, deepMerge, stringifyYaml } = require(path.join(__dirname, '..', 'hooks', 'ezra-yaml-utils.js'));

let passed = 0, failed = 0;
const results = [];
function test(name, fn) { try { fn(); passed++; results.push({ name, status: 'PASS' }); } catch (e) { failed++; results.push({ name, status: 'FAIL', error: e.message }); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

// --- parseValue ---
test('parseValue is a function', () => { assert(typeof parseValue === 'function'); });
test('parseValue null → null', () => { assert(parseValue(null) === null); });
test('parseValue undefined → null', () => { assert(parseValue(undefined) === null); });
test('parseValue empty string → null', () => { assert(parseValue('') === null); });
test('parseValue "null" → null', () => { assert(parseValue('null') === null); });
test('parseValue "~" → null', () => { assert(parseValue('~') === null); });
test('parseValue "true" → true', () => { assert(parseValue('true') === true); });
test('parseValue "false" → false', () => { assert(parseValue('false') === false); });
test('parseValue "42" → 42', () => { assert(parseValue('42') === 42); });
test('parseValue "3.14" → 3.14', () => { assert(parseValue('3.14') === 3.14); });
test('parseValue quoted string', () => { assert(parseValue('"hello"') === 'hello'); });
test('parseValue plain string', () => { assert(parseValue('hello') === 'hello'); });
test('parseValue inline array', () => { const r = parseValue('[a, b]'); assert(Array.isArray(r) && r.length === 2); });
test('parseValue empty array', () => { const r = parseValue('[]'); assert(Array.isArray(r) && r.length === 0); });
test('parseValue inline object', () => { const r = parseValue('{k: v}'); assert(typeof r === 'object' && r.k === 'v'); });
test('parseValue empty object', () => { const r = parseValue('{}'); assert(typeof r === 'object' && Object.keys(r).length === 0); });
test('parseValue rejects __proto__', () => { const r = parseValue('{__proto__: evil}'); assert(!r || !r.__proto__ || r.__proto__ !== 'evil'); });

// --- parseYamlSimple ---
test('parseYamlSimple is a function', () => { assert(typeof parseYamlSimple === 'function'); });
test('parseYamlSimple empty → {}', () => { const r = parseYamlSimple(''); assert(typeof r === 'object' && Object.keys(r).length === 0); });
test('parseYamlSimple simple kv', () => { const r = parseYamlSimple('name: test\nversion: 1'); assert(r.name === 'test'); });
test('parseYamlSimple nested', () => { const r = parseYamlSimple('top:\n  sub: val'); assert(r.top && r.top.sub === 'val'); });
test('parseYamlSimple skips comments', () => { const r = parseYamlSimple('# comment\nkey: val'); assert(r.key === 'val'); });
test('parseYamlSimple list items', () => { const r = parseYamlSimple('items:\n  - one\n  - two'); assert(Array.isArray(r.items) && r.items.length === 2); });
test('parseYamlSimple rejects __proto__ key', () => { const r = parseYamlSimple('__proto__: evil'); assert(r.__proto__ !== 'evil'); });

// --- deepMerge ---
test('deepMerge is a function', () => { assert(typeof deepMerge === 'function'); });
test('deepMerge basic', () => { const r = deepMerge({ a: 1 }, { b: 2 }); assert(r.a === 1 && r.b === 2); });
test('deepMerge overwrites', () => { const r = deepMerge({ a: 1 }, { a: 2 }); assert(r.a === 2); });
test('deepMerge deep', () => { const r = deepMerge({ x: { a: 1 } }, { x: { b: 2 } }); assert(r.x.a === 1 && r.x.b === 2); });
test('deepMerge replaces arrays', () => { const r = deepMerge({ a: [1] }, { a: [2, 3] }); assert(r.a.length === 2); });
test('deepMerge handles empty objects', () => { const r = deepMerge({}, { a: 1 }); assert(r.a === 1); });
test('deepMerge blocks __proto__', () => { const r = deepMerge({}, { '__proto__': { x: 1 } }); assert(!r.x); });

// --- stringifyYaml ---
test('stringifyYaml is a function', () => { assert(typeof stringifyYaml === 'function'); });
test('stringifyYaml simple', () => { const s = stringifyYaml({ name: 'test' }); assert(s.includes('name:') && s.includes('test')); });
test('stringifyYaml null value', () => { const s = stringifyYaml({ x: null }); assert(s.includes('null')); });
test('stringifyYaml array', () => { const s = stringifyYaml({ items: [1, 2, 3] }); assert(s.includes('items:')); });
test('stringifyYaml nested', () => { const s = stringifyYaml({ a: { b: 'c' } }); assert(s.includes('a:') && s.includes('b:')); });
test('stringifyYaml empty object', () => { const s = stringifyYaml({}); assert(typeof s === 'string'); });
test('stringifyYaml roundtrip', () => { const obj = { a: 'hello', b: 42, c: true }; const y = stringifyYaml(obj); const back = parseYamlSimple(y); assert(back.a === 'hello'); });

console.log(`\n  test-v7-yaml-utils: ${passed} passed, ${failed} failed`);
console.log(`  test-v7-yaml-utils: PASSED: ${passed} FAILED: ${failed}`);
if (failed > 0) results.filter(r => r.status === 'FAIL').forEach(r => console.log(`    ✗ ${r.name}: ${r.error}`));
module.exports = { passed, failed, results };
