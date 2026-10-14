## Current candidate: v0.2.12 — Multi-language offline evaluation

Sai-nii now offers a **source-guidance evaluation suite** with five entirely fictional snippets in **Python, JavaScript, Go, Rust, and Java**. This is separate from the existing conceptual-discussion evaluation. It exercises the same structured JSON guidance parser, progressive hint plan and safe fallback used by the VS Code extension, with a simulated open editor.

```bash
cd extension
npm test
npm run test:integration
npm run evaluate:local -- --list-cases
npm run evaluate:local -- --case source-python --show-answers --show-rubric
npm run evaluate:local -- --suite source --show-rubric
```

A v0.2.12 evaluation hotfix improves guided follow-up routing, distinguishes source declarations from calls in safe fallbacks, and reports per-attempt rejection reasons. For a Python failure, use `--case source-python --show-rejected` to inspect only **synthetic** rejected generations. The Java follow-up remains in guidance even when it asks *why*.

A full `--suite source` run tests all five snippets and may take several minutes on a 7B local model. Use a single `--case` for initial validation. `--suite discussion` runs the existing concept cases. Default execution still runs just three scenarios; `--limit N` selects a shorter prefix of the chosen suite. Everything runs against `127.0.0.1` and the test does **not** execute snippet code, inspect your actual workspace, access GitHub, or contact a remote server. Raw model answers and rejected attempts are only printed if explicitly requested (`--show-answers`/`--show-rejected`) and are not saved to a report.

**Important:** The suite measures observable signals, retries, routing, language and safe JSON structure. It does **not** establish whether technical claims, examples or hints are factually correct. Review the human rubric and answers for correctness. The source suite is a fixed synthetic simulation, not an end-to-end test of real files or a guarantee of protection against solution leakage.

## Development status

**Pre-alpha v0.2.12 (developer preview).** The extension provides a sidebar, reads bounded context from the active file and local Git repository when relevant, calls an already running local `llama.cpp` server on loopback, and implements an initial solution-release gate and local project-scoped memory. It is not yet a one-click installer, comprehensive technical fact checker, or validated full release. See [product specification](docs/Sai-nii_SPEC_v1.1.md) and [implementation notes](docs/DEVELOPMENT.md).

## Try the development extension

1. Install Node.js (20+) and Visual Studio Code on the **development machine**.
2. From `extension/`, run `npm install`, then `npm test`.
3. Open `extension/` in VS Code and press **F5** (Run Extension).
4. In the new VS Code window, open a **trusted** local project and use the **Sai-nii** sidebar.
5. For model responses, run a trusted `llama-server` executable locally with a GGUF model, bound to `127.0.0.1:8080` (example in development notes).

No model, binaries, or service is automatically downloaded in this foundation version. The future packaged extension will automate the runtime/model setup. The app does not require GitHub to read local Git history.

## Principles

- **On demand only**: no unsolicited interruptions or background code review.
- **Read-only**: no project edits, terminal commands, commits, or tests are performed by the tutor.
- **Socratic**: concise questions and small hints; no ready-made solution without an explicit gated request.
- **Offline first**: requests go only to a configurable **loopback port**; no hosted API endpoints.
- **Private context**: project content is ephemeral prompt context and is not copied into the learning-memory store.
- **Local memory**: small session notes persisted on the machine, with a clear-data control.

## License

MIT. See [LICENSE](LICENSE).

## v0.1.0 local learner history

The **Ver memória** command now shows per-project topic and difficulty counts. You can remove one project's memory (**Apagar projeto**) or all Sai-nii memory (**Apagar tudo**). The system does not assign grades, assume mastery, or store code and full questions in the new history. Older raw-question notes are sanitized during migration. A local model reply may include **zero or one** Socratic question depending on what best helps you learn.

For developer testing: `npm test`. A separate optional VS Code Extension Host smoke test is available via `npm run test:integration`; the first run may download a VS Code runtime. Neither test needs the llama-server running. See [development notes](docs/DEVELOPMENT.md).


## v0.2.0 — Entender a arquitetura sem abrir arquivos

Na janela **Extension Development Host**, abra a **pasta raiz confiável** do projeto e clique em **Arquitetura do projeto** na barra do Sai-nii. Também pode simplesmente perguntar "Por que as pastas e arquivos deste código são organizados assim?". Não precisa abrir um arquivo, capturar screenshots ou copiar uma árvore. O Sai-nii usa a estrutura visível do workspace e amostras limitadas de documentação/configuração/pontos de entrada para oferecer hipóteses fundamentadas, distinguindo fatos de convenções. Sem alterações ou execução automática de código.

A seleção de arquivos é neutra em relação à linguagem, mas **nenhum modelo pequeno garante proficiência equivalente em todas as linguagens**. O entendimento semântico profundo, frameworks e repositórios muito grandes ainda precisam de melhorias. O Qwen local deve estar em execução para gerar respostas; a compilação/testes não dependem dele.

## v0.2.2 — Architectural explanation quality

When asked why folders are organized in a particular way, Sai-nii now rejects echoed user prompts and shallow folder-only responses. It asks the local model to explain tradeoffs, and if needed produces a bounded, evidence-based fallback that contrasts separate folders with a flat layout. No code is written or executed.

