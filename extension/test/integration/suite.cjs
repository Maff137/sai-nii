const assert = require('node:assert/strict');
const vscode = require('vscode');
const { snapshot } = require('../../dist/context.js');

async function run() {
  const extension = vscode.extensions.getExtension('sai-nii.sai-nii');
  assert.ok(extension, 'Sai-nii extension must be available in the development host');
  await extension.activate();
  assert.equal(extension.isActive, true);
  const allCommands = await vscode.commands.getCommands(true);
  assert.ok(allCommands.includes('sainii.ask'), 'ask command registered');
  assert.ok(allCommands.includes('sainii.analyzeSelection'), 'selection command registered');
  assert.ok(allCommands.includes('sainii.clearMemory'), 'clear memory command registered');
  const context = await snapshot('Por que os arquivos do código são organizados do jeito que estão?');
  assert.ok(context, 'architecture context is available with a trusted project folder');
  assert.equal(context.file, '(raiz)', 'architecture analysis must not require an open editor');
  assert.match(context.content, /src\//, 'workspace tree includes an observed directory');
  assert.match(context.content, /pyproject\.toml/, 'workspace manifest is visible to the model');
  assert.match(context.content, /main\.py/, 'entry point is visible to the model');
  const conceptual = await snapshot('E o que significa encapsulamento?', 'E o que significa encapsulamento?');
  assert.ok(conceptual, 'conceptual question can use a workspace without an open editor');
  assert.equal(conceptual.file, '(raiz)');
  assert.match(conceptual.content, /Dúvida conceitual/, 'conceptual questions are explicitly marked and do not require a file list');
  assert.doesNotMatch(conceptual.content, /Árvore de caminhos|main\.py|pyproject\.toml/, 'conceptual questions do not receive an unrelated project tree');
  assert.doesNotMatch(conceptual.content, /Amostras seguras de documentação/, 'conceptual questions skip verbose documentation retrieval');
  console.log('Sai-nii integration: activation, root architecture and conceptual context OK');
}
module.exports = { run };
