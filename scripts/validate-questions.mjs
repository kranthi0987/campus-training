// Validates every question bank under server/seed/questions.
// Usage: node scripts/validate-questions.mjs [file ...]
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.resolve('server/seed/questions');
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => path.resolve(f))
  : readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));

const COMPLEXITY = new Set(['easy', 'medium', 'hard']);
let failed = false;

for (const file of files) {
  const problems = [];
  let list;
  try {
    list = (await import(pathToFileURL(file).href)).default;
  } catch (e) {
    problems.push(`cannot import: ${e.message}`);
  }
  if (Array.isArray(list)) {
    if (list.length < 12 || list.length > 30) problems.push(`has ${list.length} questions; need 12–30`);
    const seen = new Set();
    const positions = [0, 0, 0, 0];
    const byComplexity = { easy: 0, medium: 0, hard: 0 };
    list.forEach((q, i) => {
      const where = `#${i + 1}`;
      if (typeof q.text !== 'string' || q.text.trim().length < 10) problems.push(`${where}: text missing or too short`);
      if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${where}: needs exactly 4 options`);
      else {
        q.options.forEach((o, j) => { if (typeof o !== 'string' || !o.trim()) problems.push(`${where}: option ${j} empty`); });
        if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== 4) problems.push(`${where}: duplicate options`);
        if (q.options.some((o) => /all of the above|none of the above/i.test(o))) problems.push(`${where}: avoid "all/none of the above"`);
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${where}: answer must be 0–3`);
      else positions[q.answer]++;
      if (!COMPLEXITY.has(q.complexity)) problems.push(`${where}: complexity must be easy|medium|hard`);
      else byComplexity[q.complexity]++;
      if (q.explanation !== undefined && (typeof q.explanation !== 'string' || q.explanation.split(/\s+/).length > 40)) problems.push(`${where}: explanation must be a string ≤ 40 words`);
      if (q.code !== undefined && (typeof q.code !== 'string' || q.code.split('\n').length > 14)) problems.push(`${where}: code must be a string of at most 14 lines`);
      const key = (String(q.text).trim() + '\n' + String(q.code || '').trim()).toLowerCase();
      if (seen.has(key)) problems.push(`${where}: duplicate question text`);
      seen.add(key);
    });
    const max = Math.max(...positions), min = Math.min(...positions);
    const warnings = [];
    if (list.length && max - min > Math.ceil(list.length / 3)) warnings.push(`correct answers unevenly spread across positions A–D: ${positions.join('/')}`);
    if (list.length && (byComplexity.easy < 3 || byComplexity.medium < 3 || byComplexity.hard < 3)) problems.push(`complexity mix too thin: ${JSON.stringify(byComplexity)}`);
    if (warnings.length) console.log(`warn ${path.basename(file)}: ${warnings.join('; ')}`);
  } else if (!problems.length) {
    problems.push('default export is not an array');
  }
  const name = path.basename(file);
  if (problems.length) { failed = true; console.log(`FAIL ${name}\n  - ${problems.join('\n  - ')}`); }
  else console.log(`ok   ${name}: ${list.length} questions`);
}
process.exit(failed ? 1 : 0);
