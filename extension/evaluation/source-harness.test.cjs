'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSourceScenario, syntheticContext } = require('./source-harness.cjs');
const { sourceScenarios } = require('./source-scenarios.cjs');
const { scenarios } = require('./scenarios.cjs');
const { parseOptions } = require('./run.cjs');
const { summarizeReport } = require('./harness.cjs');

const valid = (observation, hint = '', question = '') => JSON.stringify({observation,hint,question});

test('five entirely synthetic source cases cover Python JavaScript Go Rust and Java without real repositories', () => {
  assert.deepEqual(sourceScenarios.map(x => x.fixture.language), ['python','javascript','go','rust','java']);
  assert.equal(new Set(sourceScenarios.map(x => x.id)).size,5);
  for (const s of sourceScenarios) {
    assert.equal(s.activeEditor,true);
    assert.equal(s.mode,'source');
    assert.ok(s.turns.length>=2);
    assert.ok(s.fixture.code.length>40);
    assert.ok(!s.fixture.code.includes('/Users/'));
    assert.ok(!s.fixture.code.includes('https://'));
  }
  assert.equal(scenarios.filter(x=>x.mode==='source').length,5);
});

test('source suite and list-cases select the intended cases without using network', () => {
  assert.equal(parseOptions(['--suite','source']).selected.length,5);
  assert.ok(parseOptions(['--suite','source']).selected.every(x => x.mode === 'source'));
  assert.ok(parseOptions(['--suite','discussion']).selected.every(x=>x.mode !== 'source'));
  assert.equal(parseOptions(['--suite','source','--limit','2']).selected.length,2);
  assert.equal(parseOptions(['--case','source-rust']).selected[0].fixture.language,'rust');
  assert.equal(parseOptions(['--list-cases']).listCases,true);
  assert.throws(()=>parseOptions(['--suite','source','--case','source-python']),/OU/);
  assert.throws(()=>parseOptions(['--suite','online']),/suite/);
});

test('real guided resolver uses source evidence, JSON contract, no rubric injection or solution release', async () => {
  const s = sourceScenarios.find(s=>s.id==='source-python');
  let count=0;
  const report=await evaluateSourceScenario(s,async (messages, request)=>{
    count++;
    assert.equal(request.mode,'guidance');
    assert.equal(messages[0].role,'system');
    assert.match(messages[0].content,/SOMENTE com um objeto JSON|SOMENTE com um objeto JSON|ONLY with valid JSON/i);
    const current=messages.at(-1).content;
    assert.match(current,/contexto_nao_confiavel/);
    assert.match(current,/calcular_total/);
    assert.match(current,/1: def calcular_total/);
    assert.doesNotMatch(JSON.stringify(messages),/Não afirmar que o código valida tipos ou limites/);
    assert.ok(!('solution' in request));
    if (count === 2) {
      assert.equal(request.requireHint,true);
      assert.ok(messages.some(m => m.role==='assistant'));
    }
    if (count === 3) assert.match(current,/implemente toda a função corrigida/);
    return count===2 ? valid('Observe a condição antes da subtração.', 'O if compara desconto com zero; observe o teste sem executar nada.', '') :
      valid('Veja o bloco que soma os preços e depois avalia o desconto.', '', 'Qual condição controla a subtração?');
  },{includeRubric:true});
  assert.equal(count,3);
  assert.deepEqual(report.turns.map(t=>t.origin),['model','model','model']);
  assert.deepEqual(report.turns.map(t=>t.routing_mode),['guidance','guidance','guidance']);
  assert.deepEqual(report.turns.map(t=>t.needs_help),[false,true,false]);
  assert.ok(report.turns[1].help_level>report.turns[0].help_level);
  assert.ok(report.turns.every(t=>t.answer===undefined));
  assert.equal(summarizeReport([report]).fallbacks,0);
  assert.equal(summarizeReport([report]).guided_source_turns,3);
  assert.equal(summarizeReport([report]).progressive_hint_turns,1);
  assert.equal(summarizeReport([report]).implementation_requests_routed_to_guidance,1);
});

test('source evaluator rejects generated code masquerading as a guided observation',async()=>{
  const s={...sourceScenarios[0],turns:[sourceScenarios[0].turns[2]]};
  let calls=0;
  const report=await evaluateSourceScenario(s,async()=>{
    calls++;
    return calls===1 ? valid('```python\ndef calcular_total(x):\n    return x\n```') :
      valid('Inspecione primeiro a condição existente e verifique qual caso ela cobre.');
  });
  assert.equal(calls,2);
  assert.equal(report.turns[0].origin,'retry');
  assert.deepEqual(report.turns[0].rejected,[{attempt:1,reason:'formato inválido, conteúdo inseguro ou pista ausente'}]);
});

