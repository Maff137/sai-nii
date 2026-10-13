'use strict';
/** Fictional prompts only. Never use private workspace content in this suite. */
const scenarios = [
  {
    id: 'pt-encapsulamento-informal', language: 'pt', label: 'Português informal e seguimento',
    turns: [
      { prompt: 'poderia me explicar oq é encapsulamento e pq usam isso?', signals: [/encapsul|estado|dados|classe|atributo/i, /acesso|prote|control|escond|ocult|interno/i] },
      { prompt: 'e qual a diferença disso pra abstração?', signals: [/abstra|simplific|essencia/i, /encapsul|acesso|estado|interno|ocult/i] }
    ]
  },
  {
    id: 'pt-modulos-informal', language: 'pt', label: 'Mudança de foco no diálogo',
    turns: [
      { prompt: 'por que dividir um programa em módulos?', signals: [/modul|arquiv|responsabil|componente/i] },
      { prompt: 'e pq nao botar tudo em um unico arquivo? eh a mesma coisa?', signals: [/arquiv|modul|codigo/i, /manuten|organiza|pequen|grande|reutiliz|separ/i] }
    ]
  },
  {
    id: 'pt-git', language: 'pt', label: 'Conceito novo sem contexto',
    turns: [{ prompt: 'oq um git commit faz?', signals: [/commit|git/i, /mudanc|vers|hist[oó]r|registro|salv/i] }]
  },
  {
    id: 'pt-rust', language: 'pt', label: 'Conceito de outra linguagem',
    turns: [{ prompt: 'em Rust, pq existe o borrow checker?', signals: [/rust|borrow|emprest|referenc/i, /mem[oó]ria|acesso|segur|propried|ownership|alias/i] }]
  },
  {
    id: 'pt-ambiguidade', language: 'pt', label: 'Incerteza legítima',
    turns: [{ prompt: 'pq isso tá errado?', signals: [] }]
  },
  {
    id: 'en-encapsulation', language: 'en', experimental: true, label: 'Inglês — requisito futuro',
    turns: [
      { prompt: 'What is encapsulation in programming, and why use it?', signals: [/encapsul|data|state|class/i, /access|protect|control|private|hidden/i] },
      { prompt: 'How is it different from abstraction?', signals: [/abstract|simplif|essential/i, /encapsul|internal|access|hide/i] }
    ]
  }
];
module.exports = { scenarios };
