## v0.2.12 — Source benchmark routing and diagnostics hotfix (awaiting Mac/Qwen validation)

- Preserve guided-source follow-ups when the learner says they still do not understand and asks for another hint, even when a question includes "why". This corrects the synthetic Java routing interruption without weakening the solution gate.
- Detect source function *definitions* during deterministic fallback instead of describing every symbol as an invoked call. Implementation requests receive a safe, behavior-focused next question rather than a repeated call-arguments prompt.
- Surface the rejection reasons for each generated guidance attempt in the local benchmark. Raw rejected text still requires `--show-rejected` and is never persisted.
- Split source evaluation signals into separate mechanisms (e.g. Rust `Option` and borrowing). Document that status `200` is not the only successful HTTP status; flag unrelated optimization as a human-review concern.
- Report routing/evaluator errors separately from llama-server connection errors. Mac integration and real-Qwen behavior remain unverified for this hotfix.

## v0.2.12 — Cross-language evaluation and guided code review

- Add a second offline benchmark path that exercises real `planGuidance` and `resolveGuidance` orchestration on **synthetic open-file snippets** in Python, JavaScript, Go, Rust and Java, rather than testing only conceptual discussions.
- Verify learner-intent routing stays in protected guidance mode for direct implementation requests. Simulate help-level progression and English follow-ups; do not unlock solution mode from benchmark prompts.
- Reuse the extension's JSON response schema when generating source-guidance responses with the local llama.cpp server. Default no-source-execution, no workspace reads, and no persistence of model messages.
- Add `--suite source`, `--suite discussion`, `--list-cases` and five case IDs (`source-python`, `source-javascript`, `source-go`, `source-rust`, `source-java`). Default still tests only three scenarios; use `--case` for inexpensive real-model validation.
- Review rubrics remain hidden from model prompts and only print with `--show-rubric`. Indicators are not fact-checking or general semantic graders; static snippets are **not** real-project integration tests.
- No changes to production permission gates, supported model runtime, network access or local learner memory.

## v0.2.11 — Pedagogical routing

- Route the learner's current intent independently of whether the editor happens to be open.
- Conceptual questions remain conversational without scanning the active source file; concrete code/task requests retain guided hints and the existing solution gate.
- Pure routing and VS Code integration tests cover both file-open and no-editor cases.
- Per-project, session-only routing continuity; no new accounts, network requests or persisted transcripts.

## 0.2.10 (candidate — evidence-based critical review)

- For code-review follow-ups, guide the offline model to inspect the constructor and concrete branch conditions rather than assume a particular implementation, and to distinguish ignored values, rejected operations, and runtime type errors.
- Avoid fabricated execution outputs or speculative replacement code when learners ask to analyze technical limitations of an existing illustrative snippet.
- Fix the synthetic review rubric: it no longer presupposes a `saldo_inicial` parameter that the generated example might not contain. Add opt-in human-review flags for claimed outputs and suspicious statements about rejected/ignored negative values. These flags **do not** check correctness.
- No workspace edits, code execution, external services, or new personal-data storage.

## 0.2.10 (candidate — grounded identifiers in explanations)

- Follow-up translations now receive a bounded lexical glossary of observed code identifiers, independent of the spoken language. Only complete fenced educational examples qualify; prompts do not invent names.
- A conservative lexical validator rejects code-styled identifiers introduced as methods, classes, or fields when absent from the previous example (e.g., changing `__saldo` to `__balance` in explanatory prose). This does not claim semantic verification and leaves generic terms alone.
- The real VS Code discussion flow and synthetic offline benchmark use the same identifier hints and validator.
- Technical follow-ups prioritize inspecting unvalidated initial state before speculating about requirements. No workspace edits, source execution, external services, or persisted raw conversations.

## 0.2.10 (candidate — evidence-first technical follow-ups)

