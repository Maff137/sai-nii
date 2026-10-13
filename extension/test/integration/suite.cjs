const assert = require('node:assert/strict');
const vscode = require('vscode');

async function run() {
  const extension = vscode.extensions.getExtension('sai-nii.sai-nii');
  assert.ok(extension, 'Sai-nii extension must be available in the development host');
  await extension.activate();
  assert.equal(extension.isActive, true);
  const allCommands = await vscode.commands.getCommands(true);
  assert.ok(allCommands.includes('sainii.ask'), 'ask command registered');
  assert.ok(allCommands.includes('sainii.analyzeSelection'), 'selection command registered');
  assert.ok(allCommands.includes('sainii.clearMemory'), 'clear memory command registered');
  console.log('Sai-nii extension host smoke: activation and commands OK');
}
module.exports = { run };
