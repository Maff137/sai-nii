const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveGuidance, rescueGuidance } = require('../dist/recovery.js');
const { planGuidance, guidanceText } = require('../dist/pedagogy.js');

const source = [
  'Projeto: clickpocalypse2',
  'Arquivo: c2c.user.js | Linguagem: javascript',
  'Trecho prioritário do editor:',
  '22: setInterval(function () {',
  '23:   doSomething();',
  '24: }, 1000);'
].join('\n');
const messages = [{ role: 'system', content: 'Tutor Socrático.' }, { role: 'user', content: 'Quero entender setInterval.' }];

test('first request never shows the misleading repeated-question error on malformed model output', async () => {
  let calls = 0;
  const outcome = await resolveGuidance({
    messages, generate: async () => { calls++; return 'texto sem estrutura'; },
    plan: planGuidance('Quero entender setInterval neste código.'), sourceContext: source,
    learnerText: 'Quero entender setInterval neste código.', topicContext: ''
  });
  assert.equal(calls, 2);
  assert.equal(outcome.recovered, true);
  assert.match(guidanceText(outcome.guide), /setInterval/);
  assert.match(outcome.guide.question, /\?$/);
  assert.doesNotMatch(guidanceText(outcome.guide), /1000|solu[cç][aã]o/);
});

test('real stuck-turn regression: repeated outputs become new concrete instruction without revealing the interval', async () => {
  const previous = { question: 'O que você identifica dentro dos parênteses dessa chamada?',
    observation: 'Vamos olhar a estrutura da chamada setInterval no arquivo.', helpLevel: 0 };
  let calls = 0;
  const outcome = await resolveGuidance({
    messages, generate: async () => { calls++; return JSON.stringify({
      observation: 'setInterval executa código repetidamente.', hint:'setInterval executa código repetidamente.',
      question: previous.question }); },
    plan: planGuidance('Ainda não sei onde o intervalo é definido. Pode me ajudar?', previous),
    previous, sourceContext: source,
    learnerText: 'Ainda não sei onde o intervalo é definido. Pode me ajudar?',
    topicContext:'Quero entender setInterval neste código.'
  });
  const rendered = guidanceText(outcome.guide, true);
  assert.equal(calls, 2);
  assert.equal(outcome.recovered, true);
  assert.notEqual(outcome.guide.question, previous.question);
  assert.match(rendered, /argumento|fun[cç][aã]o|v[ií]rgula/i);
  assert.doesNotMatch(rendered, /1000|um segundo|1 segundo/);
});

test('a valid, nonrepeated model hint is preferred over the deterministic rescue', async () => {
  let calls = 0;
  const previous = { question:'O que faz o setInterval?', observation:'Repete uma operação.', helpLevel:0 };
  const guide = { observation: 'Vamos olhar os argumentos.', hint: 'Procure os dois argumentos de setInterval.',
    question: 'O que você encontra depois da primeira vírgula?' };
  const outcome = await resolveGuidance({
    messages, generate: async () => { calls++; return JSON.stringify(guide); },
    plan:planGuidance('Não sei por onde começar', previous), previous,
    sourceContext: source, learnerText:'Não sei', topicContext:'setInterval'
  });
  assert.equal(calls, 1);
  assert.equal(outcome.recovered, false);
  assert.deepEqual(outcome.guide, guide);
});

test('no arbitrary executable statements or code values are copied from the source in rescue', () => {
  const rich = '42: const privateToken = "ABC_PRIVATE_SECRET";\n43: fetch("https://evil.example");';
  const guide = rescueGuidance(rich, 'Explique privateToken', planGuidance('Explique privateToken'));
  assert.doesNotMatch(JSON.stringify(guide), /ABC_PRIVATE_SECRET|evil\.example|42:/);
  assert.match(guide.question, /\?$/);
});

test('second blocked turn progresses beyond the first deterministic hint', () => {
  const prev = {question: 'Qual trecho fica depois da função, ainda dentro da chamada?',
    observation: 'Localize a separação entre a função e a espera.', helpLevel: 1};
  const guide = rescueGuidance(source, 'setInterval', planGuidance('Ainda não entendi', prev), prev);
  assert.match(guide.hint, /segundo argumento/i);
  assert.notEqual(guide.question, prev.question);
});

test('retry that fixes a malformed model response does not trigger fallback', async () => {
  let calls = 0;
  const outcome = await resolveGuidance({
    messages, generate: async () => ++calls === 1 ? 'malformed' :
      JSON.stringify({ observation:'A chamada recebe argumentos.', question:'Qual argumento vem primeiro?' }),
    plan:planGuidance('Quero entender setInterval'), sourceContext:source,
    learnerText:'Quero entender setInterval', topicContext:''
  });
  assert.equal(outcome.recovered, false);
  assert.equal(calls, 2);
});


test('two successive model failures produce two different useful turns, preserving progress', async () => {
  const generate = async () => 'not JSON';
  const firstPlan = planGuidance('Quero entender setInterval neste código.');
  const first = await resolveGuidance({messages, generate, plan:firstPlan,
    sourceContext:source, learnerText:'Quero entender setInterval neste código.', topicContext:''});
  const previous = { question:first.guide.question, observation:first.guide.observation, helpLevel:firstPlan.helpLevel };
  const secondPlan = planGuidance('Ainda não sei onde o intervalo é definido.', previous);
  const second = await resolveGuidance({messages, generate, plan:secondPlan, previous,
    sourceContext:source, learnerText:'Ainda não sei onde o intervalo é definido.', topicContext:'Quero entender setInterval'});
  assert.notEqual(first.guide.question, second.guide.question);
  assert.equal(second.recovered, true);
  assert.match(guidanceText(second.guide, true), /argumento|fun[cç][aã]o/i);
  assert.doesNotMatch(guidanceText(second.guide, true), /1000/);
});

