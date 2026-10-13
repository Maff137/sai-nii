# Sai-nii — accepted behavior decisions (v0.1.0)

- The product is an **offline**, **user-invoked**, **read-only** tutor integrated with projects opened in VS Code on macOS, Windows or Ubuntu.
- Do not force a question on every reply. Socratic guidance is the preferred method, not a required phrase pattern. Explain concepts briefly, confirm correct reasoning or ask a useful question as appropriate.
- Do not return a complete solution without an explicit request and a substantive report of an attempted approach and unresolved blocker. Current checks are heuristics and do not establish that real work was performed.
- Save **observations**, not grades: subjects discussed, user-reported difficulty and whether the response came from the model, a retry, or deterministic recovery. No curriculum, mandatory assignments or exams.
- Learning history is local to each device. The new store does not persist raw prompts, source files or filesystem paths. Workspace identity is a hash of its location, plus a short display name; moving the project changes its identity.
- The tutor can inspect opened workspace code and local Git information upon request. It cannot edit files or run tests on the user's behalf; any future test runner requires explicit approval.
- User can review or erase one project's memory or the entire stored learning history via the sidebar.
- Full offline packaging and user-chosen model downloading are planned, not yet delivered.

## Validation boundaries

Pure unit tests cover policy behavior, retrieval of summarized memory, upgrade from the older format, workspace isolation, and response-origin tracking. One GUI Extension Host smoke test was added but cannot be claimed validated until run with VS Code. Small local-model behavior must be tested in the actual machine before the milestone is called fully validated.

## Architecture behavior (v0.2.0)

- The tutor must respond to architecture and folder-organization questions with only the project root open in VS Code; do not demand screenshots or copied directory trees.
- Represent actual observed paths and small documentation/entry-point excerpts as evidence. Differentiate likely convention from verified architecture; do not guess historical design motivations.
- Indexing is independent of file extension and should remain open to any programming language. Expert-quality guidance for *every* language is an aspiration, NOT a current guarantee: the quality of the selected local LLM and context parser varies by language and framework.
- Context is user-invoked, read-only, bounded, restricted to trusted workspace and the local model. Multi-root selection currently uses the editor's workspace when possible and otherwise the first root; explicit root selection remains future work.
