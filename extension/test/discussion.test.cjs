const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolveDiscussion, usefulDiscussionAnswer, nearCopy, projectStructureQuestion, discussionQuality, hasDisallowedCodeExample, conceptualExampleAllowed} = require('../dist/discussion.js');
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


test('regression: real Qwen Car example is valid educational English, no retry',async()=>{
 const question='Could you explain that again in English, with a simple example?';
 const answer=`Of course! Encapsulation lets an object control access to its internal state. For example, the Car class exposes public operations instead of its internal components.

\`\`\`pseudocode
class Car {
    private Engine engine;
    private FuelTank tank;
    public start() { engine.start(); }
    public checkFuel() { return tank.getLevel(); }
}
\`\`\`

The private members are not accessed directly by callers; the public operations define the interface and may enforce invariants.`;
 assert.equal(discussionQuality(answer,question),'valid');
 let calls=0;
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:question,structuralQuestion:false,observedPaths:[],generate:async()=>{calls++;return answer;}});
 assert.equal(calls,1);assert.equal(result.origin,'model');assert.equal(result.text,answer);
});

test('short Python conceptual example is accepted for Portuguese informal questions',()=>{
 const answer='Encapsulamento controla quem pode alterar o estado de um objeto. Por exemplo:\n\n```python\nclass Conta:\n    def depositar(self, valor):\n        self._saldo += valor\n```\n\nA operação permite validar um depósito antes de atualizar o saldo; um atributo interno não deve ser alterado arbitrariamente.';
 assert.equal(discussionQuality(answer,'oq eh encapsulamento? mostra um exemplo'),'valid');
});

test('code-only dump, oversized example, malformed fence and task solution remain rejected',async()=>{
 const q='Explain encapsulation with a simple example';
 assert.equal(discussionQuality('```js\nconst balance = 0;\n```',q),'code');
 const huge='A short conceptual explanation of how access works for an object.\n```js\n'+Array.from({length:34},(_,i)=>`console.log(${i});`).join('\n')+'\n```\nThis explanatory prose covers what the example demonstrates.';
 assert.equal(discussionQuality(huge,q),'code');
 assert.equal(discussionQuality('Here is an explanation of the object interface.\n```js\nconst balance = 0;','Explain encapsulation'),'code');
 const answer='Encapsulamento mantém as regras de atualização dentro do objeto.\n```js\nclass Conta { depositar(v) { this.saldo += v; } }\n```\nNesse exemplo o método controla quando o valor interno é alterado.';
 const task='Implemente a classe Conta do meu projeto e resolva essa tarefa para mim';
 assert.equal(conceptualExampleAllowed(task),false);
 assert.equal(conceptualExampleAllowed('faz um código de login para mim'),false);
 assert.equal(conceptualExampleAllowed('How can you make a login endpoint?'),false);
 assert.equal(discussionQuality(answer,task),'code');
 assert.equal(hasDisallowedCodeExample(answer,task),true);
 let attempts=0;
 const result=await resolveDiscussion({messages:context,language:'pt',learnerText:task,structuralQuestion:false,observedPaths:[],generate:async messages=>{
   attempts++;
   if(attempts===2) assert.match(messages.at(-1).content,/não foi autorizado a receber uma implementação completa/);
   return attempts===1?answer:'Não posso entregar essa implementação sem verificar a tentativa e o bloqueio; posso explicar os princípios para você desenvolvê-la.';
 }});
 assert.equal(result.origin,'retry');assert.equal(attempts,2);
});

test('oversized conceptual examples request shorter, grounded example on retry',async()=>{
 const q='Explain encapsulation with a simple example';let attempts=0;
 const large='Encapsulation controls internal state through operations.\n```js\n'+Array.from({length:40},(_,i)=>`const value${i} = ${i};`).join('\n')+'\n```\nThe demonstration is intentionally much too big for a single small learning example.';
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:q,structuralQuestion:false,observedPaths:[],generate:async messages=>{
   attempts++;
   if(attempts===2) assert.match(messages.at(-1).content,/ONE small, independent conceptual example/);
   return attempts===1?large:'Encapsulation allows callers to use a controlled interface while internal object state remains private.';
 }});
 assert.equal(result.origin,'retry');assert.equal(attempts,2);
});


