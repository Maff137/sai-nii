'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { technicalReview, rubricFor } = require('./technical-review.cjs');
const { scenarios } = require('./scenarios.cjs');
const { evaluateScenario, summarizeReport } = require('./harness.cjs');
const { parseOptions } = require('./run.cjs');

function turn(id, number=0) {
  return scenarios.find(s => s.id === id).turns[number];
}

test('real misleading response about parallelism is sent to human review, not marked false by fiat', () => {
  const answer = '5. **Paralelismo**: Em ambientes de computação paralela, os módulos podem ser executados simultaneamente.';
  assert.deepEqual(technicalReview(answer, turn('pt-modulos-informal')), ['parallelism_needs_context']);
  // A correct statement can contain the same keyword, and still be reviewed.
  const correct = 'Separar módulos NÃO garante paralelismo; executar tarefas em paralelo requer mecanismos adicionais.';
  assert.deepEqual(technicalReview(correct, turn('pt-modulos-informal')), ['parallelism_needs_context']);
});

test('simple modularization explanation without risky claim gets no technical alert', () => {
  assert.deepEqual(technicalReview('Módulos ajudam a separar responsabilidades e simplificar manutenção.', turn('pt-modulos-informal')), []);
});

test('negative premise must be challenged explicitly or flagged for human verification', () => {
  const t = turn('pt-modulos-premissa');
  const misleading = 'Sim! Separar os arquivos automaticamente torna o programa mais rápido.';
  assert.deepEqual(technicalReview(misleading, t), ['premise_challenge_not_observed']);
  const correct = 'Não. Dividir módulos não inicia execução paralela por si só.';
  assert.deepEqual(technicalReview(correct, t), ['parallelism_needs_context']);
});

test('git commit vs push false premise has a distinct review checklist', () => {
  const t = turn('pt-commit-premissa');
  assert.ok(technicalReview('Sim, o commit já disponibiliza tudo na internet.', t).includes('premise_challenge_not_observed'));
  const alerts = technicalReview('Não. git commit é local; você precisa de git push para enviar para o GitHub.', t);
  assert.deepEqual(alerts, ['remote_claim_needs_context']);
  assert.match(rubricFor(t).join(' '), /git push/);
});

test('technical review never reads arbitrary turns without scenario-defined checklist', () => {
  assert.deepEqual(technicalReview('Qualquer afirmação técnica.', {signals: []}), []);
  assert.deepEqual(rubricFor({signals: []}), []);
});

test('rubric is available to the operator, not sent to the local model', async () => {
  const fixture = {id:'test',label:'premise',language:'pt',turns:[turn('pt-modulos-premissa')]};
  let received;
  const res = await evaluateScenario(fixture, async messages => {
    received = messages;
    return 'Sim, claro. Isso automaticamente deixa tudo mais rápido.';
  }, {includeRubric:true});
  assert.equal(res.turns[0].origin, 'model');
  assert.ok(res.turns[0].technical_review_flags.includes('premise_challenge_not_observed'));
  assert.ok(res.turns[0].human_review_rubric.length >= 1);
  assert.equal(res.turns[0].answer, undefined);
  assert.ok(!JSON.stringify(received).includes('paralelismo requer mecanismos'));
  assert.equal(summarizeReport([res]).turns_for_technical_review,1);
});

test('default report never contains the answer or rubric; explicit flags work independently', async () => {
  const t=turn('pt-modulos-premissa');
  const res=await evaluateScenario({id:'privacy',label:'privacy',language:'pt',turns:[t]},async()=> 'Sim, fica automaticamente mais rápido.');
  const output=JSON.stringify(res);
  assert.equal(res.turns[0].answer, undefined);
  assert.equal(res.turns[0].human_review_rubric, undefined);
  assert.ok(!output.includes('Sim, fica automaticamente'));
  assert.ok(!output.includes('Deve rejeitar'));
});

test('new CLI case and opt-in human review criteria are available', () => {
  assert.equal(parseOptions(['--case','pt-modulos-premissa']).selected.length,1);
  assert.equal(parseOptions(['--case','en-modules-premise']).selected[0].experimental,true);
  const opts = parseOptions(['--show-rubric']);
  assert.equal(opts.includeRubric,true);
  assert.equal(opts.includeAnswers,false);
  assert.equal(parseOptions(['--limit','9']).selected.length,9);
  assert.equal(parseOptions(['--case','pt-js-workers-premissa']).selected[0].turns.length,2);
  assert.equal(parseOptions(['--case','pt-sincronizacao-premissa']).selected[0].turns.length,1);
});


test('JavaScript single-thread premise has reviewer criteria for workers and async/await', async () => {
  const caseData = scenarios.find(s => s.id === 'pt-js-workers-premissa');
  assert.equal(caseData.turns.length, 2);
  const falsePremise = 'Sim, JavaScript nunca consegue executar código em paralelo. Nem workers ajudam.';
  const flags = technicalReview(falsePremise, caseData.turns[0]);
  assert.ok(flags.includes('premise_challenge_not_observed'));
  assert.ok(flags.includes('js_execution_needs_context'));
  assert.match(rubricFor(caseData.turns[0]).join(' '), /Web Workers/);
  const followup = rubricFor(caseData.turns[1]).join(' ');
  assert.match(followup, /async\/await/);
  assert.match(followup, /n[uú]cleos|núcleos/);
});

test('review-only JS signals also flag correct answers, never claim machine-checked truth', () => {
  const t = turn('pt-js-workers-premissa');
  const correct = 'Não. No navegador, Web Workers podem executar JavaScript em threads diferentes; a thread principal não é o ambiente inteiro.';
  assert.deepEqual(technicalReview(correct, t), ['js_execution_needs_context']);
});

test('independent tasks scenario challenges mandatory synchronization', () => {
  const t = turn('pt-sincronizacao-premissa');
  assert.ok(technicalReview('Sim, um mutex é sempre necessário para qualquer paralelismo.', t).includes('premise_challenge_not_observed'));
  const accurate = 'Não. Tarefas independentes podem rodar em paralelo sem mutex; ele importa ao coordenar estado compartilhado.';
  assert.deepEqual(technicalReview(accurate, t), ['synchronization_needs_context']);
  assert.match(rubricFor(t).join(' '), /Tarefas independentes/);
});

test('two-turn misconception dialogue is evaluated with real conversation history and privacy', async () => {
  const scenario = scenarios.find(s => s.id === 'pt-js-workers-premissa');
  let count = 0;
  const report = await evaluateScenario(scenario, async messages => {
    count++;
    if (count === 2) assert.ok(messages.some(m => m.role === 'assistant'), 'must preserve first answer to interpret follow-up');
    return count === 1
      ? 'Não. No navegador, Web Workers podem executar JavaScript em threads adicionais, dependendo do ambiente.'
      : 'Não necessariamente. async/await permite aguardar operações sem bloquear o fluxo; isso não cria por si só execução em múltiplos núcleos.';
  });
  assert.equal(count,2);
  assert.equal(report.turns.length,2);
  assert.ok(report.turns.every(turn => turn.origin === 'model'));
  assert.ok(report.turns.every(turn => turn.answer === undefined));
  assert.equal(summarizeReport([report]).turns_for_technical_review,2);
});