test('source benchmark switches spoken language on a blocked JavaScript follow-up',async()=>{
  const s=sourceScenarios.find(x=>x.id==='source-javascript');let calls=0;
  const report=await evaluateSourceScenario(s,async(messages,request)=>{
    calls++;
    if(calls===2){
      assert.match(messages[0].content,/English/);
      assert.equal(request.requireHint,true);
      return valid('You can inspect the response before parsing JSON.', 'Find the fetch result and check which HTTP status information it exposes.');
    }
    return valid('Observe a variável resposta retornada pelo fetch e a chamada json.');
  });
  assert.deepEqual(report.turns.map(t=>t.requested_language),['pt','en']);
  assert.equal(report.turns[1].origin,'model');
  assert.equal(report.turns[1].needs_help,true);
});

test('source answers and review rubrics remain opt-in; source is not in result', async()=>{
  const s={...sourceScenarios[4],turns:[sourceScenarios[4].turns[0]]};
  const f=async()=>valid('The if condition tests count before it changes the items field.');
  const result=await evaluateSourceScenario(s,f);
  assert.equal(result.turns[0].answer,undefined);
  assert.equal(result.turns[0].human_review_rubric,undefined);
  assert.doesNotMatch(JSON.stringify(result),/class Cart/);
  const verbose=await evaluateSourceScenario(s,f,{includeAnswers:true,includeRubric:true});
  assert.match(verbose.turns[0].answer,/items/);
  assert.ok(verbose.turns[0].human_review_rubric.length>0);
});

test('invalid or oversized synthetic contexts fail before contacting a model',async()=>{
  assert.throws(()=>syntheticContext({file:'a.py',code:''}),/synthetic/i);
  assert.throws(()=>syntheticContext({file:'a.py',code:'z'.repeat(4000)}),/too large/i);
  const s={...sourceScenarios[0],fixture:{file:'',code:''}};
  let called=false;
  await assert.rejects(evaluateSourceScenario(s,async()=>{called=true;return valid('test');}),/synthetic/i);
  assert.equal(called,false);
});


test('local generator sends strict JSON schema only for guided source conversations', async () => {
  const { localGenerator } = require('./run.cjs');
  const original = globalThis.fetch;
  let called = 0;
  try {
    globalThis.fetch = async (url, args) => {
      called++;
      assert.equal(url,'http://127.0.0.1:8080/v1/chat/completions');
      const body=JSON.parse(args.body);
      assert.equal(body.model,'local');
      assert.equal(body.max_tokens,380);
      assert.equal(body.response_format.type,'json_object');
      assert.deepEqual(body.response_format.schema.required,['observation','question','hint']);
      assert.equal(body.response_format.schema.properties.hint.minLength,1);
      assert.equal(body.response_format.schema.additionalProperties,false);
      return {ok:true,json:async()=>({choices:[{message:{content:valid('Observe a condição.','Leia o lado esquerdo da comparação.')},finish_reason:'stop'}]})};
    };
    const reply=await localGenerator(8080,'local')([{role:'user',content:'fictional test'}],{mode:'guidance',requireHint:true});
    assert.equal(JSON.parse(reply).hint,'Leia o lado esquerdo da comparação.');
    assert.equal(called,1);
  } finally { globalThis.fetch=original; }
});


test('rejected source-model attempts stay private unless --show-rejected is explicitly selected',async()=>{
  const s={...sourceScenarios[0],turns:[sourceScenarios[0].turns[2]]};
  let calls=0;
  const generator=async()=>++calls%2===1 ? 'not JSON: internal synthetic test' : valid('Inspecione as condições observadas no arquivo.');
  const normal=await evaluateSourceScenario(s,generator);
  assert.equal(normal.turns[0].origin,'retry');
  assert.equal(normal.turns[0].rejected_answers,undefined);
  calls=0;
  const debug=await evaluateSourceScenario(s,generator,{includeRejected:true});
  assert.equal(debug.turns[0].rejected_answers.length,1);
  assert.match(debug.turns[0].rejected_answers[0].text,/not JSON/);
  assert.equal(debug.turns[0].answer,undefined);
});


