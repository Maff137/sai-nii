const {test}=require('node:test');
const assert=require('node:assert/strict');
const {architectureSynopsis}=require('../dist/architecture');
const {acceptableArchitectureReply,resolveArchitecture}=require('../dist/architectureReply');

const paths=[
 'README.md','LICENSE','docs/DEVELOPMENT.md','docs/PRODUCT_DECISIONS_0.1.md',
 'extension/package.json','extension/src/extension.ts','extension/src/context.ts',
 'extension/src/pedagogy.ts','extension/test/architecture.test.cjs',
 'extension/test/integration/suite.cjs','extension/media/icon.svg'
];
const input={messages:[{role:'system',content:'Explique arquitetura'}, {role:'user',content:'Explique arquitetura deste projeto'}],
 observedPaths:paths,learnerText:'Por que este projeto está organizado dessa maneira?'};

test('regression: two failed model turns give concrete project-specific folder roles',async()=>{
 let calls=0;
 const result=await resolveArchitecture({...input,generate:async()=>{calls++;return '{"observation":"Errada"}';}});
 assert.equal(calls,2);
 assert.equal(result.origin,'fallback');
 assert.match(result.text,/docs\//);
 assert.match(result.text,/extension\//);
 assert.match(result.text,/extension\/src\//);
 assert.match(result.text,/extension\/test\//);
 assert.match(result.text,/separa[cç][aã]o|separa|manuten[cç][aã]o|testes/i);
 assert.doesNotMatch(result.text,/modelo local n[aã]o formulou/i);
});

test('architecture followup does not repeat same fallback, adds verified links',async()=>{
 const first=await resolveArchitecture({...input,generate:async()=> 'erro'});
 const second=await resolveArchitecture({...input,generate:async()=> 'erro',previousAnswer:first.text});
 assert.notEqual(first.text,second.text);
 assert.match(second.text,/extension\/src\/.*extension\/test\//);
 assert.match(second.text,/package\.json/);
});

test('model natural prose is preferred over deterministic overview',async()=>{
 let calls=0;
 const prose='A pasta extension contém o código da extensão de VS Code. Dentro dela, src reúne a implementação e test contém testes. A pasta docs registra explicações, e package.json identifica a configuração da extensão. Essa separação facilita manutenção e permite revisar o comportamento em unidades menores.';
 const result=await resolveArchitecture({...input,generate:async()=>{calls++;return prose;}});
 assert.equal(calls,1);
 assert.equal(result.origin,'model');
 assert.equal(result.text,prose);
});

test('retries invalid model output with plain prose, not JSON constraint',async()=>{
 let calls=0;
 const r=await resolveArchitecture({...input,generate:async()=>++calls===1?'invalid':('extension/src contém implementação e extension/test contém testes. '+ 'O projeto mantém documentação em docs, separando conceitos, arquivos do produto e verificação. Isso permite localizar mudanças e reduzir acoplamento entre responsabilidades.')} );
 assert.equal(calls,2);
 assert.equal(r.origin,'retry');
});

test('architecture fallback remains useful when llama-server is unavailable',async()=>{
 let calls=0;
 const r=await resolveArchitecture({...input,generate:async()=>{calls++;throw new Error('fetch failed')}});
 assert.equal(calls,1);
 assert.equal(r.origin,'fallback');
 assert.match(r.text,/README\.md/);
});

test('refuses ungrounded generic answers, JSON, code fences and repetition',()=>{
 assert.equal(acceptableArchitectureReply('MVC significa Model View Controller. Esta arquitetura tem três camadas. '.repeat(3),paths),false);
 assert.equal(acceptableArchitectureReply('{"observation":"extension/src é importante", "question":""}',paths),false);
 assert.equal(acceptableArchitectureReply('```js\nlet secret = 1\n```\n'.repeat(4),paths),false);
 const output='extension/src reúne implementação e extension/test contém testes. A separação segue princípios de manutenção. Essa arquitetura melhora a divisão entre arquivos e responsabilidades.';
 assert.equal(acceptableArchitectureReply(output,paths,output),false);
});

test('role inference never invents MVC or frameworks or code values',()=>{
 const answer=architectureSynopsis(['api/main.py','api/routes.py','tests/test_main.py','Cargo.toml','src/main.rs'], 'Por que pastas assim?');
 assert.match(answer,/api\/|src\/|tests\//);
 assert.doesNotMatch(answer,/MVC|FastAPI|Flask|Spring|microservi[cç]os/);
 assert.doesNotMatch(answer,/config\.env|password/i);
});

test('reported architecture paths do not leak filtered/secret storage names',()=>{
 const answer=architectureSynopsis(['extension/src/main.ts','extension/test/main.test.ts','.env','node_modules/a.js','secrets/token.txt','README.md']);
 assert.doesNotMatch(answer,/node_modules|\.env|secrets\/|token\.txt/);
});

const {echoesLearnerQuestion}=require('../dist/architectureReply');
const actualQuestion='Entendi a função de cada pasta, mas quero compreender as decisões de arquitetura. Por que separar src, test e docs? Quais problemas essa organização resolve e o que aconteceria se todos os arquivos ficassem juntos?';
const actualEcho='Entendi a função de cada pasta, mas quero compreender as decisões de arquitetura. Por que separar `src`, `test` e `docs`? Quais problemas essa organização resolve e o que aconteceria se todos os arquivos ficassem juntos?';

test('real screenshot regression: literal echoed architecture question must never be displayed',async()=>{
 assert.equal(echoesLearnerQuestion(actualEcho,actualQuestion),true);
 assert.equal(acceptableArchitectureReply(actualEcho,paths,'',actualQuestion),false);
 let calls=0;
 const result=await resolveArchitecture({...input,learnerText:actualQuestion,generate:async()=>{calls++;return actualEcho;}});
 assert.equal(calls,2);
 assert.equal(result.origin,'fallback');
 assert.match(result.text,/Por que separar|decisão arquitetural/i);
 assert.match(result.text,/se tudo ficasse na mesma pasta/i);
 assert.match(result.text,/extension\/src\/|extension\/test\//);
 assert.ok(result.text.length>actualQuestion.length*2);
 assert.notEqual(result.text.trim(),actualQuestion.trim());
});

test('detects near-echo even with reordering, introductory words, or backticks',()=>{
 assert.equal(echoesLearnerQuestion('Você perguntou: '+actualEcho,actualQuestion),true);
 assert.equal(echoesLearnerQuestion('Quais problemas essa organização resolve e o que aconteceria se todos os arquivos ficassem juntos? Entendi a função de cada pasta, mas quero compreender as decisões de arquitetura. Por que separar src, test e docs?',actualQuestion),true);
});

test('valid deeper explanation still wins on first generation',async()=>{
 const prose='O diretório extension/src reúne o código, enquanto extension/test guarda testes. Essa separação facilita identificar o que mudou e verificar consequências sem confundir o código executado com a verificação. A pasta docs contém documentação: mantê-la separada ajuda a explicar decisões sem misturar documentação aos módulos. Se tudo estivesse junto, o software poderia funcionar, mas localizar arquivos e revisar alterações se tornaria mais trabalhoso conforme o projeto crescesse.';
 assert.equal(echoesLearnerQuestion(prose,actualQuestion),false);
 const result=await resolveArchitecture({...input,learnerText:actualQuestion,generate:async()=>prose});
 assert.equal(result.origin,'model');
 assert.equal(result.text,prose);
});

test('incoherent mere role list is rejected for an explicit why question',()=>{
 const list='O arquivo extension/package.json contém metadados. extension/src guarda arquivos de implementação. extension/test tem arquivos de testes. docs reúne documentação sobre o projeto. README.md apresenta as informações básicas do sistema.';
 assert.equal(acceptableArchitectureReply(list,paths,'',actualQuestion),false);
});

test('fallback remains language-neutral and explains tradeoffs for other project styles',()=>{
 const answer=architectureSynopsis(['Cargo.toml','src/main.rs','tests/workflow.rs','README.md'],'Por que separar source e tests? E se tudo junto?');
 assert.match(answer,/src\//);
 assert.match(answer,/tests\//);
 assert.match(answer,/se tudo ficasse na mesma pasta/i);
 assert.doesNotMatch(answer,/Visual Studio Code|Python|FastAPI|Node\.js/);
});

test('a request comparing flat vs separated folders requires addressing the tradeoff',()=>{
 const answer='extension/src contém a implementação e extension/test contém os testes. Isso facilita separar componentes e localizar documentos na pasta docs. A organização permite identificar rapidamente quais arquivos precisam de revisão. A separação ajuda a equipe a manter responsabilidades em módulos próprios.';
 assert.equal(acceptableArchitectureReply(answer,paths,'',actualQuestion),false);
});

test('sensitive .env variants are not listed by deterministic architecture rescue',()=>{
 const answer=architectureSynopsis(['.env.production','docs/README.md','src/main.ts','tests/test_main.ts'], 'Por que separados?');
 assert.doesNotMatch(answer,/env.production|segredos|passwords/);
});

const actualSingleFileQuestion = 'e porque nao colocam todo o código em apenas um arquivo? pelo mesmo motivo?';

test('single-file follow-up rejects generic answers about src/test/docs folders', () => {
  const generic = 'A pasta extension/src tem código e extension/test tem testes, enquanto docs guarda documentação. Essa organização facilita manutenção, navegação e permite localizar os arquivos corretamente no projeto. Separar essas pastas evita misturar implementação e documentação.';
  assert.equal(acceptableArchitectureReply(generic, paths, '', actualSingleFileQuestion), false);
});

test('short contextual explanation of one vs many source files is accepted without unrelated folder listing', async () => {
  const useful = 'Sim. Dividir o código em vários arquivos permite agrupar funções e módulos por responsabilidade, facilitando navegação, manutenção e testes. Um único arquivo funciona em programas pequenos, mas fica difícil de modificar quando o código cresce. Dividir demais também complica o projeto.';
  assert.equal(acceptableArchitectureReply(useful, paths, '', actualSingleFileQuestion), true);
  const output = await resolveArchitecture({...input, learnerText: actualSingleFileQuestion, generate: async () => useful});
  assert.equal(output.origin, 'model');
  assert.equal(output.text, useful);
});

test('real-world small model failure routes to focused one-file fallback rather than folder overview', async () => {
  let calls=0;
  const output=await resolveArchitecture({...input,learnerText: actualSingleFileQuestion,
    previousAnswer:'A pasta src contém código, test contém testes e docs contém a documentação.',
    generate:async () => { calls++; return 'extension/src reúne código, extension/test tem testes e docs guarda documentação. Isso facilita manutenção e colaboração.'; }});
  assert.equal(calls,2);
  assert.equal(output.origin,'fallback');
  assert.match(output.text,/único arquivo/i);
  assert.match(output.text,/funções|módulos/i);
  assert.match(output.text,/pequeno|pequena/i);
  assert.doesNotMatch(output.text,/E se tudo ficasse na mesma pasta\?/i);
  assert.doesNotMatch(output.text,/Aprofundando a decisão arquitetural/i);
  assert.ok(output.text.length<1800);
});

test('single-file fallback remains language-neutral and does not invent function relationships', () => {
  const answer=architectureSynopsis(['Cargo.toml','src/main.rs','src/lib.rs','README.md'],actualSingleFileQuestion);
  assert.match(answer,/src\/main.rs/);
  assert.match(answer,/src\/lib.rs/);
  assert.doesNotMatch(answer,/Visual Studio Code|Node.js|classes Main|chama a fun[cç][aã]o/i);
  assert.match(answer,/n[aã]o.*confirma|s[oó].*confirmad|exige examinar/i);
});
