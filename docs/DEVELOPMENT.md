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