test('records whether model, retry or fallback produced the guidance', async () => {
  const valid = JSON.stringify({ observation:'Boa observação, a chamada agenda uma operação.', hint:'', question:'' });
  const inputs = { messages, plan:planGuidance('O que é setInterval?'), sourceContext:source,
    learnerText:'O que é setInterval?', topicContext:'' };
  const direct = await resolveGuidance({...inputs, generate:async () => valid});
  assert.equal(direct.origin,'model');
  assert.equal(direct.guide.question,'');
  let tries=0;
  const retried = await resolveGuidance({...inputs, generate:async () => ++tries===1 ? 'invalid' : valid});
  assert.equal(retried.origin,'retry');
  const fallback = await resolveGuidance({...inputs, generate:async () => 'invalid'});
  assert.equal(fallback.origin,'fallback');
});


test('architecture rescue admits uncertainty instead of pretending it knows the design', () => {
  const { rescueGuidance } = require('../dist/recovery');
  const result = rescueGuidance('Estrutura observada: src/main.py', 'Explique a arquitetura do projeto',
    { needsHelp: false, helpLevel: 0, instruction: '' });
  assert.match(result.observation, /não vou inventar responsabilidades/i);
  assert.doesNotMatch(result.observation, /MVC|Clean Architecture|Microserviços/);
});


test('normalizes extra questions within safe JSON to the first meaningful question', async () => {
  const first = JSON.stringify({observation:'A função recebe uma lista e um desconto.',hint:'',question:'Qual linha soma a lista? E onde o desconto é aplicado? Pode indicar ambas?' });
  const result=await resolveGuidance({messages, generate: async()=>first,
    plan:planGuidance('Quero entender o código'), sourceContext:source,
    learnerText:'Quero entender o código',topicContext:'',language:'pt'});
  assert.equal(result.origin,'model');
  assert.equal(result.questionNarrowed,true);
  assert.equal(result.guide.question,'Qual linha soma a lista?');
  assert.equal(result.guide.question.match(/\?/g).length,1);
});

test('question normalization does not weaken code or hint safeguards', async () => {
  const unsafe=JSON.stringify({observation:'```python\nprint(123)\n```',hint:'',question:'Por onde começar? E depois?' });
  let calls=0;
  const result=await resolveGuidance({messages,generate: async()=>{calls++;return unsafe;},
    plan:planGuidance('Quero entender este arquivo'),sourceContext:source,
    learnerText:'Quero entender este arquivo',topicContext:'',language:'pt'});
  assert.equal(calls,2);
  assert.equal(result.origin,'fallback');
  assert.doesNotMatch(JSON.stringify(result.guide),/print\(123\)/);
});

test('Portuguese model guidance is retried when the learner requests English', async () => {
  const wrong=JSON.stringify({observation:'Verifique a linha onde a resposta chega ao código.',hint:'Observe onde a variável guarda a resposta.',question:'Qual parte do código verifica essa resposta?' });
  const corrected=JSON.stringify({observation:'Look at the response before parsing its body.',hint:'Inspect the response status before calling json.',question:'What does this response expose?' });
  let calls=0;
  const result=await resolveGuidance({messages,generate:async ()=>++calls===1?wrong:corrected,
    plan:planGuidance('I am stuck; give me a hint.',undefined,'en'),
    sourceContext:source,learnerText:'I am stuck; give me a hint.',topicContext:'',language:'en'});
  assert.equal(calls,2);
  assert.equal(result.origin,'retry');
  assert.equal(result.rejections[0].reason,'idioma da resposta não corresponde ao pedido');
  assert.match(result.guide.hint,/Inspect/);
});

test('conservative language detection does not reject undecidable technical fragments',async()=>{
  const raw=JSON.stringify({observation:'Inspect `resposta` and `depositar`.',hint:'',question:''});
  const result=await resolveGuidance({messages,generate:async()=>raw,
    plan:planGuidance('What is the role of this identifier?',undefined,'en'),sourceContext:source,
    learnerText:'What is the role of this identifier?',topicContext:'',language:'en'});
  assert.equal(result.origin,'model');
});


test('on a blocked turn, a new hint survives a repeated question without a fallback', async () => {
  const previous={question:'O que acontece se desconto for maior que zero?', observation:'A função recebe preços e desconto.',helpLevel:0};
  const response=JSON.stringify({observation:'Veja os ramos desta função.',hint:'Localize a expressão do retorno e observe em qual ramo ela se encontra.',question:previous.question});
  let calls=0;
  const outcome=await resolveGuidance({messages,generate:async()=>{calls++;return response;},
    plan:planGuidance('Ainda não entendi',previous),previous,sourceContext:source,
    learnerText:'Ainda não entendi',topicContext:'calcular_total',language:'pt'});
  assert.equal(calls,1);
  assert.equal(outcome.origin,'model');
  assert.equal(outcome.questionNarrowed,true);
  assert.equal(outcome.guide.question,'');
  assert.match(guidanceText(outcome.guide,true),/expressão do retorno/);
});

test('repeated question without a new valid hint is still rejected', async () => {
  const previous={question:'Qual condição executa este bloco?',observation:'Concentre-se na condição do bloco.',helpLevel:0};
  const response=JSON.stringify({observation:'Verifique a condição.',hint:'Concentre-se na condição do bloco.',question:previous.question});
  const outcome=await resolveGuidance({messages,generate:async()=>response,
    plan:planGuidance('Não entendi',previous),previous,sourceContext:source,
    learnerText:'Não entendi',topicContext:'',language:'pt'});
  assert.equal(outcome.origin,'fallback');
});