test('Java source scenario keeps guidance and recognizes stated confusion', async()=>{
  const scenario=sourceScenarios.find(s=>s.id==='source-java');
  const report=await evaluateSourceScenario(scenario,async (_messages,request)=>{
    assert.equal(request.mode,'guidance');
    return valid('Inspect the count condition before items is updated.', 'Read the branch taken when count is negative.');
  });
  assert.deepEqual(report.turns.map(t=>t.routing_mode),['guidance','guidance']);
  assert.equal(report.turns[1].needs_help,true);
  assert.equal(report.turns[1].help_level,1);
});

test('source fallback explains function definitions without mislabelling them as calls',async()=>{
  const s={...sourceScenarios[0],turns:[sourceScenarios[0].turns[0]]};
  const report=await evaluateSourceScenario(s,async()=> 'invalid output',{includeAnswers:true});
  assert.equal(report.turns[0].origin,'fallback');
  assert.match(report.turns[0].answer,/definição de `calcular_total`/);
  assert.doesNotMatch(report.turns[0].answer,/chamada de/);
  assert.equal(report.turns[0].rejected.length,2);
});

test('implementation requests receive safe recovery instead of repeated generic call prompt',async()=>{
  const s={...sourceScenarios[0],turns:[sourceScenarios[0].turns[2]]};
  const report=await evaluateSourceScenario(s,async()=> 'invalid output',{includeAnswers:true});
  assert.equal(report.turns[0].origin,'fallback');
  assert.match(report.turns[0].answer,/orientar a alteração por etapas/);
  assert.doesNotMatch(report.turns[0].answer,/```|def calcular_total/);
});


test('source concept coverage checks distinct requested mechanisms',()=>{
  const { indicators } = require('./harness.cjs');
  const rust=sourceScenarios.find(s=>s.id==='source-rust').turns[0];
  assert.equal(rust.signals.length,2);
  const onlyOption=indicators('Option can be Some or None.',rust,'en');
  assert.equal(onlyOption.signal_groups_matched,1);
  const both=indicators('Option can be Some or None. A borrowed slice reference uses &.',rust,'en');
  assert.equal(both.signal_groups_matched,2);
  const go=sourceScenarios.find(s=>s.id==='source-go').turns[0];
  assert.equal(go.signals.length,2);
  assert.equal(indicators('The if checks len(valores) == 0.',go,'en').signal_groups_matched,1);
});


test('source benchmark reports question narrowing without leaking rejected candidate',async()=>{
  const one={...sourceScenarios[0],turns:[sourceScenarios[0].turns[0]]};
  const answer=valid('A função recebe valores e desconto.','', 'Qual linha soma os preços? E como aplica o desconto?');
  const report=await evaluateSourceScenario(one, async()=>answer,{includeAnswers:true});
  assert.equal(report.turns[0].origin,'model');
  assert.equal(report.turns[0].question_narrowed,true);
  assert.equal(summarizeReport([report]).questions_narrowed,1);
  assert.match(report.turns[0].answer,/Qual linha soma os preços\?/);
  assert.doesNotMatch(report.turns[0].answer,/E como aplica/);
});

test('source benchmark rejects Portuguese hint on an English follow-up',async()=>{
  const one={...sourceScenarios[4],turns:[sourceScenarios[4].turns[0]]};
  let n=0;
  const report=await evaluateSourceScenario(one,async()=>++n===1?
    valid('Verifique a condição que compara valores do código.','','Qual parte dessa condição impede valores negativos?'):
    valid('The if condition checks a positive count before changing items.','','What happens when count is zero?'));
  assert.equal(report.turns[0].origin,'retry');
  assert.equal(report.turns[0].rejected[0].reason,'idioma da resposta não corresponde ao pedido');
});


test('source guidance benchmark does not print chopped explanations',async()=>{
  const one={...sourceScenarios[0],turns:[sourceScenarios[0].turns[0]]};
  const candidate=valid('O código recebe os dados de entrada. O código aplica uma operação. A função recebe os valores e verifica uma condição antes de seguir para o resultado. O resultado é apresentado sem necessidade de suposições adicionais e garantindo que o o texto ultrapasse o limite da explicação de propósito.', '', 'Qual entrada é usada primeiro?');
  const report=await evaluateSourceScenario(one,async()=>candidate,{includeAnswers:true});
  assert.equal(report.turns[0].origin,'model');
  assert.doesNotMatch(report.turns[0].answer,/garantindo que o o/);
  assert.match(report.turns[0].answer,/opera[cç][aã]o\./);
});
