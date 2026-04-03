# Claude Code — Architecture (10k-foot)

This document summarizes the high-level architecture of the repository and how the pieces for context, memory, and session management fit together.

## Key components

- `src/QueryEngine.ts`
  - Central per-conversation engine that owns message lifecycle, persistence, tool permission handling, and the query loop.
  - Maintains `mutableMessages` (in-memory conversation buffer) and `readFileState` (file read LRU cache) and yields SDK-friendly events.

- `src/context.ts`
  - Provides cached `getSystemContext` and `getUserContext` values.
  - These are incorporated into the system prompt and used as the API cache-key prefix.
  - Uses memoization for per-process caching and exposes injection hooks for cache breaking.

- `src/bootstrap/state.ts`
  - Central in-process application state (`STATE`) with sessionId, telemetry counters, cost state, model usage, and many runtime flags.
  - Exposes getters/setters used widely across the app (session switching, session persistence disabled, project root, etc.).

- `src/history.ts`
  - Local disk-backed history (history.jsonl) for user prompts and pasted contents.
  - Writes/reads are append-only with a flush queue / lockfile.

- `src/utils/*` (notably `queryContext.ts`, `analyzeContext.ts`, `attachments.ts`, `claudemd.ts`)
  - Helpers to assemble system prompt parts (`fetchSystemPromptParts`), analyze effective context usage (`analyzeContextUsage`), and build attachments such as nested memory, file attachments, relevant memories, skill listings.
  - `claudemd` / memory helpers load and filter memory files (CLAUDE.md), implement path rules, and provide frontmatter handling.

- `src/tools/*` and `Tool.ts`
  - Tool definitions and tooling layer used by the query loop and to build tool schemas that add to context size.

- `src/services/compact/*`
  - Compaction and snip tools: micro-compact, snip/compact boundaries; used to trim long histories and keep token usage bounded.

## High-level data flows

- User prompt enters `QueryEngine.submitMessage()` (or `ask()` wrapper).
- `processUserInput()` runs: parses slash commands, attachments, queued commands, and produces zero or more new messages. Attachments are produced by `getAttachments` which may include nested memory, relevant memories, file reads, skill listings, and other signals.
- `fetchSystemPromptParts()` is called to obtain system prompt parts, `getUserContext()` and `getSystemContext()` are retrieved and combined into the system prompt. A memory-mechanics prompt may be injected if configured.
- `query()` is called with messages, system prompt, contexts, tool use context and a model. `query()` runs model streaming + tool invocation logic and yields messages/events.
- `QueryEngine` records assistant/user/progress/attachment messages into `mutableMessages` and persist transcripts via `recordTranscript()` (history). Compact boundaries may be yielded and applied to truncate `mutableMessages` to keep memory bounded.
- `analyzeContextUsage()` and helpers compute how many tokens different categories consume (system prompt, tools, memories, skills, messages) and build the visualization grid.

## Persistence and session lifecycle

- Session identity is maintained by `bootstrap/state.ts`'s `STATE.sessionId`, with `switchSession()` and `regenerateSessionId()` helpers.
- Transcripts are written to per-session JSONL via `utils/sessionStorage.ts` functions (called from `QueryEngine`).
- A session can be resumed (resume reads transcript and rebuilds message store) — compaction boundaries and preserved segments matter to make resume robust.

## Notes on memory and context management

- Memory files (CLAUDE.md) are discovered via `getMemoryFiles()` and filtered by `filterInjectedMemoryFiles()`.
- Nested memory discovery is performed for @-mentioned files and when file-level triggers are set; loaded nested memory paths are tracked via `toolUseContext.loadedNestedMemoryPaths` and `readFileState`.
- Relevant-memory prefetching is supported (`startRelevantMemoryPrefetch`) to run asynchronous memory discovery while tools execute; results are filtered to avoid duplicates and limited by session budget.
- `QueryEngine` uses compact/snipping features to insert `compact_boundary` system messages that allow earlier messages to be pruned from `mutableMessages` and transcripts.

## Mermaid: Top-level interaction

```mermaid
flowchart LR
  U[User prompt] --> PE(ProcessUserInput)
  PE -->|messages + attachments| QE[QueryEngine]
  QE -->|fetchSystemPromptParts| CTX[context.ts / claudemd]
  QE -->|query() call| API[Model + Tool loop]
  API --> QE
  QE -->|yield messages| OUT[SDK / REPL / CLI]
  QE -->|recordTranscript| HISTORY[history.jsonl]
  QE -->|update state| STATE[bootstrap/state]
  CTX -->|memoized| STATE
```

## What to read next

- `src/QueryEngine.ts` — core lifecycle
- `src/context.ts` — system/user context
- `src/bootstrap/state.ts` — session and runtime state
- `src/utils/attachments.ts` and `src/utils/claudemd.ts` — memory discovery & attachments
- `src/utils/analyzeContext.ts` — how context token accounting is computed

