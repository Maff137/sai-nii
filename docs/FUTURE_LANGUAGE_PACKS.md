# Sai-nii — Future language packs (proposal, not implemented)

## Product requirement

The tutor should eventually help the learner understand existing projects written in many programming languages. The base VS Code extension must remain small: language-specific capabilities should be optional local packs, acquired and enabled only as needed. Packs may be distributed via GitHub releases, provided their authors and contents are verified; the application must not automatically run downloaded executables.

## Proposed layering

1. **Sai-nii Core** — Socratic tutoring, conversation continuity, local privacy, project access boundaries, memory controls and UI.
2. **Project evidence adapters** — optionally add syntax trees, symbols, import/dependency relationships and language-server diagnostics, using the read-only VS Code API where possible. An adapter never determines whether the user has authorized a code solution.
3. **Specialized model resources** — optional GGUF model choices or offline retrieval aids. A pack might supply no model at all, only better structural signals for the existing local model.
4. **Validation profiles** — per-language benchmark scenarios with verified reference examples and manual technical review, not grades for learners.

## Boundaries to preserve

- No code edits, project test execution or network access as an implicit side effect of installing or reading a pack.
- No executing a pack's scripts without clear, separate user approval and sandbox/design review.
- No promise of complete expertise: a parser can recognize structure but cannot guarantee that a small model explains it accurately.
- Versioned pack metadata, compatibility checks, source provenance, license review and explicit installation/removal controls are prerequisites to implementation.
- Cross-platform packaging and memory/CPU budgets must be measured before choosing the plugin format.

This document reserves the architectural direction. It does **not** claim that a language-pack API, marketplace or multi-model installer currently exists.
