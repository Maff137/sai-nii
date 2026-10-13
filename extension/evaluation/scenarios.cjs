'use strict';
/** Fictional prompts, no project/user data. Rubrics are LOCAL to the evaluator
 * and are deliberately never passed to the tested model.
 */
const scenarios = [
  {
    id: 'pt-encapsulamento-informal', language: 'pt', label: 'Português informal e seguimento',
    turns: [
      { prompt: 'poderia me explicar oq é encapsulamento e pq usam isso?',
        signals: [/encapsul|estado|dados|classe|atributo/i, /acesso|prote|control|escond|ocult|interno/i],
        technicalReview: { rubric: ['Encapsulamento controla como se acessa ou altera o estado; não significa criptografia, nem proteção absoluta.', 'O aluno pediu explicação natural: o exemplo deve ser útil sem confundir encapsulamento e abstração.'] } },
      { prompt: 'e qual a diferença disso pra abstração?',
        signals: [/abstra|simplific|essencia/i, /encapsul|acesso|estado|interno|ocult/i],
        technicalReview: { rubric: ['Abstração expõe o essencial; encapsulamento controla o acesso/agrupamento da implementação e do estado.', 'São conceitos relacionados, mas não sinônimos.'] } }
    ]
  },
  {
    id: 'pt-modulos-informal', language: 'pt', label: 'Mudança de foco no diálogo',
    turns: [
      { prompt: 'por que dividir um programa em módulos?', signals: [/modul|arquiv|responsabil|componente/i],
        technicalReview: {
          rubric: ['A divisão pode melhorar organização, manutenção e testes; não garante paralelismo ou ganho de desempenho.', 'Um único arquivo pode ser adequado em programas pequenos; divisão excessiva também tem custos.'],
          watch: [{ id: 'parallelism_needs_context', pattern: /paralel|simultane|concorr[êe]n/i }]
        } },
      { prompt: 'e pq nao botar tudo em um unico arquivo? eh a mesma coisa?',
        signals: [/arquiv|modul|codigo/i, /manuten|organiza|pequen|grande|reutiliz|separ/i],
        technicalReview: { rubric: ['Responder sobre um arquivo versus múltiplos arquivos; não voltar apenas a listar pastas.', 'Não transformar modularização numa obrigação universal.'] } }
    ]
  },
  {
    id: 'pt-git', language: 'pt', label: 'Conceito novo sem contexto',
    turns: [{ prompt: 'oq um git commit faz?', signals: [/commit|git/i, /mudanc|vers|hist[oó]r|registro|salv/i],
      technicalReview: { rubric: ['git commit registra uma versão no repositório local; git push envia commits ao remoto.', 'Commit não publica automaticamente as alterações no GitHub.'],
        watch: [{ id: 'remote_claim_needs_context', pattern: /github|remot|nuvem|enviad|publicad/i }] } }]
  },
  {
    id: 'pt-rust', language: 'pt', label: 'Conceito de outra linguagem',
    turns: [{ prompt: 'em Rust, pq existe o borrow checker?', signals: [/rust|borrow|emprest|referenc/i, /mem[oó]ria|acesso|segur|propried|ownership|alias/i],
      technicalReview: { rubric: ['Borrow checker verifica regras de empréstimo/referências em tempo de compilação.', 'Não é um garbage collector e não elimina todos os tipos possíveis de erro.'],
        watch: [{ id: 'garbage_collection_needs_context', pattern: /garbage.collect|coletor.de.lixo/i }] } }]
  },
  {
    id: 'pt-ambiguidade', language: 'pt', label: 'Incerteza legítima',
    turns: [{ prompt: 'pq isso tá errado?', signals: [],
      technicalReview: { rubric: ['Não fingir que viu código ou erro não fornecido.', 'Solicitar contexto específico, como mensagem de erro ou trecho, sem inventar uma causa.'] } }]
  },
  {
    id: 'en-encapsulation', language: 'en', experimental: true, label: 'Inglês — teste bilíngue',
    turns: [
      { prompt: 'What is encapsulation in programming, and why use it?', signals: [/encapsul|data|state|class/i, /access|protect|control|private|hidden/i],
        technicalReview: { rubric: ['Answer in English and explain controlled access, not encryption or guaranteed security.'] } },
      { prompt: 'How is it different from abstraction?', signals: [/abstract|simplif|essential/i, /encapsul|internal|access|hide/i],
        technicalReview: { rubric: ['Compare the two concepts, carry context from the previous exchange, answer in English.'] } }
    ]
  },
  {
    id: 'pt-en-switch', language: 'pt', label: 'Português para inglês na mesma conversa',
    turns: [
      { prompt: 'oq é encapsulamento e pq usamos isso?', signals: [/encapsul|estado|acesso|classe/i],
        technicalReview: { rubric: ['Explain in Brazilian Portuguese; avoid conflating abstraction and encapsulation.'] } },
      { prompt: 'Could you explain that again in English, with a simple example?', signals: [/encapsul|access|state|data|object/i],
        technicalReview: { rubric: ['Switch to English even though the previous turn is Portuguese; retain the concept of encapsulation.'] } },
      { prompt: 'e como isso se diferencia de abstração?', signals: [/abstra|encapsul|estado|acesso|essencia|simplific/i],
        technicalReview: { rubric: ['Switch back to Portuguese naturally and compare the two concepts.'] } }
    ]
  },
  {
    id: 'en-pt-switch', language: 'en', label: 'English to Portuguese, with technical identifiers',
    turns: [
      { prompt: 'What does async/await do in JavaScript?', signals: [/async|await|promise|asynchron/i],
        technicalReview: { rubric: ['Answer in English. Do not mistake async/await for CPU parallelism.'] } },
      { prompt: 'agora me explica em português, por favor', signals: [/async|await|assincron|promess|espera|opera/i],
        technicalReview: { rubric: ['Answer in Portuguese and preserve context and exact technical terms.'] } }
    ]
  },
  {
    id: 'pt-modulos-premissa', language: 'pt', label: 'Corrigir premissa: módulos e execução',
    turns: [{ prompt: 'Se eu separar meu código em módulos, tudo vai rodar em paralelo e ficar mais rápido automaticamente?',
      signals: [], technicalReview: {
        rubric: ['Deve rejeitar a ideia de que separar arquivos/módulos torna o código automaticamente paralelo ou mais rápido.', 'Explicar que paralelismo requer mecanismos e condições de execução próprios.'],
        challenge: { signals: [/n[aã]o|nao|incorret|fals|nem.sempre|depende|not.necessarily/i] },
        watch: [{ id: 'parallelism_needs_context', pattern: /paralel|simultane|concorr[êe]n/i }]
      } }]
  },
  {
    id: 'pt-js-workers-premissa', language: 'pt', label: 'Corrigir premissa: JavaScript, threads e assincronismo',
    turns: [
      { prompt: 'Javascript eh single threaded, entao n tem como executar JS em paralelo nem com Web Workers, certo?',
        signals: [], technicalReview: {
          rubric: ['Contestar a impossibilidade absoluta. O fluxo principal costuma ser single-threaded, mas Web Workers no navegador e Worker Threads no Node.js permitem trabalho JavaScript em threads adicionais.', 'Distinguir linguagem, ambiente e execução; nem toda API assíncrona executa JavaScript paralelamente em outra thread.'],
          challenge: { signals: [/n[aã]o|nao|incorret|fals|depende|na.verdade|pode.sim/i] },
          watch: [{ id: 'js_execution_needs_context', pattern: /(?:javascript|js|single.thread|web.workers?|worker.threads?|thread|paralel)/i }]
        } },
      { prompt: 'entendi, e se usar async await isso quer dizer que as funcoes vao rodar ao msm tempo em dois nucleos?',
        signals: [], technicalReview: {
          rubric: ['Explicar que async/await lida com espera e organização do fluxo assíncrono, não cria por si só paralelismo de execução de JavaScript em núcleos distintos.', 'Distinguir concorrência de paralelismo e citar workers como possibilidade, quando pertinente, sem afirmar que toda operação assíncrona é paralela.'],
          challenge: { signals: [/n[aã]o|nao|n[aã]o.necessari|depende|por.si.s[oó]|n[aã]o.garante|not.necessarily/i] },
          watch: [{ id: 'async_parallelism_needs_context', pattern: /(?:async|await|paralel|simultan|concorr)/i }]
        } }
    ]
  },
  {
    id: 'pt-sincronizacao-premissa', language: 'pt', label: 'Corrigir premissa: sincronização em tarefas independentes',
    turns: [{ prompt: 'Se duas tarefas nao compartilham estado nem dados, sempre preciso sincronizar elas com mutex pra executar em paralelo?',
      signals: [], technicalReview: {
        rubric: ['Não afirmar que sincronização ou mutex é obrigatória para todo paralelismo. Tarefas independentes podem ser paralelas sem um mutex compartilhado.', 'Explicar que exclusão mútua e coordenação são necessárias conforme dados/recursos compartilhados e dependências; podem existir outros mecanismos de coordenação.'],
        challenge: { signals: [/n[aã]o|nao|n[aã]o.necessari|depende|sem.mutex|n[aã]o.precis|not.always/i] },
        watch: [{ id: 'synchronization_needs_context', pattern: /(?:sincroniz|mutex|lock|trava|independente)/i }]
      } }]
  },
  {
    id: 'pt-commit-premissa', language: 'pt', label: 'Corrigir premissa: commit e remoto',
    turns: [{ prompt: 'Dei git commit. Isso significa que meus arquivos já estão no GitHub?',
      signals: [], technicalReview: {
        rubric: ['Dizer que git commit é local e não envia por si só ao GitHub.', 'Explicar diferença para git push sem exigir execução de comandos.'],
        challenge: { signals: [/n[aã]o|nao|ainda.n[aã]o|apenas.local|depende/i] },
        watch: [{ id: 'remote_claim_needs_context', pattern: /github|remot|nuvem|enviad|publicad/i }]
      } }]
  },
  {
    id: 'en-modules-premise', language: 'en', experimental: true, label: 'English: challenge false premise',
    turns: [{ prompt: 'If I split my program into several modules, does it automatically run in parallel?',
      signals: [], technicalReview: {
        rubric: ['In English, reject automatic parallelism; explain that separate modules do not schedule concurrent execution.'],
        challenge: { signals: [/no\b|not\b|doesn.t|cannot|depends|false|incorrect|automatically.does.not/i] },
        watch: [{ id: 'parallelism_needs_context', pattern: /parallel|concurr|simultane/i }]
      } }]
  }
  ,{
    id: 'pt-en-same-example', language: 'pt', experimental: true,
    label: 'Continuidade do mesmo exemplo entre idiomas e aprofundamento',
    turns: [
      {prompt:'Me explica encapsulamento com um exemplo pequeno de conta bancária.',
       signals:[/encapsul|estado|dados|saldo/i],
       technicalReview:{rubric:['Explicação breve e concreta de controle do estado, com exemplo de conta bancária. Não entregar uma implementação completa.']}},
      {prompt:'Now explain that in English, using the same bank account example.',
       signals:[/account|balance|deposit|bank/i],
       technicalReview:{rubric:['Responder em inglês, mantendo o mesmo exemplo de conta bancária se tiver aparecido anteriormente. Evitar trocar para um carro ou outra entidade sem necessidade.']}},
      {prompt:'e qual a diferença disso pra abstração? pode ser breve',
       signals:[/abstra|essencia|simplific/i,/encapsul|acesso|interno|estado/i],
       technicalReview:{rubric:['Comparar a nova ideia com o assunto anterior em português e sem repetir toda a resposta inicial.']}}
    ]
  }

];
module.exports = { scenarios };