test('a token-budget truncated reply is rejected even if its text otherwise looks valid', async()=>{
 const { markIncompleteGeneration } = require('../dist/generation.js');
 const q='What is the difference between encapsulation and abstraction?';
 const cut='Encapsulation hides internal state and exposes controlled operations. Abstraction focuses on essential capabilities. The difference is:\n1. **Encaps';
 const marked=markIncompleteGeneration(cut,'length');
 assert.equal(discussionQuality(marked,q),'truncated');
 assert.equal(discussionQuality(markIncompleteGeneration(cut,'stop'),q),'valid');
 let calls=0;const diagnostics=[];
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:q,structuralQuestion:false,observedPaths:[],onDiagnostic:(attempt,reason)=>diagnostics.push([attempt,reason]),generate:async messages=>{
  calls++;
  if(calls===2) assert.match(messages.at(-1).content,/OUTPUT FORMAT FOR RETRY: TWO SHORT PROSE PARAGRAPHS/);
  return calls===1 ? marked : 'Encapsulation controls access to internal state; abstraction presents essential capabilities. Both reduce complexity in different ways.';
 }});
 assert.equal(result.origin,'retry');assert.equal(calls,2);
 assert.deepEqual(diagnostics,[[1,'truncated']]);
});

test('a second unfinished response does not reach the learner',async()=>{
 const {markIncompleteGeneration}=require('../dist/generation.js');
 const q='Explain abstraction briefly';
 const truncated=markIncompleteGeneration('Abstraction involves hiding unnecessary details and presenting an interface with a public method','length');
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:q,structuralQuestion:false,observedPaths:[],generate:async()=>truncated});
 assert.equal(result.origin,'fallback');
 assert.doesNotMatch(result.text,/presenting an interface with a public method/);
});

test('code fidelity: an English re-explanation cannot silently rewrite a previous Python example',async()=>{
 const original='```python\nclass ContaBancaria:\n    def __init__(self, saldo_inicial=0):\n        self.__saldo = saldo_inicial\n```';
 const changed='The bank account example shows encapsulation.\n\n```python\nclass ContaBancaria:\n    def __init__(self):\n        self.__saldo = 0\n```\n\nOnly deposit can update the balance.';
 const {rewritesPreviousExample}=require('../dist/discussion.js');
 const q='Now explain the same code in English without renaming ContaBancaria';
 assert.equal(rewritesPreviousExample(changed,q,original),true);
 assert.equal(rewritesPreviousExample('Explanation only: ContaBancaria stores the balance.',q,original),false);
 assert.equal(rewritesPreviousExample('A distinct example:\n'+changed,'Show a different example',original),false);
 let calls=0, reason='';
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:q,previousAnswer:original,structuralQuestion:false,observedPaths:[],
  onDiagnostic:(_attempt,why)=>reason=why,
  generate:async messages=>{calls++;if(calls===2) assert.match(messages.at(-1).content,/prose ONLY/);return calls===1?changed:'The original ContaBancaria initializer accepts saldo_inicial, and __saldo stores that supplied initial amount. The public methods control ordinary changes to this stored state.';}});
 assert.equal(result.origin,'model');assert.equal(calls,1);assert.equal(reason,'');
 assert.equal(result.codeReused,true);
 assert.doesNotMatch(result.text,/self.__saldo = 0/);
 assert.match(result.text,/self.__saldo = saldo_inicial/);
});

test('verbatim reuse is allowed, but unrelated discussions do not block different examples',async()=>{
 const {rewritesPreviousExample}=require('../dist/discussion.js');
 const earlier='A complete short example:\n```python\nclass A:\n    pass\n```';
 const same='The exact example is still useful:\n```python\nclass A:\n    pass\n```\nIt shows a class declaration.';
 const q='Now explain the same code in English';
 assert.equal(rewritesPreviousExample(same,q,earlier),false);
 assert.equal(rewritesPreviousExample(same,'What is a Python class?',earlier),false);
});


test('translation preserves unchanged executable lines even when comments are translated',()=>{
 const {rewritesPreviousExample}=require('../dist/discussion.js');
 const original='Original example:\n```python\nclass ContaBancaria:\n    def __init__(self, titular, saldo_inicial=0):\n        self.titular = titular\n        self.__saldo = saldo_inicial  # Saldo privado\n    def depositar(self, valor):\n        if valor > 0:\n            self.__saldo += valor\n# Uso\nconta = ContaBancaria("João", 100)\nconta.depositar(50)\n```';
 const q='Now explain that in English using the same example';
 const copied=original.replace('Saldo privado','Private balance').replace('# Uso','# Usage');
 assert.equal(rewritesPreviousExample(copied,q,original),false);
 const excerpt='The example uses a bank account.\n```python\nconta = ContaBancaria("João", 100)\nconta.depositar(50)\n```\nThe account is initialized and then gets a deposit.';
 assert.equal(rewritesPreviousExample(excerpt,q,original),false);
 const changed=original.replace('self.__saldo = saldo_inicial','self.__saldo = 0');
 assert.equal(rewritesPreviousExample(changed,q,original),true);
 const reversed='Explanation.\n```python\nconta.depositar(50)\nconta = ContaBancaria("João", 100)\n```\nThis should not be reordered.';
 assert.equal(rewritesPreviousExample(reversed,q,original),true);
 const withStringChange=original.replace('"João", 100','"João", 10');
 assert.equal(rewritesPreviousExample(withStringChange,q,original),true);
});

