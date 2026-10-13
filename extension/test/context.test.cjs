const { test } = require('node:test');
const assert = require('node:assert/strict');
// Context imports vscode; path filter will be integration-tested inside Extension Host.
test('placeholder for VS Code host integration', {skip:'requires VS Code extension host'}, () => assert.ok(true));
