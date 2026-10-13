/** Run with `npm run test:integration`. First run may download VS Code; not an offline test. */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runTests } = require('@vscode/test-electron');

(async () => {
  // A disposable trusted workspace lets us test architecture questions without opening files.
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'sai-nii-integration-'));
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.writeFileSync(path.join(fixture, 'README.md'), '# Sample project\nA Python command-line experiment.\n');
  fs.writeFileSync(path.join(fixture, 'pyproject.toml'), '[project]\nname = "sample-project"\n');
  fs.writeFileSync(path.join(fixture, 'src', 'main.py'), 'def main():\n    print("hello")\n');
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, 'suite.cjs');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [fixture, '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust']
    });
  } catch (error) {
    console.error('VS Code integration tests failed:', error);
    process.exitCode = 1;
  } finally {
    try { fs.rmSync(fixture, { recursive: true, force: true }); } catch { /* cleanup only */ }
  }
})();
