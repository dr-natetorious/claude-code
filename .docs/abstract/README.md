# Abstract docs for Claude Code

This `.docs/abstract` folder contains 10k-foot summaries of the repository's runtime shape, focusing on memory, context, session management, and the query lifecycle. The goal is to help new readers get oriented quickly before diving into implementation files.

Files:

- `architecture.md` — Top-level architecture and mermaid diagram.
- `query-engine.md` — Detailed walkthrough of `QueryEngine` responsibilities and lifecycle.
- `memory-and-context.md` — How CLAUDE.md, nested memory, relevant-memory prefetch, and context accounting work.
- `session-and-state.md` — Session lifecycle, `bootstrap/state.ts`, persistence, and history.

How these were produced

- These docs were written by analyzing source files in `src/` including `QueryEngine.ts`, `context.ts`, `bootstrap/state.ts`, `history.ts`, `utils/attachments.ts`, `utils/claudemd.ts`, and `utils/analyzeContext.ts`.

Next steps & recommended reads

- Read `src/QueryEngine.ts` to see the central flow in action.
- Inspect `src/utils/attachments.ts` and `src/utils/claudemd.ts` for memory discovery specifics.
- Explore `src/utils/analyzeContext.ts` to understand token accounting and autocompact strategy.

