const {test} = require('node:test');
const assert = require('node:assert/strict');
const {isRephrasingRequest, requestedDepth, dialogueInstruction, compactDiscussionHistory, asksForCodeLimitations} = require('../dist/dialogue.js');

test('recognizes natural translation/re-explanation in both languages',()=>{
 for(const q of ['Now explain that in English please', 'Agora explique em ingles', 'repete em português', 'say that in English', 'fala isso de outro jeito', 'same example, please', 'Now explain the same code in English', 'explica o mesmo código em ingles']) {
  assert.equal(isRephrasingRequest(q),true,q);
 }
 assert.equal(isRephrasingRequest('What is a Git commit?'),false);
 assert.equal(isRephrasingRequest('E qual a diferença disso pra abstração?'),false);
});
test('depth instructions adapt without treating every followup as a request for long explanations',()=>{
 assert.equal(requestedDepth('me explica mais detalhadamente passo a passo'),'deep');
 assert.equal(requestedDepth('quick summary please'),'brief');
 assert.equal(requestedDepth('What is encapsulation?'),'normal');
 assert.match(dialogueInstruction('explique em inglês','en',true),/SAME programming example/);
 assert.match(dialogueInstruction('pode resumir?','pt',true),/30-70 palavras/);
 assert.match(dialogueInstruction('explique mais a fundo','pt',true),/pediu profundidade/);
 assert.doesNotMatch(dialogueInstruction('por que?', 'pt', true),/MESMO exemplo/);
});
test('preserves a real earlier source example late in a lengthy response for translation',()=>{
 const longIntro='Encapsulamento protege os dados internos. '.repeat(55);
 const example='```python\nclass ContaBancaria:\n    def depositar(self, valor):\n        self.saldo += valor\n```';
 const original=`${longIntro}\n\n${example}\n\nFim da explicação`;
 const h=[{role:'user',content:'O que é encapsulamento?'},{role:'assistant',content:original}];
 const next=compactDiscussionHistory(h,'Now explain that in English');
 assert.equal(next.length,2);
 assert.match(next[1].content,/ContaBancaria/);
 assert.match(next[1].content,/depositar/);
 assert.ok(next[1].content.length<=2200);
 assert.equal(h[1].content,original,'never mutate original conversation history');
 const normal=compactDiscussionHistory(h,'e o que é Git?');
 assert.ok(!normal[1].content.includes('ContaBancaria'),'unrelated question does not drag in the long example');
});
test('compaction never mixes turns outside the recent conversation window',()=>{
 const history=[];
 for(let n=0;n<7;n++){history.push({role:'user',content:`Pergunta ${n}`});history.push({role:'assistant',content:`Resposta ${n}`});}
 const compact=compactDiscussionHistory(history,'repete em ingles');
 assert.deepEqual(compact.map(t=>t.content),['Pergunta 5','Resposta 5','Pergunta 6','Resposta 6']);
});


test('teaching adapts to explicit novice and experienced self-reports, without assigning grades',()=>{
 const {learnerCue}=require('../dist/dialogue.js');
 assert.equal(learnerCue('Sou iniciante nisso, nunca vi uma Promise.'),'fundamentals');
 assert.equal(learnerCue('I am a beginner. What is ownership?'),'fundamentals');
 assert.equal(learnerCue("I'm a beginner."),'fundamentals');
 assert.equal(learnerCue("I don't understand this."),'fundamentals');
 assert.equal(learnerCue('não sou iniciante, explica as limitações'),'technical');
 assert.equal(learnerCue('já sei o básico, quero as nuances técnicas'),'technical');
 assert.equal(learnerCue('I know the basics. Can we discuss edge cases?'),'technical');
 assert.equal(learnerCue("I'm familiar with Python already."),'technical');
 assert.equal(learnerCue('O que significa encapsulamento?'),'none');
 assert.equal(learnerCue('Como funciona `sou iniciante` em uma string?'),'none');
 const beginner=dialogueInstruction('Sou iniciante nisso','pt',true);
 assert.match(beginner,/pré-requisito mínimo/);
 assert.match(beginner,/não presuma falta de domínio/);
 const expert=dialogueInstruction('I know the basics, go technical','en',true);
 assert.match(expert,/technical precision/);
});

test('translation prompt explicitly preserves code identifiers and exact source',()=>{
 const pt=dialogueInstruction('Agora explique isso em inglês','en',true);
 assert.match(pt,/keep the exact original code and identifiers/);
 assert.match(pt,/Translate only the explanatory prose/);
 const clear=dialogueInstruction('Explica em português com o mesmo exemplo','pt',true);
 assert.match(clear,/mantenha o trecho e os identificadores originais/);
});

