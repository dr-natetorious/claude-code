# Memory and Context — how Claude Code manages context and memory

This document outlines how memory files, nested memory, relevant-memory prefetching, CLAUDE.md loading, and context accounting work.

## Concepts

- Memory files: This refers to project/user memory documents (often named `CLAUDE.md`), stored in the filesystem and discovered via `getMemoryFiles()` (`src/utils/claudemd.ts`). They are filtered by `filterInjectedMemoryFiles()` before injection.

- Nested memory: When a user references a file (`@file.txt`) or when nested memory triggers are set in `ToolUseContext.nestedMemoryAttachmentTriggers`, the engine traverses directories (CWD→target) and collects CLAUDE.md and conditional rules for the target, turning them into `nested_memory` attachments.

- Relevant-memory prefetching: `startRelevantMemoryPrefetch()` can be called to asynchronously find relevant memories using the relevance ranker `findRelevantMemories()`. The prefetch runs while the API call and tool calls are in-flight; when settled, it is collected and injected if safe.

- readFileState: a small LRU (cache keys via `cacheKeys()`) of file reads that prevents re-injecting files the model already has. `memoryFilesToAttachments()` writes selected memory content into `readFileState` to mark it loaded.

- compact / snip: compaction system will insert `compact_boundary` messages which `QueryEngine` uses to prune older messages from `mutableMessages`. Snip features (feature-gated) can replay snip boundaries to reconstruct a compacted history for resume.

## Where decisions live

- `src/utils/attachments.ts` — all attachment generation: nested memory, relevant memory, file reads, queued commands, skill listings, teammate mailbox, compaction reminders, etc.

- `src/utils/claudemd.ts` — discovery of CLAUDE.md files, memory file frontmatter parsing, globs and conditional rules, and filtered memory results.

- `src/utils/analyzeContext.ts` — token accounting and visualizations for how context is used (system prompt, tools, mcp tools, memory files, skills, messages). Uses token counting APIs with haiku fallback and includes autocompact buffer logic.

## Typical injection flow for nested memory

1. User mentions a file (`@path/to/file`). `getAttachments()` calls `processAtMentionedFiles()` which calls `getNestedMemoryAttachmentsForFile()`.
2. `getNestedMemoryAttachmentsForFile()` checks permission rules (working directories) then:
   - Processes managed & user conditional rules
   - Walks nested directories from CWD → target and loads CLAUDE.md + rules
   - Walks CWD-level dirs (root → CWD) for conditional rules
3. `memoryFilesToAttachments()` deduplicates using `toolUseContext.loadedNestedMemoryPaths` and marks loaded files in `readFileState`.
4. Attachments are yielded as `nested_memory` attachments and recorded in `mutableMessages`.

## Relevant-memory prefetch lifecycle

- `startRelevantMemoryPrefetch(messages, toolUseContext)` starts a disposable prefetch handle if auto-memory is enabled and input is sufficiently large.
- It builds `input` from the last real user message and runs `getRelevantMemoryAttachments()` which calls `findRelevantMemories()` and `readMemoriesForSurfacing()`.
- `readMemoriesForSurfacing()` uses `readFileInRange()` with limits (MAX_MEMORY_LINES + MAX_MEMORY_BYTES) and returns `relevant_memories` attachments.
- At collection time the prefetch results are filtered by `filterDuplicateMemoryAttachments()` which checks `readFileState` and then writes the selected memories into `readFileState` to avoid re-surfacing.

## Context accounting

- `analyzeContextUsage()` computes token counts per category (system prompt, system tools, MCP tools, custom agents, memory files, skills, messages). It uses several steps:
  - Count system prompt sections (and systemContext) via token counting API / haiku fallback.
  - Count memory CLAUDE.md tokens (tokenizes file content).
  - Count built-in tool tokens and deferred builtin tools (tool search gating) and MCP tool tokens.
  - Count skills separately and compute frontmatter token costs.
  - Approximate message tokens via micro-compact and an approximate token counting flow.
- Categories marked `isDeferred` (e.g., deferred tools) are shown but do not count toward used context tokens. The `Free space` and reserved buffer categories are computed after accounting.

## Limits and throttles

- MAX_MEMORY_BYTES = 4096 per memory file in surfacing and MAX_SESSION_BYTES = 60*1024 session cap for relevant memory prefetched inserts.
- MAX_MEMORY_LINES = 200 lines per file injection.
- `readFileState` dedup and `loadedNestedMemoryPaths` prevent repeated injection across turns.
- Autocompact buffer is used to reserve tokens to auto-compact without surprising the model; reactive compaction may disable the visible buffer.

## Mermaid: nested memory discovery

```mermaid
flowchart LR
  User -->|@mention file| Attachments
  Attachments --> getNestedMemoryAttachmentsForFile
  getNestedMemoryAttachmentsForFile --> claudemd[getMemoryFiles / conditional rules]
  claudemd --> readFileState
  readFileState --> QueryEngine
  QueryEngine --> recordTranscript
```

## Files to inspect

- `src/utils/claudemd.ts`
- `src/utils/attachments.ts`
- `src/memdir/*` (memoryAge, paths, findRelevantMemories)
- `src/services/compact/*` (microCompact, snipCompact)
- `src/utils/analyzeContext.ts`

