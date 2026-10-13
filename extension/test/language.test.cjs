const {test} = require('node:test');
const assert = require('node:assert/strict');
const {detectLearnerLanguage, chooseLearnerLanguage, localizedSystem, languageInstruction} = require('../dist/language.js');
const {resolveDiscussion} = require('../dist/discussion.js');
const {resolveGuidance} = require('../dist/recovery.js');
const {planGuidance, guidanceText} = require('../dist/pedagogy.js');

test('Brazilian Portuguese abbreviations, slang and accentless writing are recognized',()=>{
 for(const question of ['oq é encapsulamento e pq usam isso?', 'e qual a diferença pra abstração?', 'me explica como isso funciona', 'e em Python?', 'pq?', 'responda em português', 'agora em português', 'me ajuda' ])
   assert.equal(detectLearnerLanguage(question),'pt',question);
});
test('English questions and conversational follow-ups are recognized',()=>{
 for(const question of ['What is encapsulation?', 'Could you explain it again?', 'How is that different?', 'and what about Python?', 'why?', 'answer in English please', 'agora em inglês', 'in English please'])
   assert.equal(detectLearnerLanguage(question),'en',question);
});
test('explicit language request wins against the language of the surrounding question',()=>{
 assert.equal(detectLearnerLanguage('Pode explicar esse conceito em inglês?'),'en');
 assert.equal(detectLearnerLanguage('Could you answer in Portuguese?'),'pt');
 assert.equal(detectLearnerLanguage('Can you answer in Brazilian Portuguese please?'),'pt');
});
test('technical words and source code do not silently change spoken language',()=>{
 assert.equal(detectLearnerLanguage('`class` `async` `return`'),undefined);
 assert.equal(detectLearnerLanguage('```python\ndef async_function(): pass\n```'),undefined);
 assert.equal(chooseLearnerLanguage('`class`', 'pt'),'pt');
 assert.equal(chooseLearnerLanguage('`class`', 'en'),'en');
 assert.equal(chooseLearnerLanguage('Python?', 'en'),'en');
 assert.equal(chooseLearnerLanguage('ok', 'en'),'en');
 assert.equal(chooseLearnerLanguage('oq?', 'en'),'pt');
 assert.equal(chooseLearnerLanguage('why?', 'pt'),'en');
});
test('language instruction is scoped to current turn and does not translate source identifiers',()=>{
 assert.match(localizedSystem('You are a tutor.', 'en'),/RESPONSE LANGUAGE FOR THIS TURN: English/);
 assert.match(localizedSystem('Tutor', 'pt'),/IDIOMA DESTA RESPOSTA: português brasileiro/);
 assert.match(languageInstruction('en'),/identifiers/);
});
test('English retry and fallback stay in English when the model returns the question', async()=>{
 const question='Why use modules?';let calls=0;
 const result=await resolveDiscussion({language:'en',messages:[{role:'system',content:'Tutor'},{role:'user',content:question}],
   learnerText:question,structuralQuestion:false,observedPaths:[],generate:async msgs=>{
     calls++;if(calls===2) assert.match(msgs.at(-1).content,/ANSWER RETRY/);
     return question;
   }});
 assert.equal(calls,2);assert.equal(result.origin,'fallback');
 assert.match(result.text,/I could not produce/);assert.doesNotMatch(result.text,/Não consegui/);
});
test('English structural fallback only shows bounded safe observed paths',async()=>{
 const result=await resolveDiscussion({language:'en',messages:[],learnerText:'Explain the project architecture',
   structuralQuestion:true,observedPaths:['src/main.py','docs/readme.md','.env','src/safe\nunsafe.py'],
   generate:async()=>''});
 assert.equal(result.origin,'fallback');assert.match(result.text,/src/);assert.doesNotMatch(result.text,/\.env|unsafe\.py/);
});
test('English guidance retry uses English and fallback does not switch to Portuguese', async()=>{
 let count=0;const guide=await resolveGuidance({ language:'en', messages:[],sourceContext:'15: setInterval(run, 1000);',
   topicContext:'setInterval',learnerText:'What does setInterval do?',plan:planGuidance('What does setInterval do?'),
   generate:async messages=>{count++;if(count===2) assert.match(messages.at(-1).content,/IN ENGLISH/);return 'invalid';}
 });
 assert.equal(count,2);assert.equal(guide.origin,'fallback');
 assert.match(guidanceText(guide.guide),/We can|I can/);assert.doesNotMatch(guidanceText(guide.guide),/Vamos|pasta/);
});


test('English learner difficulties trigger graduated English hint instructions',()=>{
 const {planGuidance, needsMoreHelp} = require('../dist/pedagogy.js');
 for(const phrase of ["I don't understand", "I'm stuck", 'Could you give me a hint?', 'still confused'])
   assert.equal(needsMoreHelp(phrase),true,phrase);
 const plan=planGuidance("I'm stuck",undefined,'en');
 assert.equal(plan.needsHelp,true);assert.match(plan.instruction,/HINT MODE/);
 assert.doesNotMatch(plan.instruction,/MODO PISTA|Não existe pergunta/);
});
