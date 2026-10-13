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


test('benchmarks exercise real Portuguese-to-English-to-Portuguese turns without persisting dialogue',async()=>{
  const scenario = scenarios.find(s=>s.id==='pt-en-switch');
  const expected=['pt','en','pt'];let calls=0;
  const report=await evaluateScenario(scenario,async messages=>{
    const lang=expected[calls++];
    assert.match(messages[0].content,lang==='pt'?/IDIOMA DESTA RESPOSTA: português/:/RESPONSE LANGUAGE FOR THIS TURN: English/);
    if(calls>1) assert.ok(messages.some(m=>m.role==='assistant'));
    return lang==='en'?'Encapsulation controls access to an object’s internal state.':'Encapsulamento controla o acesso ao estado interno; abstração destaca apenas o essencial.';
  });
  assert.deepEqual(report.turns.map(t=>t.requested_language),expected);
  assert.ok(report.turns.every(t=>t.answer===undefined));
});

test('English first, then Portuguese: programming identifiers do not force response language',async()=>{
 const scenario=scenarios.find(s=>s.id==='en-pt-switch');let calls=0;
 const report=await evaluateScenario(scenario,async messages=>{
  calls++;return calls===1?'async/await lets you await promises without blocking the event loop.':'async/await organiza a espera de operações assíncronas sem criar paralelismo de CPU.';
 });
 assert.deepEqual(report.turns.map(t=>t.requested_language),['en','pt']);
});


test('rejected model text is never exposed unless explicitly opted in for synthetic benchmark', async () => {
  const scenario = { id: 'synthetic', language: 'en', label: 'fenced', turns: [{prompt:'Can you explain encapsulation with a small example?', signals:[]}] };
  let calls=0;
  const generate=async()=>++calls===1?'```javascript\nconst balance = 0;\n```':'Encapsulation provides controlled access to state through defined operations.';
  const silent=await evaluateScenario(scenario,generate);
  assert.equal(silent.turns[0].origin,'retry');
  assert.deepEqual(silent.turns[0].rejected,[{attempt:1,reason:'code'}]);
  assert.equal(silent.turns[0].rejected_answers,undefined);
  calls=0;
  const visible=await evaluateScenario(scenario,generate,{includeRejected:true});
  assert.equal(visible.turns[0].rejected_answers.length,1);
  assert.match(visible.turns[0].rejected_answers[0].text,/const balance/);
  assert.equal(visible.turns[0].answer,undefined);
  assert.equal(parseOptions(['--show-rejected']).includeRejected,true);
  assert.equal(parseOptions([]).includeRejected,false);
});


test('synthetic English teaching example is accepted on first attempt without printing source by default',async()=>{
 const scenario={id:'synthetic-example',language:'en',label:'education',turns:[{prompt:'Could you explain encapsulation with a simple example?',signals:[/encapsul/i]}]};
 let calls=0;
 const explanation='Encapsulation keeps internal state behind a small set of public operations.\n\n```javascript\nclass Account {\n  deposit(amount) { this.balance += amount; }\n}\n```\n\nThe method is where you can check a valid amount before changing the internal balance.';
 const result=await evaluateScenario(scenario,async()=>{calls++;return explanation;});
 assert.equal(calls,1);assert.equal(result.turns[0].origin,'model');assert.deepEqual(result.turns[0].rejected,[]);
 assert.equal(result.turns[0].answer,undefined);
});


test('real harness retains the previous teaching example when student changes explanation language',async()=>{
 const synthetic={id:'bilingual-same-example',language:'pt',label:'followup',turns:[
  {prompt:'Explique encapsulamento usando a ContaBancaria.',signals:[]},
  {prompt:'Now explain that in English using the same example.',signals:[]}
 ]};
 const lengthy='Encapsulamento limita acesso a dados por métodos públicos. '.repeat(32) +
  '\n```python\nclass ContaBancaria:\n    def depositar(self, valor):\n        self.saldo += valor\n```';
 let step=0;
 const report=await evaluateScenario(synthetic,async messages=>{
  step++;
  if(step===2){
   assert.match(messages[0].content,/English/);
   assert.ok(messages.some(m=>m.role==='assistant'&&m.content.includes('ContaBancaria')));
   assert.match(messages.at(-1).content,/SAME programming example/);
  }
  return step===1?lengthy:'Encapsulation controls access to the state in a bank account through its public deposit operation.';
 });
 assert.equal(report.turns[1].origin,'model');assert.equal(step,2);
});