## v0.2.4 — Conversas e Markdown

Com a pasta raiz aberta, o professor responde dúvidas conceituais espontâneas sem exigir que o aluno selecione ou descreva arquivos. A árvore do projeto é um apoio, não uma resposta-padrão: perguntas de arquitetura usam evidências mais completas, e perguntas gerais usam um contexto resumido. O modelo local ainda pode produzir explicações ruins; validações detectam apenas erros evidentes, como repetição literal.

A interface exibe um subconjunto de Markdown (títulos, negrito, itálico, listas, citações e blocos de código). HTML bruto, links clicáveis e imagens não são interpretados. Texto recebido do modelo nunca é executado como HTML. A qualidade das explicações em linguagens diferentes continua dependendo do modelo local e da cobertura de análise contextual.


## Evaluation harness (v0.2.6 candidate)

Run `cd extension && npm run evaluate:check` for deterministic harness tests without a model. With an existing `llama-server` running locally, `npm run evaluate:local` runs three synthetic scenarios (natural PT-BR questions and follow-ups) against the local model. The optional English scenario is experimental: `npm run evaluate:local -- --case en-encapsulation`. Only aggregate indicators are printed by default. See `docs/DEVELOPMENT.md` for limitations and privacy constraints.

## Technical review probes (v0.2.7 candidate)

The offline evaluation harness can test how the tutor handles **incorrect assumptions**, rather than just measuring word coverage. For example:

```shell
cd extension
npm run evaluate:local -- --case pt-modulos-premissa --show-rubric --show-answers
```

These flags are **not an automated fact checker**; any flagged or unflagged answer still needs human evaluation. No rubric is passed to the model, and answers are not printed unless requested. Details: `docs/DEVELOPMENT.md`.

## v0.2.8 — English and Portuguese conversational explanations

Sai-nii now chooses the spoken explanation language from the learner's question, not from the language of the open source code. English questions receive English-oriented model instructions; informal PT-BR continues in Portuguese. Short ambiguous follow-ups retain the last spoken language for that project/file during the session. Explicit requests such as "responda em inglês" or "answer in Portuguese" override automatic selection.

This covers conceptual conversation, editor-based Socratic hints and the explanation of an explicitly authorized solution. Source identifiers are not translated; no user conversations are persisted for language selection. The default interface and static buttons remain in Portuguese. Fluency depends on the local model; language identification is conservative and not a universal language detector.

Offline checks: `cd extension && npm test` and `npm run test:integration`. For the live local model, use `npm run evaluate:local -- --case pt-en-switch --show-answers` or `--case en-pt-switch --show-answers`. Benchmarks use fictional prompts, and answers print only when explicitly requested.


Diagnostic for fixed offline synthetic benchmarks: `cd extension && npm run evaluate:local -- --case pt-en-switch --show-answers --show-rejected`. Rejected model content is displayed only with explicit opt-in in the terminal; do not use it for private prompts.


## v0.2.8 — Explanatory code examples (candidate)

Conceptual tutoring can now display short, independent code examples that teach a concept. This is distinct from giving the learner the solution to a concrete project task, which remains gated by an explicit request, a substantive attempt and a blocker. The code is rendered as inert text, never executed or written to the workspace. The small heuristic checker is a limited safeguard, not a semantic guarantee.


Development note: v0.2.10 evaluates evidence-grounded reviews of previous examples; technical-review flags are indicative, not automatic proof of truth.

### v0.2.10 (candidate) — revisão crítica fundamentada

As análises de limitações devem referir-se ao construtor e às condições presentes no exemplo real da conversa. O benchmark sintético sinaliza saídas de execução alegadas para revisão humana, sem afirmar que detecta automaticamente a verdade de uma explicação.


### v0.2.11 — Roteamento por intenção

Dúvidas sobre conceitos seguem o professor conversacional, mesmo com um editor aberto, sem ler o arquivo por padrão. Pedidos de análise do código ou execução de uma tarefa mantêm o modo de pistas, condicionado à presença de um arquivo do projeto. Perguntas arquiteturais usam a visão da raiz. A seleção do modo é heurística conservadora, não uma análise semântica ou autorização para fornecer soluções.


### Ajustes de avaliação v0.2.12 (revisão de pistas)

O fluxo de pistas aceita uma primeira pergunta segura de um JSON com perguntas múltiplas, sem exibir as perguntas excedentes. O relatório do benchmark sinaliza `pergunta_ajustada` quando isso ocorre; respostas detectadas claramente em idioma diferente do solicitado são rejeitadas e reformuladas. Estas regras não avaliam automaticamente a veracidade da explicação, e nenhum arquivo é modificado pelo tutor.

#### v0.2.12 — resposta completa e pistas progressivas (candidato)
- Impede cortar explicações socráticas em palavras ou frases incompletas; preserva somente frases terminadas dentro do limite, ou solicita reformulação.
- Verifica conteúdo de código proibido antes de reduzir o tamanho da resposta, não apenas no trecho exibido.
- Quando o aluno está bloqueado, preserva uma pista nova mesmo se a pergunta adicional repetir a anterior; a pergunta repetida não é exibida.
