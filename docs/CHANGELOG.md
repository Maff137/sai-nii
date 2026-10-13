## 0.2.7 (refinement — distinguish related technical concepts)

- Follow real-device review: Qwen correctly rejected automatic parallelism from source modules but overgeneralized about JavaScript thread limits and mandatory synchronization. These claims require precise conditions.
- Add general teaching guidance to distinguish concepts and execution environments, avoid categorical statements without evidence, and prefer accurate concise explanations to unsupported enumerations.
- Add synthetic misconception conversations about Web Workers/Worker Threads versus single-threaded execution, async/await versus CPU parallelism, and optional synchronization for independent tasks.
- Human-readable criteria and watch terms remain review indicators only; the benchmark does not certify factual correctness or grade learners.
- No change to network permissions, privacy, automatic code editing, or default benchmark length.

## 0.2.7 (candidate — technical-review probes and misconception handling)

- The offline benchmark now has synthetic misconception probes (code modularity does not automatically cause parallelism; `git commit` does not publish to GitHub), plus an experimental English probe.
- Each scenario may specify reviewer-only guidance, watch terms and an expected indication that a false premise was challenged. These are **review triggers**, not fact-checking results or student grades.
- `--show-rubric` prints human-facing review criteria without showing model answers. No reference answers or review rubrics are included in model prompts, and answers remain hidden by default.
- Results separately count technical-review flags versus relevance, language and response-origin indicators. Existing three-scenario default remains unchanged.
- The conversational system prompt more explicitly corrects false premises and distinguishes causal guarantees from possible benefits. No code editing, background analysis, new network destination or model dependency.
- Tests cover the previously observed modularization/parallelism explanation, false positives, Git `commit` vs `push`, opt-in output and evaluator privacy.
- No automated method here proves semantic correctness; full VS Code compile/integration and real-Qwen behavior require validation on the developer's machine.

## 0.2.6 (patch — evaluation and project-tree classifier)

- Fix architecture overview in VS Code Extension Host: unify request recognition with the retrieval decision so the user's informal question about organized project files loads a bounded folder tree.
- Keep source-file modularization questions separate from directory-structure questions.
- Fix a false benchmark alert for Portuguese accented terms (e.g., `módulos` vs `modul`) without claiming that keyword coverage measures truth.
- Add a general tutoring constraint: code modularity does not automatically imply parallel execution, higher speed or runtime isolation.
- Add regression tests for the real screenshot prompt and the real benchmark output. Full VS Code integration and a real model run must still be verified on the user's Mac.

# Sai-nii — Changelog

## 0.2.6 (candidate — offline pedagogical evaluation)

- Adds a reproducible, opt-in local-model benchmark with synthetic PT-BR informal questions, natural follow-ups, concepts from Git and Rust, ambiguous questions, and an experimental English conversation.
- Uses the production `DISCUSSION_SYSTEM`, informal interpretation helper, and `resolveDiscussion` validation/retry path. The benchmark does not use a real VS Code workspace and is not an end-to-end test of the extension.
- Logs only case IDs, response origin, rejection categories, elapsed time and approximate coverage/language indicators. Raw model responses are not printed by default and nothing is saved to disk. `--show-answers` opts in to local console printing of benchmark answers.
- No external APIs, telemetry, keys, background jobs or project scans. Requests to an already running model are confined to `127.0.0.1` on a validated port.
- Indicators cannot prove correctness, truthfulness, language proficiency or teaching quality; human review is essential.
- The optional English case is a baseline for future development, not a claim of English proficiency.

## 0.2.5 (candidate — conversational robustness)