test('regression: previously rejected original excerpt with translated comment is accepted without retries',async()=>{
 const previous='Previous explanatory example.\n```python\nclass ContaBancaria:\n    def __init__(self, titular, saldo_inicial=0):\n        self.titular = titular\n        self.__saldo = saldo_inicial\n    def depositar(self, valor):\n        if valor > 0:\n            self.__saldo += valor\n# Uso\nconta = ContaBancaria("João", 100)\nconta.depositar(50)\n```';
 const next='The bank account example initializes the balance and allows deposits through a public method.\n```python\n# Using the class\nconta = ContaBancaria("João", 100)\nconta.depositar(50)\n```\nThis unchanged portion creates an account and calls depositar.';
 const q='Now explain the same code in English';
 let calls=0;
 const result=await resolveDiscussion({messages:context,learnerText:q,previousAnswer:previous,language:'en',structuralQuestion:false,observedPaths:[],generate:async()=>{calls++;return next;}});
 assert.equal(result.origin,'model');assert.equal(calls,1);
});

test('truncation retry explicitly requests two prose paragraphs without code',async()=>{
 const {markIncompleteGeneration}=require('../dist/generation.js');
 const q='Quais limitações técnicas desse exemplo?';
 const original=markIncompleteGeneration('Uma possível limitação envolve o estado interno e', 'length');
 let attempts=0;
 const result=await resolveDiscussion({messages:context,learnerText:q,language:'pt',structuralQuestion:false,observedPaths:[],generate:async messages=>{
   attempts++;
   if(attempts===2){assert.match(messages.at(-1).content,/ATÉ DOIS PARÁGRAFOS|NO MÁXIMO DOIS PARÁGRAFOS/);assert.match(messages.at(-1).content,/SEM código/);}
   return attempts===1?original:'O exemplo permite receber dados iniciais sem validação. Encapsulamento restringe o acesso convencional, mas não garante por si só que todos os valores sejam válidos.';
 }});
 assert.equal(result.origin,'retry');assert.equal(attempts,2);
});


test('real benchmark regression: translated Python strings are restored without a retry', async()=>{
 const {anchorPriorExample}=require('../dist/discussion.js');
 const oldCode='```python\nclass ContaBancaria:\n    def __init__(self, titular):\n        self.titular = titular\n        self.__saldo = 0  # Saldo privado\n    def depositar(self, valor):\n        if valor > 0:\n            self.__saldo += valor\n            print(f"Depósito de {valor} realizado")\nconta = ContaBancaria("João")\nconta.depositar(100)\n```';
 const earlier='Encapsulamento controla o estado interno.\n\n'+oldCode+'\n\nO método protege alterações usuais.';
 const english='The ContaBancaria example uses __saldo and depositar to control the account balance.\n\n```python\nclass ContaBancaria:\n    def __init__(self, titular):\n        self.titular = titular\n        self.__saldo = 0  # Private balance\n    def depositar(self, valor):\n        if valor > 0:\n            self.__saldo += valor\n            print(f"Deposit of {valor} made")\nconta = ContaBancaria("John")\nconta.depositar(100)\n```\n\nOnly depositar changes the balance in this example.';
 const q='Now explain the same code in English, without renaming ContaBancaria, __saldo or depositar.';
 const anchored=anchorPriorExample(english,q,earlier);
 assert.equal(anchored.reused,true);
 assert.ok(anchored.text.includes(oldCode));
 assert.doesNotMatch(anchored.text,/"John"|Deposit of/);
 let calls=0;
 const result=await resolveDiscussion({messages:context,language:'en',learnerText:q,previousAnswer:earlier,structuralQuestion:false,observedPaths:[],generate:async()=>{calls++;return english;}});
 assert.equal(calls,1);
 assert.equal(result.origin,'model');
 assert.equal(result.codeReused,true);
 assert.ok(result.text.includes(oldCode));
});

