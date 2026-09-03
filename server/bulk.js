// Parses several questions pasted as plain text. Blocks are separated by blank lines:
//
//   Q: Which HTTP method is idempotent?
//   A) POST
//   *B) PUT
//   C) PATCH
//   D) CONNECT
//   complexity: medium
//   time: 45
//   explanation: PUT replaces the whole resource, so repeating it has the same effect.
//
// A leading * marks the correct option. complexity / time / explanation lines are optional.

const OPTION = /^\s*(\*?)\s*(?:\(?([A-Da-d])[\).:\]]|[-•])\s+(.+?)\s*$/;
const META = /^\s*(complexity|difficulty|time|seconds|explanation|why)\s*[:=]\s*(.+?)\s*$/i;
const QUESTION_PREFIX = /^\s*(?:q\s*\d*\s*[:.)-]|\d+\s*[.)])\s*/i;

export function parseBulk(text) {
  const blocks = String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  const errors = [];

  blocks.forEach((block, i) => {
    const lines = block.split('\n');
    const q = { text: '', options: [], answer: -1, complexity: 'medium', seconds: null, explanation: '' };
    const textLines = [];
    for (const line of lines) {
      const m = line.match(OPTION);
      if (m && (q.options.length < 4)) {
        if (m[1] === '*') q.answer = q.options.length;
        q.options.push(m[3]);
        continue;
      }
      const meta = line.match(META);
      if (meta) {
        const key = meta[1].toLowerCase();
        const val = meta[2];
        if (key === 'complexity' || key === 'difficulty') q.complexity = val.toLowerCase();
        else if (key === 'time' || key === 'seconds') q.seconds = parseInt(val, 10) || null;
        else q.explanation = val;
        continue;
      }
      if (q.options.length === 0) textLines.push(line.replace(QUESTION_PREFIX, ''));
      else if (line.trim()) q.explanation = q.explanation ? `${q.explanation} ${line.trim()}` : line.trim();
    }
    q.text = textLines.join(' ').trim();
    const where = `Block ${i + 1}`;
    if (!q.text) errors.push(`${where}: no question text`);
    if (q.options.length !== 4) errors.push(`${where}: found ${q.options.length} options, need 4 (A–D)`);
    if (q.answer < 0) errors.push(`${where}: mark the correct option with a leading *`);
    if (!['easy', 'medium', 'hard'].includes(q.complexity)) errors.push(`${where}: complexity must be easy, medium or hard`);
    if (q.seconds !== null && (q.seconds < 5 || q.seconds > 600)) errors.push(`${where}: time must be 5–600 seconds`);
    questions.push(q);
  });

  if (!blocks.length) errors.push('Nothing to import.');
  return { questions, errors };
}
