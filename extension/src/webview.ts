import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { parseMarkdown } from './markdown';

export function createHtml(webview: vscode.Webview): string {
  const nonce = randomBytes(18).toString('base64');
  webview.options = { enableScripts: true, localResourceRoots: [] };
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'none'; form-action 'none'"/>
<style nonce="${nonce}">
:root {color-scheme:light dark} *{box-sizing:border-box} body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);margin:0;padding:12px;display:flex;flex-direction:column;height:100vh;gap:12px}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:9px} h1{font-size:1.1rem;margin:0} .tag{font-size:.72rem;color:var(--vscode-descriptionForeground)}
#messages{overflow-y:auto;flex:1;min-height:110px;display:flex;flex-direction:column;gap:10px} .message{border-radius:7px;border:1px solid var(--vscode-panel-border);padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45} .message.user{background:var(--vscode-sideBar-background)} .message.assistant{background:var(--vscode-editor-background)}
.message > b{display:block;margin-bottom:5px;font-size:.8rem}.markdown p{margin:0 0 .65em}.markdown p:last-child{margin-bottom:0}.markdown ul,.markdown ol{padding-left:1.3em;margin:.4em 0 .7em}.markdown li{margin:.25em 0}.markdown h3,.markdown h4{font-size:1em;margin:.65em 0 .35em}.markdown code{font-family:var(--vscode-editor-font-family,monospace);background:var(--vscode-textCodeBlock-background);padding:0 .15em;border-radius:3px}.markdown pre{white-space:pre;overflow-x:auto;background:var(--vscode-textCodeBlock-background);padding:8px;border-radius:4px}.markdown pre code{padding:0}.markdown blockquote{margin:.6em 0;padding-left:.7em;border-left:2px solid var(--vscode-textBlockQuote-border)}.message.error{border-color:var(--vscode-errorForeground)} button{cursor:pointer;padding:8px 9px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:none;border-radius:4px} button.secondary{color:var(--vscode-foreground);background:var(--vscode-button-secondaryBackground)}button:disabled{opacity:.6;cursor:wait}
textarea{width:100%;resize:vertical;min-height:58px;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;font:inherit} label{display:block;font-size:.82rem;margin-bottom:4px} .buttons{display:flex;gap:6px;flex-wrap:wrap} #releaseForm{display:none;border-top:1px solid var(--vscode-panel-border);padding-top:9px} #releaseForm textarea{min-height:50px;margin-bottom:8px} #busy{min-height:14px;font-size:.82rem;color:var(--vscode-descriptionForeground)} .footer{font-size:.75rem;color:var(--vscode-descriptionForeground)}
</style></head><body>
<header><h1>Sai-nii</h1><span class="tag">100% local · Somente leitura</span></header>
<div id="messages" role="log" aria-live="polite"></div>
<div id="busy" role="status"></div>
<div id="releaseForm">
<label for="attempt">O que você já tentou?</label><textarea id="attempt" placeholder="Descreva uma tentativa concreta ou o raciocínio que testou..."></textarea>
<label for="blocker">Por que não consegue prosseguir?</label><textarea id="blocker" placeholder="Diga onde travou e por que as pistas anteriores não bastaram..."></textarea>
<div class="buttons"><button id="sendRelease">Solicitar solução explicada</button><button id="cancelRelease" class="secondary">Cancelar</button></div>
</div>
<div id="questionBox"><label for="question">Sua dúvida sobre o projeto</label><textarea id="question" placeholder="Em qual parte do raciocínio você travou?"></textarea>
<div class="buttons"><button id="send">Perguntar</button><button id="analyze" class="secondary">Analisar seleção</button><button id="architecture" class="secondary">Arquitetura do projeto</button><button id="release" class="secondary">Pedir solução</button></div></div>
<div class="buttons"><button id="memory" class="secondary">Ver memória</button><button id="clearProject" class="secondary">Apagar projeto</button><button id="clear" class="secondary">Apagar tudo</button></div>
<div class="footer">O professor não altera arquivos nem executa comandos de teste. Requer llama-server local.</div>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi();
const $=(id)=>document.getElementById(id);
function post(type,extra={}){vscode.postMessage({type,...extra})}
// Markdown arrives as a restricted AST, never HTML; even malicious tags remain text.
function contentNode(kind, text, blocks){
 const root=document.createElement('div');
 if(kind!=='assistant' || !Array.isArray(blocks)){root.textContent=String(text);return root}
 root.className='markdown';
 function fill(el,parts){if(!Array.isArray(parts))return;for(const part of parts.slice(0,300)){
   if(!part||typeof part.text!=='string')continue;
   const tags={text:'span',strong:'strong',em:'em',code:'code'};
   const tag=tags[part.kind]||'span';const node=document.createElement(tag);node.textContent=part.text;el.appendChild(node);
 }}
 for(const block of blocks.slice(0,100)){
   if(!block||typeof block.kind!=='string')continue;
   let el;
   if(block.kind==='paragraph')el=document.createElement('p');
   else if(block.kind==='heading')el=document.createElement(block.level<=2?'h3':'h4');
   else if(block.kind==='quote')el=document.createElement('blockquote');
   else if(block.kind==='code'){el=document.createElement('pre');const code=document.createElement('code');code.textContent=String(block.code||'');el.appendChild(code);}
   else if(block.kind==='list'){el=document.createElement(block.ordered?'ol':'ul');for(const item of (block.items||[]).slice(0,100)){const li=document.createElement('li');fill(li,item);el.appendChild(li);}}
   else continue;
   if(block.kind!=='list'&&block.kind!=='code')fill(el,block.spans);
   root.appendChild(el);
 }
 return root;
}
function add(kind,text,blocks){const el=document.createElement('div');el.className='message '+kind;const label=document.createElement('b');label.textContent=kind==='user'?'Você':kind==='error'?'Erro':'Sai-nii';el.append(label,contentNode(kind,text,blocks));$('messages').appendChild(el);$('messages').scrollTop=$('messages').scrollHeight}
function busy(value){$('busy').textContent=value?'Sai-nii está consultando seu modelo local…':'';$('send').disabled=value;$('analyze').disabled=value;$('architecture').disabled=value;$('sendRelease').disabled=value}
$('send').addEventListener('click',()=>{const text=$('question').value.trim();if(!text)return;add('user',text);$('question').value='';post('ask',{text})});
$('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){$('send').click()}});
$('analyze').addEventListener('click',()=>post('analyze'));
$('architecture').addEventListener('click',()=>{const text='Explique a arquitetura deste projeto e o papel das pastas e arquivos observados.';add('user',text);post('architecture')});
$('release').addEventListener('click',()=>{$('releaseForm').style.display='block';$('questionBox').style.display='none'});
$('cancelRelease').addEventListener('click',()=>{$('releaseForm').style.display='none';$('questionBox').style.display='block'});
$('sendRelease').addEventListener('click',()=>post('requestSolution',{attempt:$('attempt').value.trim(),blocker:$('blocker').value.trim(),explicit:true}));
$('memory').addEventListener('click',()=>post('viewMemory'));
$('clearProject').addEventListener('click',()=>post('clearProjectMemory'));
$('clear').addEventListener('click',()=>post('clearMemory'));
window.addEventListener('message',event=>{const m=event.data;if(!m||typeof m!=='object')return;
 if(m.type==='busy')busy(Boolean(m.value));
 if(m.type==='assistant'){add('assistant',m.text,m.blocks);$('releaseForm').style.display='none';$('questionBox').style.display='block'}
 if(m.type==='error')add('error',m.text);
 if(m.type==='notice')add('assistant',m.text);
 if(m.type==='memory')add('assistant',m.text);
});
add('assistant','Qual parte do seu projeto você gostaria de entender melhor?');
</script></body></html>`;
}

/** Whitelisted markdown structure: webview creates DOM nodes with textContent, never innerHTML. */
export function assistantBlocks(text: string) { return parseMarkdown(text); }