- General Portuguese chat abbreviations get an auxiliary interpretation; the original question remains unchanged. Code and inline code are not rewritten.
- Conceptual questions with no source file open no longer scan the repository or send an irrelevant file tree to the model. Architecture requests still use safe read-only workspace evidence.
- Accept brief but meaningful explanations instead of discarding every answer shorter than 55 characters. Retry instructions guide natural interpretation rather than demanding formal wording.
- Add a local VS Code diagnostic output channel with only rejection category, attempt and reply origin; no raw prompt/model output is logged.
- Generic failure notices are not stored in the model's conversational history, reducing repetitive failure loops.
- Does not claim general language understanding or full offline model installation. Verify behavior with local Qwen.

# Changelog

## 0.2.4 (candidate — natural conversation and safe Markdown)

- Replaces root-workspace architecture-only conversation routing with a general conceptual explanation path, using previous turns only to resolve follow-up references.
- Rejects copied learner questions and repeated answers; retries with a specific instruction about the latest request, without a special-case rule per programming topic.
- Uses compact auxiliary context for natural conceptual follow-ups instead of flooding the local model with repository documentation. Only provides deterministic project-tree summaries for actual structure questions; other failures are explicitly reported rather than masked by unrelated directory explanations.
- Renders a safe, intentionally limited Markdown subset in the webview: paragraphs, headings, bold, emphasis, lists, blockquotes, inline code and fenced code. All text is inserted with textContent, never innerHTML; raw HTML and links are not executed.
- Limits contextual history and model output length for more concise conversational answers. No change to source editing permissions, model runtime or cloud/network behavior.
- Includes tests for natural follow-ups, repetition, offline transport failure, markdown, malicious HTML content and output bounds.


## 0.2.3 (candidate — multi-turn source-file architecture)

- Recognizes informal follow-ups comparing one giant source file with smaller modules, even when no editor is open.
- Model answers must address code decomposition rather than restating the role of project folders; conceptually useful answers do not need to mention unrelated filenames.
- Targeted retry and bounded deterministic recovery teach why splitting source files helps, with tradeoffs for small programs and over-fragmentation.
- Regression tests reproduce the user's original wording and demonstrate that a generic folder summary is rejected.


## 0.2.2 (candidate — architecture tutoring quality)

- Rejects the exact learner question being returned verbatim or near-verbatim as an architecture "answer" (real-device regression).
- For questions about *why* code is organized, requires a causal explanation, not only a list of folder purposes.
- For explicit "what if everything were in one folder" questions, requires the response to address that comparison.
- Retries one weak model reply with an explicit instruction to explain benefits and tradeoffs; thereafter provides a grounded, language-neutral explanation using observed paths.
- Deterministic recovery now explains the practical tradeoffs of separating source, tests, documentation and configuration; distinguishes observed paths from inferred motivations; avoids Markdown markup that would display literally in the VS Code panel.
- Adds regression tests for verbatim echoes, reformulations, valid explanations, superficial lists and secret-file path filtering.
- Does not claim LLM semantic correctness; full VS Code and real Qwen integration still require validation on the development machine.


## v0.2.1 — Architecture response recovery

- Project architecture answers use natural explanatory prose instead of the short JSON schema designed for code hints.
- Architecture fallback now describes actually observed folders and manifests, including how implementation, tests and documentation are separated; it never repeats a generic refusal.
- Later questions receive a different, deeper explanation when the model is unable to help.
- The context sent to the 4K-token local model is smaller; a bounded list of paths is retained only for grounded, on-demand fallback.
- Does not claim full dependency tracing or proficiency in every programming language.



## 0.2.0 (candidate — architecture of a trusted workspace)

- Architecture/organization questions work with only the trusted project root open; there is no need to select or copy a file tree.
- Added a manual `Arquitetura do projeto` action and natural-language recognition of architecture questions.
- Builds a compact, finite directory outline and reads short sections of up to four conventional docs, manifests and entry points, without executing them.
- Language-neutral path indexing and representative tests for Python, JS/TS, Go, Rust, Java, C#, Swift and unknown languages. This is NOT a guarantee of equal model proficiency in every language.
- Uses a longer structured response for architectural explanations, distinguishing observations from likely conventions and explicitly admitting uncertainty.
- Root-level chats are isolated by workspace identity; clearing a project's memory also clears its in-session history.
- Adds a VS Code Extension Host test with a disposable project to check architecture context with no editor open.
- Only user-invoked, offline-to-loopback, read-only inspection. Folder names and small snippets remain untrusted local context. No full project index, source edits or autonomous scans.
- Unit tests pass on pure modules locally; full extension compilation and GUI integration require validation on the developer's Mac.

