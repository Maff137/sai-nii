/** Run with `npm run test:integration`. First run may download VS Code; not an offline test. */
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

(async () => {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, 'suite.cjs');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--skip-welcome', '--skip-release-notes']
    });
  } catch (error) {
    console.error('VS Code integration tests failed:', error);
    process.exitCode = 1;
  }
})();
