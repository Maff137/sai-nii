const {test} = require('node:test');
const assert = require('node:assert/strict');
const {expandInformalPortuguese,informalInterpretation} = require('../dist/informal.js');

test('typical natural abbreviated programming questions can be interpreted, without changing the original',()=>{
 const raw='poderia me explicar oq é encapsulamento e pq usam isso?';
 assert.equal(expandInformalPortuguese(raw), 'poderia me explicar o que é encapsulamento e por que usam isso?');
 assert.match(informalInterpretation(raw),/o que é encapsulamento e por que usam isso/);
 assert.equal(raw,'poderia me explicar oq é encapsulamento e pq usam isso?');
});
test('short informal follow-ups with slang and typos get optional assistance',()=>{
 assert.equal(expandInformalPortuguese('n sei pq vc fez isso, tem como explicar?'), 'não sei por que você fez isso, tem como explicar?');
 assert.equal(informalInterpretation('E qual a diferença disso para abstração?'), '');
});
test('source identifiers, backticked code and code-like input are never rewritten',()=>{
 assert.equal(expandInformalPortuguese('O que significa `pq` e `oq` nesse código?'), 'O que significa `pq` e `oq` nesse código?');
 assert.equal(expandInformalPortuguese('const pq = 123;'), 'const pq = 123;');
 assert.equal(expandInformalPortuguese('Qual é o valor de n?'), 'Qual é o valor de n?');
 assert.equal(expandInformalPortuguese('O valor de p é o quê?'), 'O valor de p é o quê?');
 assert.equal(expandInformalPortuguese('```js\nconst pq=42;\n```'), '```js\nconst pq=42;\n```');
});
