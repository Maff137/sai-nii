'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateScenario, summarizeReport, indicators } = require('./harness.cjs');
const { parseOptions } = require('./run.cjs');
const { scenarios } = require('./scenarios.cjs');

test('benchmark uses real discussion validation and tracks dialogue turns', async () => {
  let count = 0;
  const result = await evaluateScenario(scenarios[0], async messages => {
    count++;
    assert.equal(messages[0].role, 'system');
    if (count === 2) assert.ok(messages.some(m => m.role === 'assistant'), 'follow-up receives previous assistant answer');
    return count === 1
      ? 'Encapsulamento controla o acesso ao estado interno de um objeto para evitar alterações arbitrárias.'
      : 'Abstração destaca o essencial; encapsulamento limita o acesso ao estado interno.';
  });
  assert.equal(result.turns.length, 2);
  assert.equal(count, 2);
  assert.equal(result.turns[0].origin, 'model');
  assert.equal(result.turns[1].origin, 'model');
  assert.equal(result.turns[0].answer, undefined, 'raw responses not included by default');
  assert.equal(summarizeReport([result]).model_first_attempt, 2);
});

test('rejects copied questions and tracks retries without storing answers', async () => {
  let count = 0;
  const scenario = { id: 'synthetic', language: 'pt', label: 'echo', turns: [{prompt:'oq um git commit faz?', signals:[/commit/i]}] };
  const result = await evaluateScenario(scenario, async () => ++count === 1
    ? 'oq um git commit faz?'
    : 'Um commit registra um conjunto de mudanças no histórico do repositório.');
  assert.equal(result.turns[0].origin, 'retry');
  assert.deepEqual(result.turns[0].rejected, [{attempt:1,reason:'echo_question'}]);
  assert.equal(result.turns[0].answer, undefined);
});

test('flags unverified relevance signals rather than asserting the answer is false', () => {
  const result = indicators('Uma resposta longa sem os termos de referência.', {signals:[/encapsul/i]}, 'pt');
  assert.equal(result.review_recommended, true);
  assert.equal(result.signal_groups_matched, 0);
});

test('local generator options default to loopback and reject invalid ports/cases', () => {
  const opts = parseOptions([]);
  assert.equal(opts.port, 8080);
  assert.equal(opts.model, 'local');
  assert.equal(opts.selected.length, 3);
  assert.throws(() => parseOptions(['--port','0']), /porta/);
  assert.throws(() => parseOptions(['--port','abc']), /porta/);
  assert.throws(() => parseOptions(['--case','unknown']), /Caso inexistente/);
  assert.equal(parseOptions(['--case','en-encapsulation']).selected[0].experimental, true);
});

test('synthetic suite has English and Portuguese multi-turn scenarios', () => {
  assert.ok(scenarios.some(s => s.language === 'pt' && s.turns.length > 1));
  assert.ok(scenarios.some(s => s.language === 'en' && s.experimental));
  assert.ok(scenarios.every(s => s.turns.every(t => t.prompt && Array.isArray(t.signals))));
});


test('a real Portuguese answer mentioning módulos is not a false relevance gap', () => {
  const turn = scenarios.find(s => s.id === 'pt-modulos-informal').turns[0];
  const text = 'Dividir um programa em módulos ajuda a organizar responsabilidades e tornar a manutenção mais simples.';
  const result = indicators(text, turn, 'pt');
  assert.equal(result.signal_groups_matched, 1);
  assert.equal(result.review_recommended, false);
});

test('relevance indicators remain conservative about missing concepts', () => {
  const turn = scenarios.find(s => s.id === 'pt-modulos-informal').turns[0];
  assert.equal(indicators('A revisão é importante por outros motivos.', turn, 'pt').signal_groups_matched, 0);
});
