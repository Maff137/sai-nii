const {test}=require('node:test');
const assert=require('node:assert/strict');
const {INCOMPLETE_GENERATION,isIncompleteGeneration,markIncompleteGeneration}=require('../dist/generation.js');
test('stop reply is passed through, token-budget cutoff is marked',()=>{
 assert.equal(markIncompleteGeneration('Useful explanation.','stop'),'Useful explanation.');
 assert.equal(markIncompleteGeneration('Useful explanation.',undefined),'Useful explanation.');
 assert.equal(markIncompleteGeneration('Useful explanation.','length'),'Useful explanation.'+INCOMPLETE_GENERATION);
 assert.equal(isIncompleteGeneration(markIncompleteGeneration('An incomplete answer','length')),true);
 assert.equal(isIncompleteGeneration('A complete answer.'),false);
});
