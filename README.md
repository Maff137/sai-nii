## Current candidate: v0.2.8 — Prevent incomplete explanations

- Checks the local model's `finish_reason` for output-token cutoffs in conceptual discussions and the offline benchmark. A cut-off answer is rejected instead of shown as finished.
- Retries with shorter, complete wording after a cutoff; no code-dump workaround and no changes to solution authorization.
- Keeps independent teaching examples for conceptual questions. Does not claim semantic/factual verification or multilingual parity across models.
- The model should normally use concise explanations instead of huge code-heavy lists. All results still require full TypeScript and VS Code integration validation on the user's Mac.

# Sai-nii

**An offline, Socratic programming tutor inside Visual Studio Code.**

Sai-nii is an open-source project focused on helping you reason about **your own code**, not writing it for you. It aims to work on macOS, Windows, and Ubuntu with local models and no account or cloud API.

## Development status

**Pre-alpha v0.2.8 (developer preview).** The current extension provides a sidebar, reads bounded context from the active file and local Git repository, calls an *already running* `llama.cpp` OpenAI-compatible server on loopback, and implements an initial solution-release gate and a local, project-scoped memory of learning interactions. Unlike earlier versions, Socratic questions are not mandatory on every turn. This is not yet a one-click installer, a full pedagogical engine, or a validated release. See [product specification](docs/Sai-nii_SPEC_v1.1.md) and [implementation notes](docs/DEVELOPMENT.md).

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
