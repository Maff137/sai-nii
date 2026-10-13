const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { importReferences, rankRelatedFiles, withinRoot, likelyTextFile } = require('../dist/related.js');

test('follows JavaScript and TypeScript relative imports, not unrelated files', () => {
  const paths = ['src/main.ts', 'src/orderService.ts', 'src/helpers.ts', 'docs/README.md', 'src/other.ts'];
  const ranked = rankRelatedFiles(paths, 'src/main.ts', "import { saveOrder } from './orderService';\nfunction x() { return saveOrder(); }", 'Por que saveOrder falha?');
  assert.deepEqual(ranked, ['src/orderService.ts']);
});

test('follows Python modules, preserving the language-independent interface', () => {
  const paths = ['app/main.py', 'app/services/orders.py', 'app/models.py', 'app/other.py'];
  const ranked = rankRelatedFiles(paths, 'app/main.py', 'from app.services.orders import create_order', 'Quero entender create_order');
  assert.deepEqual(ranked, ['app/services/orders.py']);
});

test('follows explicitly named files when no imports exist', () => {
  const paths = ['src/controller.go', 'src/storage.go', 'src/metrics.go'];
  const ranked = rankRelatedFiles(paths, 'src/controller.go', 'package handler', 'O que tem em storage.go?');
  assert.deepEqual(ranked, ['src/storage.go']);
});

test('does not select incidental neighboring files', () => {
  const paths = ['src/controller.py', 'src/unrelated.py', 'src/another.py'];
  assert.deepEqual(rankRelatedFiles(paths, 'src/controller.py', 'print("hello")', 'Explique este trecho'), []);
});

test('does not read outside a root even when paths begin with a similar prefix', () => {
  const base = path.resolve('/tmp/work');
  assert.equal(withinRoot(base, path.resolve('/tmp/work/src/a.ts')), true);
  assert.equal(withinRoot(base, path.resolve('/tmp/work/../work-secret/.env')), false);
  assert.equal(withinRoot(base, path.resolve('/tmp/work/../escape.ts')), false);
});

test('filters obvious binary formats without imposing a language allowlist', () => {
  assert.equal(likelyTextFile('src/weirdlang.foo'), true);
  assert.equal(likelyTextFile('art/assets/logo.png'), false);
  assert.equal(likelyTextFile('data/private.sqlite3'), false);
});

test('import extraction ignores arbitrary text without import markers', () => {
  assert.deepEqual(importReferences('const s = "foo";'), []);
});
