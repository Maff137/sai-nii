const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseGuidance, releaseAllowed, guidanceText, needsMoreHelp, planGuidance, repeatsQuestion, repeatsExplanation } = require('../dist/pedagogy.js');

test('keeps one targeted question without code', () => {
  assert.deepEqual(parseGuidance('{"observation":"O fluxo pode estar invertido.","question":"Qual condição você verifica antes de salvar?"}'),
    { observation: 'O fluxo pode estar invertido.', question: 'Qual condição você verifica antes de salvar?' });
});
test('rejects non-json, code and repeated questions', () => {
  assert.equal(parseGuidance('def solve(): return 1'), null);
  assert.equal(parseGuidance('{"observation":"Use const x = 3","question":"Por quê?"}'), null);
  assert.equal(parseGuidance('{"observation":"Veja.","question":"Qual? Por quê?"}'), null);
});
test('accepts harmless fenced JSON without displaying raw model output', () => {
  assert.deepEqual(parseGuidance('```json\n{"observation":"O arquivo usa setInterval.","question":"Qual tarefa o setInterval repete?"}\n```'),
    { observation: 'O arquivo usa setInterval.', question: 'Qual tarefa o setInterval repete?' });
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

test('recognizes difficulty without requiring pedagogical magic words', () => {
  assert.equal(needsMoreHelp('Não sei identificar onde o intervalo é definido. Pode me ajudar a encontrar isso no código?'), true);
  assert.equal(needsMoreHelp('Não entendi, pode explicar?'), true);
  assert.equal(needsMoreHelp('Quero entender o papel de setInterval'), false);
});

test('progresses to a more concrete hint on successive blocked turns', () => {
  const prior = { question: 'Qual é o intervalo definido para setInterval neste código?', observation: 'setInterval repete uma ação periodicamente.', helpLevel: 0 };
  const first = planGuidance('Não sei identificar onde o intervalo é definido.', prior);
  assert.equal(first.helpLevel, 1);
  assert.match(first.instruction, /NÃO|Não|n[aã]o/i);
  const second = planGuidance('Ainda não consigo encontrar isso', { ...prior, helpLevel: first.helpLevel });
  assert.equal(second.helpLevel, 2);
  const third = planGuidance('Estou travado de novo', { ...prior, helpLevel: second.helpLevel });
  assert.equal(third.helpLevel, 3);
  assert.equal(planGuidance('Não sei', { ...prior, helpLevel: 3 }).helpLevel, 3);
});

test('detects repeated or paraphrased questions without blocking a genuine new step', () => {
  const prior = 'Qual é o intervalo de tempo definido para a função setInterval neste código?';
  assert.equal(repeatsQuestion(prior, prior), true);
  assert.equal(repeatsQuestion(prior, 'Qual intervalo de tempo está definido no setInterval?'), true);
  assert.equal(repeatsQuestion(prior, 'Na chamada de setInterval, onde você procuraria os argumentos?'), false);
  assert.equal(repeatsQuestion(undefined, prior), false);
});

test('requires a genuine hint when learner reports being stuck', () => {
  const raw = JSON.stringify({ observation:'O setInterval é uma função que executa um bloco em intervalos regulares.', question:'Onde está a chamada de setInterval?' });
  assert.equal(parseGuidance(raw, true), null);
  const good = parseGuidance(JSON.stringify({observation:'Descrição curta.', hint:'Observe os argumentos da chamada de setInterval depois do corpo da função.', question:'Qual argumento aparece depois da função?'}), true);
  assert.ok(good);
  assert.equal(guidanceText(good, true), 'Observe os argumentos da chamada de setInterval depois do corpo da função.\n\nQual argumento aparece depois da função?');
});

test('blocks repetition of the previous explanation, not just the previous question', () => {
  const explanation = 'O setInterval é uma função que executa um bloco de código em intervalos regulares de tempo.';
  assert.equal(repeatsExplanation(explanation, 'setInterval é uma função que executa um bloco de código em intervalos regulares.'), true);
  assert.equal(repeatsExplanation(explanation, 'Observe os argumentos separados por vírgula depois da função callback.'), false);
});

test('a short explanation or confirmation does not require a question', () => {
  const { GUIDANCE_SYSTEM, planGuidance } = require('../dist/pedagogy.js');
  assert.deepEqual(parseGuidance(JSON.stringify({ observation: 'Correto: a função é chamada após a condição.', hint:'', question:'' })),
    { observation: 'Correto: a função é chamada após a condição.', question: '' });
  assert.equal(guidanceText({observation:'Sua hipótese está correta.', question:''}), 'Sua hipótese está correta.');
  assert.match(GUIDANCE_SYSTEM, /Perguntas socráticas são um RECURSO/);
  assert.match(planGuidance('O que significa callback?').instruction, /NÃO são obrigatórias/);
});


test('architecture explanations can be longer without enabling unrestricted code generation', () => {
  const { parseGuidance } = require('../dist/pedagogy');
  const content = 'As pastas observadas separam responsabilidades. '.repeat(20);
  const data = JSON.stringify({ observation: content, hint: '', question: '' });
  const shortened = parseGuidance(data, false).observation;
  assert.ok(shortened.length <= 230);
  assert.match(shortened, /\.$/);
  assert.doesNotMatch(shortened, /\bAs pastas observadas separam responsabilida$/);
  assert.equal(parseGuidance(data, false, 1500).observation, content.trim());
  assert.equal(parseGuidance(JSON.stringify({observation:'function hack() {}',question:'',hint:''}), false, 1500), null);
});


test('never shows a partially cut word or claim as a finished explanation', () => {
  const { parseGuidance } = require('../dist/pedagogy.js');
  const raw = JSON.stringify({ observation: 'A função recebe preços e desconto. Ela soma os preços e aplica o desconto positivo. O resultado é retornado, garantindo que o o valor final permanece válido para o caso.', question: 'Qual condição aplica o desconto?' });
  const guide = parseGuidance(raw, false, 125);
  assert.ok(guide);
  assert.equal(guide.observation, 'A função recebe preços e desconto. Ela soma os preços e aplica o desconto positivo.');
  assert.doesNotMatch(guide.observation, /garantindo que o o/);
});

test('rejects a long explanation without a complete sentence instead of cutting mid-word', () => {
  const raw=JSON.stringify({observation:'Uma explicação longa sem pontuação que se prolonga ' .repeat(10),question:'Qual condição aparece?'});
  assert.equal(parseGuidance(raw, false, 100), null);
});

test('rejects executable code hidden beyond the length budget of an observation', () => {
  const raw=JSON.stringify({observation:'Este código trabalha com valores e entradas. '.repeat(10)+'\n```python\nprint(999)\n```',question:'Qual condição aparece?'});
  assert.equal(parseGuidance(raw,false,150),null);
});

test('retains a complete new hint when a long observation must be shortened', () => {
  const raw=JSON.stringify({observation:'Primeira frase terminada. Segunda frase que ultrapassa o orçamento da explicação em diversos caracteres.',hint:'Procure a comparação na condição antes da alteração do estado.',question:'Onde aparece a comparação?'});
  const guide=parseGuidance(raw,true,50);
  assert.ok(guide);
  assert.equal(guide.observation,'Primeira frase terminada.');
  assert.match(guide.hint,/condição/);
});
