'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { routeTurn, refersToConcreteTask } = require('../dist/routing.js');
const route=(q, opts={})=>routeTurn(q,{editorOpen:true, ...opts});

test('conceptual questions stay conversational with Python, TS, Go, Rust, or Java files open', () => {
  for (const q of ['oq é encapsulamento e pq usamos isso?', 'What does async/await mean in JavaScript?',
    'Qual a diferença entre goroutine e thread?', 'Me explica ownership no Rust', 'O que é uma interface em Java?',
    'Sou iniciante, me explica o que é uma classe com um exemplo de Python', 'Por que encapsulamento é importante?', 'Me mostra um exemplo simples de recursão']) {
    assert.equal(route(q).mode,'discussion',q);
    assert.equal(route(q).context,'workspace',q);
  }
});

test('explicit project/file questions and task requests are guided, not free solution generation', () => {
  for (const q of ['Explique a função que está selecionada.', 'Quero entender o trecho selecionado ou arquivo aberto.',
    'por que esse código não funciona?', 'Analise este método do meu arquivo', 'Implement a login function in my project',
    'Corrija meu código TypeScript', 'Write a Python script that does the task', 'Me ajude a implementar a API',
    'Refatore a classe no meu projeto', 'Como faço para implementar autenticação?', 'Can you build a program for me?']) {
    assert.equal(route(q).mode,'guidance',q);
  }
});

test('architecture requests use workspace context independently of editor state',()=>{
  for(const editorOpen of [true,false]){
    const r=route('Explique a arquitetura e as pastas deste projeto',{editorOpen});
    assert.deepEqual([r.mode,r.context,r.reason],['discussion','workspace','architecture']);
  }
});

test('follow-ups retain prior mode, but explicit source intent wins',()=>{
  assert.equal(route('agora em inglês',{previousMode:'discussion'}).mode,'discussion');
  assert.equal(route('e por quê?',{previousMode:'guidance'}).mode,'guidance');
  assert.equal(route('pq?',{previousMode:'guidance'}).mode,'guidance');
  assert.equal(route('e como isso difere de abstração?',{previousMode:'discussion'}).mode,'discussion');
  assert.equal(route('e no meu arquivo?',{previousMode:'discussion'}).mode,'guidance');
  assert.equal(route('Corrija isso no meu código',{previousMode:'discussion'}).mode,'guidance');
  assert.equal(route('Implemente a arquitetura do meu projeto').mode,'guidance');
  assert.equal(route('Faça pra mim uma API em Python').mode,'guidance');
});

test('conservative defaults and active selections',()=>{
  assert.equal(route('pode me ajudar?',{selectionActive:true}).mode,'guidance');
  assert.equal(route('pode me ajudar?',{editorOpen:false}).mode,'discussion');
  assert.equal(route('pode me ajudar?',{editorOpen:true,previousMode:'discussion'}).mode,'discussion');
  assert.equal(route('O que é um módulo?',{selectionActive:true}).mode,'discussion');
  assert.equal(refersToConcreteTask('Mostra um exemplo simples de encapsulamento'),false);
});


test('a stuck follow-up about code stays in guidance despite why/how cues',()=>{
  for(const q of [
    'I still do not understand why a negative count changes nothing. Give me a clue.',
    'I do not understand why the condition is false. Can you give me a hint?',
    'Ainda não entendi por que a condição falha. Me dá outra pista.'
  ]) assert.equal(route(q,{previousMode:'guidance'}).mode,'guidance',q);
  assert.equal(route('Why do classes exist?',{previousMode:'guidance'}).mode,'discussion');
});