## 0.1.1 (candidate — cross-file project context)

- Context can include up to two related source files referenced by imports or explicitly mentioned in the learner's question.
- Supports path-based references without a programming-language-specific parser; Python and TypeScript/JavaScript scenarios covered by tests.
- Limits each related file to 128 KB on disk, extracts short line-numbered snippets, and caps total additional context.
- Confines reads to the trusted workspace: ignores sensitive filenames, generated folders, likely binary files, and symlinks escaping the workspace.
- No edits, background scanning, arbitrary command execution, hosted model calls, or changes to the model runtime.
- Not a full semantic index or dependency graph. Large workspaces and indirect dependencies will require further work.


## 0.1.0 (development)

- Socratic guidance may contain zero or one question; no forced questions.
- Per-workspace offline learning history: topics, difficulty signals, response origin and retention across sessions.
- No code, raw questions, or file paths stored in the new learning history. Existing v1 question notes are sanitized and migrated.
- Project-scoped and complete deletion controls with confirmation.
- Isolated chat histories by open file and project to avoid leaking conversational context across workspaces.
- Added regression tests and a separately runnable VS Code Extension Host smoke test.
- Does not include a bundled GGUF/runtime or prove automatic tests are safe to execute.

## 0.0.5 — Recuperação pedagógica sem erros bloqueantes (pré-alfa)

- A resposta inválida do modelo recebe uma segunda tentativa com instruções específicas.
- Se falhar novamente, a extensão utiliza uma pista pedagógica local, segura e contextual, em vez de encerrar a conversa com erro de repetição.
- As pistas recuperadas são graduais e não mostram valores encontrados no código.
- Preserva a autorização especial para soluções completas.
- Adiciona testes de regressão para as duas perguntas reais sobre `setInterval`.
- Não altera o formato dos modelos, execução do llama-server ou o gerenciamento da memória.

## v0.0.4 — New hints and contextual source focus

- The learner no longer receives repeated generic definitions on blocked turns: a new, concrete `hint` is mandatory and displayed instead of a repeated `observation`.
- Both duplicated questions and highly similar explanations trigger a retry; no generic fallback masquerades as a contextual answer.
- Source context prioritizes the actual code symbol mentioned in the conversation and includes line numbers, within a bounded local context window.
- The model is told not to invent timing values or execution behavior absent from source.
- Adds regression tests for the exact feedback received in the `setInterval` pilot.

## v0.0.3 — Socratic follow-up progression

- Detects explicitly stated confusion automatically; students do not need to request the Socratic method each turn.
- Gives the local model explicit, progressively more concrete guidance based on the previous question.
- Rejects repeated/near-duplicate questions; tries one corrected generation, then reports an error instead of pretending to advance.
- Puts the current student's question after project context to avoid it being drowned out by large files.
- Adds targeted unit tests for confusion recognition, hint progression, and question repetition.

# Sai-nii - Change log

## 0.0.2 - Fix de resposta pedagógica

- Confirmação de resposta JSON estruturada usando gramática do `llama.cpp`.
- Remove a resposta genérica que simulava orientação sem analisar código.
- Professor diferencia pedidos de compreensão de pedidos de depuração.
- Erros de formato aparecem como erro explícito; nenhuma resposta inválida é apresentada como orientação.
- Teste unitário para JSON cercado por Markdown.

Ainda é uma versão de desenvolvimento. Não foi validada uma conversa real com o Qwen2.5-Coder no Mac do usuário.
