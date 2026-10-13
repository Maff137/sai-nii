# Sai-nii: development notes

This is the **foundation commit**, not the full M1 milestone. It is intentionally read-only, works only on user demand, and sends prompts only to a `llama-server` process on loopback. No model runtime or GGUF is currently bundled.

## Developer setup

- Install Node.js 20+ and VS Code for development.
- `cd extension && npm install && npm test`.
- Open `extension/` in VS Code and run **F5** to start the Extension Development Host.
- Open a trusted project containing a regular source file, e.g. OrderFlow. Click Sai-nii in the activity bar.

## Inference (manual until runtime packaging)

Using a locally installed, verified `llama.cpp` build and a compatible GGUF model:

```shell
llama-server -m /absolute/path/to/your-model.gguf --host 127.0.0.1 --port 8080
```

The extension talks to `http://127.0.0.1:8080/v1/chat/completions`, and has no remote-provider setting. To use a different *local* port, set `sainii.serverPort` in VS Code Settings. Model selection/import and automatic runtime management are future tasks.

## Privacy and security boundaries

- The sidebar never sends code to the webview; all project scanning and local model calls run within VS Code's extension host.
- The snapshot includes active buffer/selection, diagnostics, file paths, recent local Git logs, status, and the **active tracked file diff**. Sensitive paths and generated directories are excluded by conservative heuristics. **Not a complete DLP scanner:** sensitive literals in allowed source files may still be included in a local prompt.
- Git is invoked with fixed argument arrays (`execFile`, no shell), reads only, with hooks and external text conversion minimized. No arbitrary commands are requested from the model.
- No project edits, tests, pushes, or autonomous code changes are implemented.
- The learning-memory store contains only shortened user questions and metadata, never whole source buffers; use *Apagar memória* to clear it. VS Code may still retain its own extension storage backups.
- The gating policy is enforced before allowing the solution-oriented system prompt. A basic output validator rejects obvious leaks. **Heuristic filters cannot guarantee no spoilers**, and user's written attempt/blocker cannot be authenticated; adversarial tests and deeper policy checks are required before stable release.
- The extension never starts work automatically or scans code in the background.

## Next engineering work

1. Add Extension Host integration tests and a deterministic mock local model.
2. Improve real-attempt evidence linked to editor changes and explicit pedagogical state.
3. Add session-scoped learner memory and finer-grained deletion and integrate only useful portions of Tutor MCP.
4. Bundle and manage llama.cpp executables for darwin-arm64, win32-x64, linux-x64; add GGUF import, hardware profiling, and strict offline smoke tests.
5. Build/sign distribution artifacts and validate on actual macOS/Windows/Ubuntu hardware.

## v0.1.0 learning history and pedagogy

The local learning store uses VS Code `globalState` and records only: hashed workspace identity, workspace display name, VS Code language ID, concept category, event type (`question`, `difficulty`, `solution`), response origin (`model`, `retry`, `fallback`, `solution`) and time. The raw user question, project source, diffs, code identifiers and physical paths are NOT persisted by this subsystem. A migration converts earlier raw-question `learnerNotes.v1` into categorized records, then clears those older notes. This is not a claim of verified learner proficiency: it counts observed help-seeking and topics only. The model sees only aggregated, project-scoped counters. The data stays on each device.

The sidebar offers **Ver memória**, **Apagar projeto**, and **Apagar tudo**. Deletion requires confirmation; other VS Code backups and other extensions' storage are outside Sai-nii's control.

Structured replies still use `observation`, `hint`, and `question`, but `question` is allowed to be an empty string. The model is instructed to make a Socratic question only when pedagogically helpful. Rescue prompts use questions as a safe conservative default; no tests or code edits are executed.

## Extension Host smoke test

Run `npm install`, `npm test`, then `npm run test:integration`. The separate integration command may download a VS Code binary on first run, and requires a supported GUI/host environment. It validates activation and command registrations, not pedagogical model behavior; unit tests use deterministic model simulations. CI continues to run unit tests on macOS, Windows and Ubuntu.


## v0.1.1 — Cross-file context experiment

On a user-initiated question, Sai-nii may include two extra files that are linked to the current source through import/module references, or explicitly named in the question. It never uses full-project bulk reads. Its local-context policy remains read-only and offline. Paths with credential-like names, binary files, generated directories and external symlink targets are excluded; realpath containment and size limits are enforced before opening a file.

Unit tests for import ranking can run without VS Code, but final compilation (`npm test`) and Extension Host integration tests (`npm run test:integration`) must be validated on the target machine. To inspect actual behavior, open a workspace with two linked source files and ask Sai-nii about the import; avoid using personal or confidential repositories for first-run tests.

Current limitations: heuristic imports rather than language-server dependency graph, a finite workspace listing, and a short context window. The model may still misunderstand relationships; do not treat generated explanations as verified code analysis.