- When asked to assess limitations of a previous example, focus on at most two limitations supported by the actual code rather than generating a replacement implementation or inventing business requirements.
- Keep those review follow-ups short and explicit about the distinction between observed behavior and hypothetical requirements.
- The synthetic Python scenario now flags absolute privacy/access claims and ungrounded authorization requirements for **human review only**. Regex flags do not prove accuracy or make a general fact checker.
- Previous code-fidelity and bilingual behavior remain unchanged. Requires compilation, VS Code integration, and real-Qwen validation before publication.

## v0.2.10 — Code-anchor reliability hotfix (pending real-model validation)

- Keep educational code examples immutable during same-example translations and re-explanations. The model supplies new prose; the application reuses the original complete code fence byte-for-byte rather than publishing mutated strings, calls or initialization.
- If the prior code fence is too large for safe reuse, omit regenerated code rather than inventing a translated version. Rewording is not authorization to edit workspace sources.
- Report when immutable code reuse occurred, separately from whether a model response was accepted on its first attempt. This check does not establish technical truth of the surrounding prose.
- Explicitly regression-test the real case of translated print strings and changing `João` to `John`.
- An original explanatory answer can still contain mistakes; source editing and answer-unlock permissions are unchanged.

## v0.2.10 (candidate hotfix — code fidelity and concise retries)

- Compare executable lines of a reused educational example while permitting unchanged excerpts and comments translated into the learner's language; never accept altered statements or reordered executable lines.
- Preserve bounded complete prior snippets up to 32 lines and 1550 characters instead of reducing ordinary 20-line examples to identifiers alone. Prefer the most substantial original snippet over a later two-line excerpt when a follow-up refers to the same example.
- In a truncated-response retry, ask for at most two short prose paragraphs, no new code or lists; this is an instruction to the model rather than a guarantee that the model will follow it.
- Automated tests remain lexical, not a semantic validator. Changes still require Mac/VS Code and real Qwen verification.

## 0.2.10 (candidate — code-example fidelity refinement)

- Rejects a changed fenced code example when the learner explicitly asks to re-explain the SAME code; the retry requests prose, not a newly generated implementation.
- Retains observed code examples in compact conversational history for technical follow-ups referencing that example, even if the immediately previous turn contained no code.
- Recognizes colloquial requests for the "same code" in Portuguese and English, not just the "same example".
- Directs the model to avoid unsupported absolute claims about privacy, immutability or invariants and to keep explanations shorter. These are pedagogical instructions, not automatic verification.
- Improves human-review criteria; all code comparisons are ephemeral and do not save transcripts or source.
- The validator can detect literal changes to fenced code in translation; it cannot prove conceptual correctness or detect every paraphrased semantic inconsistency.

## 0.2.10 (candidate — learner cues and code identity)

- Adjust explanatory framing only when the student *explicitly* reports unfamiliarity, confusion, or existing familiarity in the current question (Portuguese or English). No scores, inferred global mastery, new stored attributes or intrusive quizzes.
- Strengthen continuity instructions for translation/re-explanation: translate prose, preserve exact code identifiers, and avoid rewriting an example in a new language unless requested. These are model instructions, **not a guarantee** of semantic/code consistency.
- Keep full educational code examples verbatim only when short. For longer examples, preserve a bounded list of observed identifiers, never fabricate a syntactically complete truncated code block.
- Include regression tests for explicit-level cues, code identity, and long-example context. Add a synthetic PT–EN follow-up to evaluate preservation and advanced explanations; word/identifier signals remain only prompts for human review.
- No change to source writing privileges, solution unlock, loopback network restriction, model installation or persistent memory.
- Candidate requires full TypeScript build, VS Code integration and Qwen benchmark on the developer Mac.

## 0.2.9 (candidate — continuity and response proportionality)

