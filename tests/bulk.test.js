import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulk } from '../server/bulk.js';

test('parses several pasted questions with optional metadata', () => {
  const text = `Q: Which HTTP method is idempotent?
A) POST
*B) PUT
C) PATCH
D) CONNECT
complexity: medium
time: 45
explanation: PUT replaces the whole resource.

2. What does DI stand for?
- Direct Injection
- Data Interface
*- Dependency Injection
- Dynamic Import
[hard]`;
  const { questions, errors } = parseBulk(text);
  assert.deepEqual(errors, []);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].text, 'Which HTTP method is idempotent?');
  assert.deepEqual(questions[0].options, ['POST', 'PUT', 'PATCH', 'CONNECT']);
  assert.equal(questions[0].answer, 1);
  assert.equal(questions[0].complexity, 'medium');
  assert.equal(questions[0].seconds, 45);
  assert.equal(questions[0].explanation, 'PUT replaces the whole resource.');
  assert.equal(questions[1].text, 'What does DI stand for?');
  assert.equal(questions[1].answer, 2);
  assert.equal(questions[1].complexity, 'medium', 'bracket syntax is not a supported metadata line, so the default stays');
});

test('reports which block is broken', () => {
  const { errors } = parseBulk(`Only three options?
A) one
B) two
*C) three

No correct marker
A) a
B) b
C) c
D) d`);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Block 1: found 3 options/);
  assert.match(errors[1], /Block 2: mark the correct option/);
});

test('empty input is an error', () => {
  assert.equal(parseBulk('').errors.length, 1);
});