test('long teaching code is represented as identifiers, never as a fake complete snippet',()=>{
 const body=['class ContaBancaria:', '  def __init__(self):', '    self.__saldo = 0',
  '  def depositar(self, valor):','    self.__saldo += valor',
  ...Array.from({length:40},(_,i)=>`    # explicação ${i}`), '  def sacar(self, valor):', '    self.__saldo -= valor'].join('\n');
 const input=[{role:'user',content:'Me explica o encapsulamento'},{role:'assistant',content:'Uma explicação conceitual detalhada. '.repeat(28)+'\n```python\n'+body+'\n```\nFim'}];
 const next=compactDiscussionHistory(input,'Now explain that in English');
 const text=next.at(-1).content;
 assert.match(text,/ContaBancaria/);
 assert.match(text,/__saldo/);
 assert.match(text,/depositar/);
 assert.match(text,/TOO LONG/);
 assert.doesNotMatch(text,/```/);
 assert.doesNotMatch(text,/# explicação/);
 assert.ok(text.length<=1750);
});

test('short teaching example stays byte-for-byte intact across re-explanation',()=>{
 const code='class ContaBancaria:\n    def depositar(self, valor):\n        self.__saldo += valor';
 const answer='Descrição breve antes do exemplo. '.repeat(52)+'\n```python\n'+code+'\n```';
 const current=compactDiscussionHistory([{role:'assistant',content:answer}], 'Now explain in English');
 assert.ok(current[0].content.includes('```python\n'+code+'\n```'));
});

test('technical follow-up anchors original code even after a prose-only translation',()=>{
 const code='```python\nclass ContaBancaria:\n    def __init__(self, saldo_inicial=0):\n        self.__saldo = saldo_inicial\n```';
 const history=[{role:'user',content:'Mostra um exemplo'},
  {role:'assistant',content:'Explicação extensa. '.repeat(75)+'\n'+code},
  {role:'user',content:'Now explain the same code in English'},
  {role:'assistant',content:'The ContaBancaria class stores state and controls access.'}];
 const compact=compactDiscussionHistory(history,'agora explique as limitações desse exemplo');
 assert.match(compact[1].content,/saldo_inicial/);
 assert.match(compact[1].content,/ContaBancaria/);
 assert.match(compact[3].content,/controls access/);
 assert.match(dialogueInstruction('agora explique as limitações desse exemplo','pt',true),/código realmente visto/);
});


test('keeps a full 20-line original example available for later technical scrutiny',()=>{
 const src=['class ContaBancaria:', '    def __init__(self, titular, saldo_inicial=0):', '        self.titular = titular', '        self.__saldo = saldo_inicial',
 '    def depositar(self, valor):','        if valor > 0:', '            self.__saldo += valor',
 ...Array.from({length:15},(_,i)=>`    # detail ${i}`)].join('\n');
 const history=[{role:'user',content:'exemplo de encapsulamento'},
  {role:'assistant',content:'Uma explicação de conta bancária. '.repeat(25)+'\n```python\n'+src+'\n```'},
  {role:'user',content:'Now explain the same code in English'},
  {role:'assistant',content:'Same account example.\n```python\nconta = ContaBancaria("João", 100)\n```\nThis uses the class.'}];
 const result=compactDiscussionHistory(history,'e quais sao as limitações desse exemplo?');
 assert.match(result[1].content,/saldo_inicial=0/);
 assert.match(result[1].content,/self.__saldo = saldo_inicial/);
 assert.match(result[1].content,/```python[\s\S]*?```/);
 assert.ok(result[1].content.length<=2200);
});

test('technical follow-ups get bounded evidence-first critique, not a rewritten class',()=>{
 const q='ja entendi o basico. agora explica as limitações técnicas desse exemplo, sem repetir o começo.';
 assert.equal(asksForCodeLimitations(q),true);
 const guidance=dialogueInstruction(q,'pt',true);
 assert.match(guidance,/ANÁLISE CRÍTICA DO EXEMPLO/);
 assert.match(guidance,/inicialização/);
 assert.match(guidance,/60-95 palavras/);
 assert.match(guidance,/não invente permissões/);
 const english=dialogueInstruction('What are the limitations of this code example?','en',true);
 assert.match(english,/CODE REVIEW FOLLOW-UP/);
 assert.match(english,/do not invent business permissions/);
 assert.equal(asksForCodeLimitations('O que é uma variável?'),false);
});


test('reference names in re-explanations come only from actual prior code',()=>{
 const {observedCodeNames,observedIdentifierInstruction}=require('../dist/dialogue.js');
 const old='The example is:\n```python\nclass ContaBancaria:\n    def __init__(self, saldo_inicial=0):\n        self.__saldo = saldo_inicial\n    def depositar(self, valor):\n        self.__saldo += valor\n```';
 assert.deepEqual(observedCodeNames(old),['ContaBancaria','__init__','__saldo','depositar']);
 const hint=observedIdentifierInstruction(old,'Now explain same code in English','en');
 assert.match(hint,/ContaBancaria, __init__, __saldo, depositar/);
 assert.match(hint,/not introduce translated names/);
 assert.equal(observedIdentifierInstruction(old,'Explain a different topic','en'),'');
 assert.deepEqual(observedCodeNames('No fenced example: class Imaginary:'),[]);
});


test('technical limitations follow-up asks for real constructor and branch inspection, not imagined input', () => {
 const { dialogueInstruction }=require('../dist/dialogue.js');
 const instruction=dialogueInstruction('ja entendi o basico. explica limitações técnicas desse exemplo','pt',true);
 assert.match(instruction,/construtor REALMENTE aceita/);
 assert.match(instruction,/rejeitados, ignorados e entradas que causam exceção/);
 assert.match(instruction,/NÃO invente saídas de execução/);
 assert.doesNotMatch(instruction,/um saldo inicial específico/);
});
