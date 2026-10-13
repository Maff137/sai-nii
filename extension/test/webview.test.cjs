const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {createHtml, assistantBlocks} = require('../dist/webview.js');

function viewSandbox() {
  const webview = {};
  const html = createHtml(webview);
  const script = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const elements = new Map();
  const makeNode = tag => ({tag, children:[], textContent:'', className:'',style:{},addEventListener(){},append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node)},scrollHeight:0});
  const document = {createElement:makeNode,getElementById(id){if(!elements.has(id)) elements.set(id,makeNode('div'));return elements.get(id);}};
  const sandbox = {document, window:{addEventListener(){}}, acquireVsCodeApi:()=>({postMessage(){}})};
  vm.createContext(sandbox); vm.runInContext(script,sandbox);
  return {sandbox,elements,webview,html};
}
test('webview creates safe Markdown nodes for headings, bold text and lists',()=>{
 const {sandbox,elements,html}=viewSandbox();
 assert.doesNotMatch(html,/innerHTML/);
 const input='## Arquitetura\n\n**src/** e `test/`\n\n1. Código\n2. Testes';
 sandbox.add('assistant', input, assistantBlocks(input));
 const message=elements.get('messages').children.at(-1);
 const content=message.children.at(-1);
 assert.equal(content.className,'markdown');
 assert.deepEqual(content.children.map(x=>x.tag),['h3','p','ol']);
 assert.equal(content.children[1].children[0].tag,'strong');
 assert.equal(content.children[1].children[2].tag,'code');
 assert.equal(content.children[2].children.length,2);
});
test('HTML, external images and onclick payloads stay inert text',()=>{
 const {sandbox,elements,webview}=viewSandbox();
 const input='<img src="x" onerror="alert(1)"> **safe** <script>alert(2)</script>';
 sandbox.add('assistant',input,assistantBlocks(input));
 const content=elements.get('messages').children.at(-1).children.at(-1);
 assert.deepEqual(content.children.map(x=>x.tag),['p']);
 assert.equal(content.children[0].children[0].tag,'span');
 assert.match(content.children[0].children[0].textContent,/<img/);
 assert.deepEqual(webview.options.localResourceRoots,[]);
});
