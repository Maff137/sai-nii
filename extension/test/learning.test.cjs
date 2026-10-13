const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inferConcept, learningKind, summarize, summarizeForUser, summarizeForModel } = require('../dist/learning.js');

test('classifies only broad concepts, never saves sensitive identifiers', () => {
  assert.equal(inferConcept('Onde está o intervalo de setInterval?'), 'temporizadores');
  assert.equal(inferConcept('Como funciona await aqui?'), 'assincronismo');
  assert.equal(inferConcept('O que é 23jxnMySecret?'), 'leitura de código');
  assert.equal(learningKind('Estou travado', false, true), 'difficulty');
  assert.equal(learningKind('Quero explicação', false, false), 'question');
});

test('summaries report observed events, never grades or proficiency claims', () => {
  const events = [
    {concept:'temporizadores',kind:'question',origin:'model'},
    {concept:'temporizadores',kind:'difficulty',origin:'fallback'},
    {concept:'funções',kind:'solution',origin:'solution'}
  ];
  assert.equal(summarize(events).difficulties, 1);
  assert.match(summarizeForModel(events), /sem inferir domínio/i);
  assert.match(summarizeForUser(events), /Recuperações automáticas: 1/);
  assert.doesNotMatch(summarizeForUser(events), /nota 10|domina o assunto/i);
});
