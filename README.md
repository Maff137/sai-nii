# Sai-nii

**An offline, Socratic programming tutor inside Visual Studio Code.**

Sai-nii is an open-source project focused on helping you reason about **your own code**, not writing it for you. It aims to work on macOS, Windows, and Ubuntu with local models and no account or cloud API.

## Development status

**Pre-alpha foundation.** The current extension provides a sidebar, reads bounded context from the active file and local Git repository, calls an *already running* `llama.cpp` OpenAI-compatible server on loopback, and implements an initial solution-release gate. This is not yet a one-click installer, a full pedagogical engine, or a validated release. See [product specification](docs/Sai-nii_SPEC_v1.1.md) and [implementation notes](docs/DEVELOPMENT.md).

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
