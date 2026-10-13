const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseGuidance, releaseAllowed, guidanceText } = require('../dist/pedagogy.js');

test('keeps one targeted question without code', () => {
  assert.deepEqual(parseGuidance('{"observation":"O fluxo pode estar invertido.","question":"Qual condição você verifica antes de salvar?"}'),
    { observation: 'O fluxo pode estar invertido.', question: 'Qual condição você verifica antes de salvar?' });
});
test('rejects non-json, code and repeated questions', () => {
  assert.match(guidanceText(parseGuidance('def solve(): return 1')), /Qual comportamento/);
  assert.match(guidanceText(parseGuidance('{"observation":"Use const x = 3","question":"Por quê?"}')), /Qual comportamento/);
  assert.match(guidanceText(parseGuidance('{"observation":"Veja.","question":"Qual? Por quê?"}')), /Qual comportamento/);
});
test('cannot reveal a solution without explicit request AND substantive attempted reasoning AND blocker', () => {
  const good = { explicit: true,
    attempt: 'Tentei validar o estoque antes da gravação do pedido, mas a função ainda grava o registro parcialmente.',
    blocker: 'Não consegui descobrir onde colocar a transação porque minhas verificações acontecem após o primeiro insert.' };
  assert.equal(releaseAllowed(good), true);
  assert.equal(releaseAllowed({ ...good, explicit: false }), false);
  assert.equal(releaseAllowed({ ...good, attempt: 'tentei' }), false);
  assert.equal(releaseAllowed({ ...good, blocker: 'não sei' }), false);
});
