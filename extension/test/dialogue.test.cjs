const {test} = require('node:test');
const assert = require('node:assert/strict');
const {isRephrasingRequest, requestedDepth, dialogueInstruction, compactDiscussionHistory} = require('../dist/dialogue.js');

test('recognizes natural translation/re-explanation in both languages',()=>{
 for(const q of ['Now explain that in English please', 'Agora explique em ingles', 'repete em português', 'say that in English', 'fala isso de outro jeito', 'same example, please']) {
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
 assert.ok(next[1].content.length<1800);
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
