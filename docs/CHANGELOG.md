# Changelog

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
