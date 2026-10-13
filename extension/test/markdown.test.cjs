const {test} = require('node:test'); const assert = require('node:assert/strict');
const {parseMarkdown,parseInline}=require('../dist/markdown.js');
test('renders Markdown structure as data, never HTML',()=>{
 const blocks=parseMarkdown('## Organização\n\nA **pasta** `src/` contém *código*.\n\n- testes\n- docs');
 assert.deepEqual(blocks.map(x=>x.kind),['heading','paragraph','list']);
 assert.deepEqual(blocks[1].spans.map(x=>x.kind),['text','strong','text','code','text','em','text']);
 assert.equal(blocks[2].items.length,2);
});
test('treats model-provided script and attributes as inert text',()=>{
 const content='<img src=x onerror=alert(1)> **teste** <script>alert(1)</script>';
 const blocks=parseMarkdown(content);
 assert.equal(blocks.length,1);assert.match(blocks[0].spans[0].text,/<img src=x onerror/);
 assert.match(blocks[0].spans.at(-1).text,/<script>alert/);
 assert.equal(JSON.stringify(blocks).includes('innerHTML'),false);
});
test('code fence is inert data and does not form DOM tags',()=>{
 const blocks=parseMarkdown('```html\n<img src=x onerror=alert(1)>\n```');
 assert.equal(blocks[0].kind,'code');assert.match(blocks[0].code,/<img src/);
});
test('simple formatting, list numbering and quotations are parsed',()=>{
 const out=parseMarkdown('1. Primeiro\n2. Segundo\n\n> Nota: **atenção**');
 assert.equal(out[0].kind,'list');assert.equal(out[0].ordered,true); assert.equal(out[1].kind,'quote');
 assert.equal(parseInline('`main.py`')[0].kind,'code');
});
test('bounded number and size of elements for arbitrary model output',()=>{
 const out=parseMarkdown('A\n\n'.repeat(20000)); assert.ok(out.length<=100);
});