- Keep bounded history from the same project/file session. When a learner requests a translation or a re-explanation, preserve a compact copy of the **last educational example**, even if it appeared after a long introduction in the previous response.
- The current learner question remains the highest priority. For ordinary follow-ups, do not force reuse of an old example when the learner changes topic.
- Add generic answer-depth steering (brief / ordinary / detailed) in Portuguese and English, respecting explicit learner requests without hard-failing on word counts.
- Share the exact conversational history selection and turn-specific instructions between the live extension and the offline evaluator. Avoid benchmark-only behavior that the VS Code extension does not reproduce.
- Add a synthetic PT→EN→PT scenario for retaining the same bank-account example across an English explanation and a brief Portuguese follow-up. Rubrics require human judgment and do not certify continuity automatically.
- No extra model, network request, telemetry or persistent storage of dialogue; prior example context is ephemeral. Permissions for editing projects or releasing complete solutions are unchanged.
- Candidate requires Mac TypeScript compilation, integration test and Qwen benchmark before publication.

## 0.2.8 (refinement — distinguish teaching examples from project solutions)

- Remove the blanket ban on fenced Markdown code in conceptual tutoring; small **self-contained educational examples** may illustrate a concept, including when switching between Portuguese and English.
- Keep concrete implementation requests gated: direct requests to write or fix a learner's task are not authorized merely by asking the conceptual chat. A bounded example must include explanatory prose, have balanced fences, and stay within size limits. This is conservative intent screening, **not proof of semantic independence** from the learner's project.
- For oversized snippets, retry requesting one smaller independent example; for implementation requests, retry in prose without solution code. The app remains read-only and never executes examples.
- Regression tests reproduce the type of fenced Car example rejected in the real bilingual Qwen benchmark, check malformed/code-only/oversized/implementation replies, and preserve benchmark raw-output opt-in behavior.
- Markdown rendering continues to use inert text nodes; no new dependencies or external services. The existing integration test and local model benchmark still require rerunning on the developer's Mac.

## 0.2.8 — hotfix candidate: instructional examples and synthetic-only diagnostics

- Clarify the conceptual explanation style: give concrete programming examples in prose instead of relying solely on toy-box analogies.
- When an initial response contains a fenced code block, request an example in prose on retry; full project solutions remain guarded.
- Benchmark adds explicit `--show-rejected` to print rejected generations for **fixed synthetic prompts only**; disabled by default. The extension never logs rejected model content.
- No claim of automatic factual validation or of improved real-model first-attempt rate without rerunning the benchmark.

## 0.2.8 (candidate — natural Portuguese/English tutoring)

- Select explanation language from the learner's **current question**, with explicit language requests taking precedence. Brief ambiguous follow-ups inherit the conversation language within that project/file session; source code and programming language names do not choose the reply language.
- Use language-specific general tutoring, Socratic guidance, solution explanation and retry instructions; do not make a small local model translate a full foreign-language system prompt implicitly.
- Add English help/difficulty recognition and graduated hint wording; preserve existing explicit-solution authorization gate and read-only behavior.
- Provide localized deterministic fallback notices and bounded project-tree evidence when two local-model attempts fail; keep project paths sanitized.
- Extend the same language-routing logic into the offline synthetic benchmark. Add PT→EN→PT and EN→PT conversation scenarios; test response language routing, code identifiers and context continuity without saving raw questions.
- No additional model download, service, telemetry or dependency. The underlying model still determines fluency and technical accuracy; this is a developer candidate pending macOS VS Code integration and real Qwen evaluation.

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


#### v0.2.12 — ajuste de estabilidade das pistas (candidato)
- Normalização segura de perguntas múltiplas em JSON, com registro explícito da normalização na avaliação.
- Rejeição conservadora de respostas em idioma diferente do solicitado no modo de pistas.
- Orientação para privilegiar explicações concretas e leitura estática ao abordar dúvidas sobre sintaxe.

#### v0.2.12 — frases completas em orientação (candidato)
- O limite de caracteres agora respeita fronteiras de frases completas nas observações e pistas; textos longos sem ponto de corte seguro são rejeitados para reformulação.
- Análise de possível código de solução ocorre antes de truncar o texto recebido do modelo.
- No modo pista, uma dica nova não é perdida porque o modelo repetiu a pergunta anterior; essa pergunta é omitida e o relatório registra o ajuste.
