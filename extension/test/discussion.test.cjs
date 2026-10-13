const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolveDiscussion, usefulDiscussionAnswer, nearCopy, projectStructureQuestion, discussionQuality} = require('../dist/discussion.js');
const context = [{role:'system',content:'Você é um professor.'},{role:'user',content:'Contexto de pastas; pedido atual: por que um só arquivo?'}];
const answer = 'Separar um programa em diferentes módulos facilita encontrar responsabilidades e isolar testes. Em projetos pequenos, um arquivo só pode ser mais simples; em sistemas maiores a divisão ajuda manutenção, desde que não seja exagerada.';
test('short natural conceptual follow-ups are answered without a folder-specific rule', async()=>{
  const input = {messages:context, learnerText:'e porque nao colocam todo o código em apenas um arquivo? pelo mesmo motivo?', previousAnswer:'A pasta src guarda código, docs guarda manuais.', structuralQuestion:false, observedPaths:['src/main.py','docs/index.md'], generate:async()=>answer};
  const result=await resolveDiscussion(input);
  assert.equal(result.origin,'model'); assert.equal(result.text,answer);
});
test("the user's raw question repeated as an answer never passes",()=>{
  const question='e porque nao colocam todo o código em apenas um arquivo? pelo mesmo motivo?';
  assert.equal(nearCopy('Você perguntou: '+question, question),true);
  assert.equal(usefulDiscussionAnswer(question,question),false);
});
test('retry follows learner intent without falling back to folder roles',async()=>{
  let calls=0;
  const input={messages:context,learnerText:'me explique de outra maneira por que dividir em módulos',previousAnswer:'O projeto separa docs e src para organizar pastas.',structuralQuestion:false,observedPaths:['src/main.rs','docs/readme.md'],generate:async(m)=>{calls++;if(calls===2) assert.match(m.at(-1).content,/ÚLTIMA pergunta/);return calls===1?'me explique de outra maneira por que dividir em módulos':answer;}};
  const result=await resolveDiscussion(input); assert.equal(calls,2);assert.equal(result.origin,'retry');
});
test('ordinary queries do not receive canned structural information after two failures',async()=>{
  const res=await resolveDiscussion({messages:context,learnerText:'O que significa encapsulamento?',structuralQuestion:false,observedPaths:['src/main.rs','docs/readme.md'],generate:async()=> 'O que significa encapsulamento?'});
  assert.equal(res.origin,'fallback'); assert.doesNotMatch(res.text,/docs\/|src\//); assert.match(res.text,/Não consegui/);
});
test('a structural overview can use safe observed paths if the model fails',async()=>{
  const res=await resolveDiscussion({messages:context,learnerText:'Por que as pastas deste projeto são organizadas assim?',structuralQuestion:true,observedPaths:['extension/src/main.ts','extension/test/main.test.ts','docs/README.md','extension/package.json'],generate:async()=> 'Por que as pastas deste projeto são organizadas assim?'});
  assert.equal(res.origin,'fallback');assert.match(res.text,/extension\/src\//);
});
test('transport errors are surfaced instead of disguised as trustworthy answers',async()=>{
  await assert.rejects(resolveDiscussion({messages:context,learnerText:'Explique a diferença',structuralQuestion:true,observedPaths:['src/a.py'],generate:async()=>{throw new Error('connect ECONNREFUSED')}}),/ECONNREFUSED/);
});
test('avoids near-duplicate explanations while permitting genuinely new ones',()=>{
 const q='Por que dividir o código?';const old='Separar módulos facilita encontrar funções e isolar mudanças no projeto durante a manutenção.';
 assert.equal(usefulDiscussionAnswer(old,q,old),false);
 assert.equal(usefulDiscussionAnswer(answer,q,old),true);
});

test('context selection distinguishes project-layout requests from ordinary conceptual follow-ups',()=>{
 assert.equal(projectStructureQuestion('Explique a arquitetura deste projeto'),true);
 assert.equal(projectStructureQuestion('Para que serve a pasta src?'),true);
 assert.equal(projectStructureQuestion('e porque nao colocam todo o código em apenas um arquivo? pelo mesmo motivo?'),false);
 assert.equal(projectStructureQuestion('O que significa encapsulamento?'),false);
});

test('a concise but meaningful answer is not rejected by an arbitrary 55-character threshold',async()=>{
  const sentence='Encapsulamento protege o estado interno de um objeto.';
  assert.ok(sentence.length<55);
  assert.equal(discussionQuality(sentence,'oq é encapsulamento?'),'valid');
  const result=await resolveDiscussion({messages:context,learnerText:'oq é encapsulamento?',structuralQuestion:false,observedPaths:[],generate:async()=>sentence});
  assert.equal(result.origin,'model');
});
test('abbreviated question repeated as an answer is blocked and retry accepted',async()=>{
  let count=0;const reasons=[];
  const raw='poderia me explicar oq é encapsulamento e pq usam isso?';
  const result=await resolveDiscussion({messages:context,learnerText:raw,structuralQuestion:false,observedPaths:[],onDiagnostic:(attempt,reason)=>reasons.push([attempt,reason]),generate:async()=>++count===1?raw:'Encapsulamento protege os dados e limita como outros objetos podem alterá-los.'});
  assert.equal(result.origin,'retry'); assert.deepEqual(reasons,[[1,'echo_question']]);
});
test('failed conceptual responses surface only rejection categories, never raw answers',async()=>{
  const reasons=[];const raw='pq usar encapsulamento?';
  const result=await resolveDiscussion({messages:context,learnerText:raw,structuralQuestion:false,observedPaths:[],onDiagnostic:(attempt,reason)=>reasons.push(`${attempt}:${reason}`),generate:async()=>raw});
  assert.equal(result.origin,'fallback');assert.deepEqual(reasons,['1:echo_question','2:echo_question']);
  assert.ok(!reasons.join(' ').includes('encapsulamento'));
});

test('retry repeats the real original learner question instead of treating correction as the latest topic',async()=>{
  let count=0;const original='me explica oq é composição em POO?';
  await resolveDiscussion({messages:context,learnerText:original,structuralQuestion:false,observedPaths:[],generate:async(messages)=>{
    count++; if(count===2) {
      assert.match(messages.at(-1).content,/PERGUNTA ORIGINAL A RESPONDER:/);
      assert.ok(messages.at(-1).content.includes(original));
    }
    return count===1?original:'Composição organiza objetos criando relações explícitas entre suas partes e responsabilidades.';
  }});
  assert.equal(count,2);
});


test('original architecture question must include the project-tree evidence', () => {
 assert.equal(projectStructureQuestion('Por que os arquivos do código são organizados do jeito que estão?'), true);
 assert.equal(projectStructureQuestion('Me explica por que as pastas foram organizadas assim'), true);
 assert.equal(projectStructureQuestion('Por que colocar todo o código num único arquivo?'), false);
});