test('code-only translations are not accepted by deterministic reuse', async()=>{
 const {anchorPriorExample}=require('../dist/discussion.js');
 const previous='```python\nclass A:\n    pass\n```';
 const candidate='```python\nclass A:\n    print("translated")\n```';
 const result=anchorPriorExample(candidate,'Now explain the same example in English',previous);
 assert.equal(result.reused,true);
 assert.equal(result.text,previous);
 assert.equal(discussionQuality(result.text,'Now explain the same example in English'),'code');
});

test('code change is not silently repaired in a request for a new example',()=>{
 const {anchorPriorExample}=require('../dist/discussion.js');
 const reply='A new example with code:\n```python\nclass B:\n    pass\n```\nThat is a different class.';
 const before='```python\nclass A:\n    pass\n```';
 const anchored=anchorPriorExample(reply,'Show a different example',before);
 assert.equal(anchored.reused,false);
 assert.equal(anchored.text,reply);
});

test('too-large prior code stays in conversation; translated regeneration is dropped',()=>{
 const {anchorPriorExample}=require('../dist/discussion.js');
 const original='```python\n'+Array.from({length:45},(_,i)=>`line_${i} = ${i}`).join('\n')+'\n```';
 const candidate='This earlier block illustrates how variables are assigned.\n```python\nline_0 = 999\n```\nI will focus on its mechanism rather than reconstruct it.';
 const result=anchorPriorExample(candidate,'explain the same code in English',original);
 assert.equal(result.reused,true);
 assert.doesNotMatch(result.text,/line_0 = 999|line_0 = 0/);
 assert.match(result.text,/illustrates how variables/);
});


test('multiple distinct earlier code blocks are never arbitrarily substituted',()=>{
 const {anchorPriorExample}=require('../dist/discussion.js');
 const previous='```python\nclass A:\n    pass\n```\nSecond example:\n```python\nclass B:\n    pass\n```';
 const reply='The previous example uses an interface.\n```python\nclass C:\n    pass\n```\nEach demonstration illustrates a separate design.';
 const anchored=anchorPriorExample(reply,'Now explain the same examples in English',previous);
 assert.equal(anchored.reused,true);
 assert.doesNotMatch(anchored.text,/class A|class B|class C/);
 assert.match(anchored.text,/previous example uses an interface/);
});


test('translated prose cannot refer to invented fields or methods absent from the educational example', async () => {
 const { unobservedExampleIdentifiers } = require('../dist/discussion.js');
 const old = 'An account demonstration:\n```python\nclass ContaBancaria:\n    def __init__(self, titular, saldo_inicial=0):\n        self.titular = titular\n        self.__saldo = saldo_inicial\n    def depositar(self, valor):\n        self.__saldo += valor\n```';
 const q = 'Now explain the same code in English without renaming names';
 const bad = 'In the `ContaBancaria` class, the `__balance` attribute stores the amount and the `deposit` method changes it.';
 assert.deepEqual(unobservedExampleIdentifiers(bad, q, old), ['__balance','deposit']);
 assert.deepEqual(unobservedExampleIdentifiers('The `__saldo` attribute is changed by the `depositar` method.', q, old), []);
 assert.deepEqual(unobservedExampleIdentifiers('`private` is a language feature, but this code has `__saldo`.', q, old), []);
 assert.deepEqual(unobservedExampleIdentifiers(bad,'What is encapsulation?',old), []);
 let attempts=0; const observed=[];
 const outcome = await resolveDiscussion({messages:context, language:'en', learnerText:q, previousAnswer:old, structuralQuestion:false, observedPaths:[],
  onDiagnostic:(_,why)=>observed.push(why), generate:async messages=>{
   attempts++;if (attempts===2) assert.match(messages.at(-1).content,/exact observed class, field and method identifiers/);
   return attempts===1 ? bad : 'In `ContaBancaria`, the `__saldo` attribute holds state while the `depositar` method changes that state through the defined interface.';
 }});
 assert.equal(outcome.origin,'retry');assert.equal(attempts,2);assert.deepEqual(observed,['unobserved_identifier']);
});

test('actual code styling and correct unchanged names do not trigger false identifier flags', () => {
 const { unobservedExampleIdentifiers } = require('../dist/discussion.js');
 const old = '```js\nclass Account {\n  deposit(amount) {\n    this.balance += amount;\n  }\n}\n```';
 const q = 'Explain the same example in Portuguese';
 assert.deepEqual(unobservedExampleIdentifiers('A classe `Account` contém o atributo `balance` e o método `deposit`.',q,old),[]);
 assert.deepEqual(unobservedExampleIdentifiers('A classe `Account` contém o atributo `saldo` e o método `deposit`.',q,old),['saldo']);
});
