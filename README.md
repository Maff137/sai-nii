# Sai-nii

**An offline, Socratic programming tutor inside Visual Studio Code.**

Sai-nii is an open-source project focused on helping you reason about **your own code**, not writing it for you. It aims to work on macOS, Windows, and Ubuntu with local models and no account or cloud API.

## Development status

**Pre-alpha v0.1.0 (developer preview).** The current extension provides a sidebar, reads bounded context from the active file and local Git repository, calls an *already running* `llama.cpp` OpenAI-compatible server on loopback, and implements an initial solution-release gate and a local, project-scoped memory of learning interactions. Unlike earlier versions, Socratic questions are not mandatory on every turn. This is not yet a one-click installer, a full pedagogical engine, or a validated release. See [product specification](docs/Sai-nii_SPEC_v1.1.md) and [implementation notes](docs/DEVELOPMENT.md).

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
