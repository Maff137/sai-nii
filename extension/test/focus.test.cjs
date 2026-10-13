const { test } = require('node:test');
const assert = require('node:assert/strict');
const { focusedSource } = require('../dist/focus.js');

test('prioritizes a named symbol in a large source file despite the cursor at line one', () => {
  const source = '// initial line\n'.repeat(800) + 'setInterval(function () {\n  doSomething();\n}, 1000);\n';
  const result = focusedSource(source, 'Quero entender o setInterval', 0, 600);
  assert.match(result, /setInterval\(function/);
  assert.match(result, /doSomething/);
  assert.match(result, /}, 1000\)/);
  assert.ok(result.length < 850);
});

test('works for other languages and falls back to the cursor with no named symbol', () => {
  const source = 'def process_order():\n    return 1\n';
  assert.match(focusedSource(source, 'Como funciona isso?', 0), /def process_order/);
});
