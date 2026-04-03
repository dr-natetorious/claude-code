# Agents, Skill Plugins, and Extensions — 10k-foot view

This document explains how agent management, skill plugins, and extensions work in the codebase, and how the system executes large, long-running workflows that spawn multiple model calls and external tool requests. It collects the important implementation details, runtime flow, caching semantics, permission rules, memory, and telemetry so you can quickly reason about agent behavior.

## What an "agent" is

- An agent is an autonomous, contextual worker that can run multiple model turns, call tools, and persist transcripts. Agents may be built-in, defined in project/user settings, or provided by plugins.
- Agent definitions are normalized into `AgentDefinition` objects and include fields like:
  - `agentType`, `whenToUse`, `prompt` or `getSystemPrompt`
  - `tools` / `disallowedTools`, `skills`
  - `mcpServers` (agent-scoped MCP integrations)
  - `permissionMode`, `memory` scope (`user | project | local`), `background`, `isolation` (worktree/remote)
  - `hooks`, `maxTurns`, `initialPrompt`, `color`

See source: `src/tools/AgentTool/loadAgentsDir.ts` (loading, validation, plugin merging).

## How agents are defined & loaded

- Sources:
  - built-in agents (`src/tools/AgentTool/built-in/*`)
  - plugin agents (loaded by `loadPluginAgents()`)
  - custom agents defined as markdown/frontmatter (scanned under `agents/` by `loadMarkdownFilesForSubdir`).
- `getAgentDefinitionsWithOverrides(cwd)` memoizes the active agent list and returns both `activeAgents` and `allAgents`. It also initializes agent memory snapshots when enabled.
- Agents can specify required MCP servers (names or inline configs). `filterAgentsByMcpRequirements()` ensures agents are only offered when their MCP requirements are satisfied.

See source: `src/tools/AgentTool/loadAgentsDir.ts`

## Memory (persistent agent memory)

- Memory scopes supported:
  - `user`: global memory directory under the app memory base (e.g., `~/.claude/agent-memory/<agent>/MEMORY.md`).
  - `project`: repo-local, `.claude/agent-memory/<agent>/MEMORY.md`.
  - `local`: machine or run-local memory (`.claude/agent-memory-local/<agent>/...`), or a remote mount if configured.
- Memory content is surfaced as a prompt block at spawn time via `loadAgentMemoryPrompt(agentType, scope)` which also ensures the memory dir exists.
- Snapshots: when project snapshots exist, agents with `memory === 'user'` may be initialized from snapshots (feature gated) to seed memory.

See source: `src/tools/AgentTool/agentMemory.ts`, `src/tools/AgentTool/agentMemorySnapshot.ts`.

## Skill plugins (SkillTool)

- Skills (slash commands) are discovered and listed by `getSkillToolCommands()` / `getSlashCommandToolSkills()`.
- `SkillTool` formats a bounded listing of skills for the prompt using `formatCommandsWithinBudget()` which enforces a character budget (1% of context window by default) and truncates descriptions when necessary.
- Skill invocation is a blocking requirement when relevant: if the model should use a skill, it must call `SkillTool` before generating an answer.
- Skills can come from bundled commands, plugins, or local project definitions.

See source: `src/tools/SkillTool/prompt.ts`, `src/commands.ts`.

## Agent runtime and orchestration (runAgent)

- `runAgent()` is the core worker function that executes an agent's lifecycle. High-level steps:
  1. Resolve agent model, generate `agentId`, register tracing, and set transcript subdir.
  2. Build initial messages: parent context (filtered for incomplete tool calls) + the user-provided prompt messages.
  3. Prepare `readFileState` (cloned from parent to control cache + deterministic replacement behavior).
  4. Resolve user/system context (`getUserContext()` and `getSystemContext()`), optionally omitting CLAUDE.md for read-only agents.
  5. Initialize agent-scoped MCP servers (frontmatter `mcpServers`): `initializeAgentMcpServers()` connects and fetches tools.
  6. Resolve the agent's tool pool (`resolveAgentTools()`): merge parent tools, agent MCP tools, and apply allow/deny rules and permission mode.
  7. Optionally emit cache-safe params (system prompt, tool list, model, forkContextMessages, user/system context) via `onCacheSafeParams` so forks or monitors can playback/observe identical prefixes.
  8. Enter the model loop via `query()`: handle `assistant` messages, `tool_use` messages, `progress`/`stream_event`, and `tombstone`. Persist recordable messages to the transcript as they are produced.
  9. Track usage, enforce `maxTurns` and other lifecyle constraints.
 10. On finish: cleanup MCP inline clients, kill shell tasks spawned by the agent, remove worktree (if `isolation: worktree`), unregister tracing, and write final metadata.

See source: `src/tools/AgentTool/runAgent.ts`.

## Forks, subagents, and cache-sharing

- There are two common subagent models:
  - Fork (cache-sharing): a fork inherits the parent’s system prompt, tool list, model, and parent messages so the Anthropic prompt cache can be reused. `CacheSafeParams` packages these fields. Forks must not change thinking config or set `maxOutputTokens` in ways that alter the cache key.
  - Fresh subagent: starts with zero local context and receives full briefing in the prompt.

- `createSubagentContext(parentContext, overrides?)` builds a `ToolUseContext` for subagents. Defaults:
  - Clone mutable state (`readFileState`, `nestedMemoryAttachmentTriggers`, `loadedNestedMemoryPaths`, `contentReplacementState`) so the subagent is isolated.
  - New abort controller linked to parent (unless explicitly shared).
  - Wrap `getAppState` so background forks avoid showing permission prompts (`shouldAvoidPermissionPrompts`).
  - Optionally allow sharing of `setAppState`, `setResponseLength`, or `abortController` for interactive subagents.

- ForkedAgent helper (`src/utils/forkedAgent.ts`) provides helpers to create cache-safe params, save & retrieve last cache-safe params (slot used by other hooks), prepare forked command contexts (skill prompt replacement and allowed tools), and run the forked query loop while accumulating usage.

See source: `src/utils/forkedAgent.ts`.

## Background agents & async lifecycle

- Agents can be launched as background tasks (via `run_in_background` or `background: true` in agent definition). The `AgentTool` call returns early with an `agentId` and `outputFile` and the agent runs asynchronously.
- Background agents produce a sidechain transcript; when they complete the system posts a user-role message (notification) with the result and/or the caller can read `outputFile`.
- Background tasks are tracked in local task registries (e.g., `LocalAgentTask`, `RemoteAgentTask`) and have lifecycle operations: register, update progress, complete or fail, kill/cleanup.

See source: `src/tools/AgentTool/AgentTool.tsx`, `src/tasks/LocalAgentTask/*`.

## Teammates, swarms, and process spawn

- For interactive/visible teammates, the system can spawn separate processes or tmux/iTerm panes via `spawnMultiAgent`.
- Teammates inherit many CLI flags (permission mode, model, plugin-dir, settings path). The system makes sure team context (team file) exists and assigns colors/IDs.
- Teammates are useful for long-running interactive sessions, shell runs, or when a separate process lifecycle is desired (different from background async agents which are still tracked by the main process).

See source: `src/tools/shared/spawnMultiAgent.ts`.

## Permissions and safety

- Agents and tools honor the `toolPermissionContext` for allow/deny rules. `AgentTool` filters agent definitions and tools according to these rules before exposing them to the model.
- Agents may include `permissionMode` in their definition. The system also supports per-invocation `allowedTools` via generated `getAppState` wrappers.
- Background forks suppress permission prompts by default to avoid blocking unattended runs; explicit allowlists must be used for operations that need higher privileges.

Key helper: `createGetAppStateWithAllowedTools(baseGetAppState, allowedTools)` (see `src/utils/forkedAgent.ts`).

## MCP server integration

- Agents can specify `mcpServers` in frontmatter — either a reference name (shared/memoized client) or inline config (dynamically created client).
- `initializeAgentMcpServers()` connects to these servers, fetches available tools from connected servers, and merges them into the agent's tool pool. Inline-created clients are cleaned up when the agent finishes.

See source: `src/tools/AgentTool/runAgent.ts` and `src/services/mcp/*`.

## Transcripts, sidechains, and resume

- Agent transcripts are stored under agent-specific subdirs; sidechain transcripts are used for background runs and resumes.
- When resuming an agent, the system reconstructs `contentReplacementState` and prior messages so that replacements and prompt prefixes are identical, improving cache stability and determinism.

See source: `src/utils/sessionStorage.ts`, `src/utils/toolResultStorage.ts`, `src/tools/AgentTool/resumeAgent.ts`.

## Telemetry and usage accounting

- Forks and agents accumulate usage across all model calls. `forkedAgent.ts` and `runAgent.ts` call usage accumulation functions and emit analytics events like `tengu_fork_agent_query`.
- Perfetto tracing hooks are registered when agents start (if enabled) for hierarchical tracing.
- `AgentTool` hooks into task registries to report token counts, progress updates, and final completion events.

## How the system executes large, multi-API workflows (practical mechanics)

- The agent is a controller that runs many API calls in sequence (model ↔ tools ↔ model) until a termination condition. The runtime coordinates:
  - Streaming model responses and deltas (`query()` yields `stream_event`, `assistant`, `progress`).
  - Tool calls triggered by the model (tool_use) and their execution (local or via MCP). Tool results are fed back to the model.
  - Transcript persistence and sidechain grouping so intermediate noise doesn't pollute the parent conversation.
  - Usage aggregation across the whole run for accurate billing/telemetry.
- For concurrency the system uses:
  - Parallel agent launches (single message can include multiple `AgentTool` calls to run agents concurrently).
  - Background agents for genuinely asynchronous long-running tasks.
  - Forks when cheap, cache-sharing offload of sub-questions is desired.

## Compact mermaid sequence (paste into a mermaid renderer)

sequenceDiagram
  participant User
  participant Coordinator
  participant AgentTool
  participant runAgent
  participant Model
  participant MCP
  participant Tools
  participant TranscriptStore

  User->>Coordinator: "Launch agent: audit-branch"
  Coordinator->>AgentTool: call AgentTool({prompt, subagent_type, run_in_background})
  AgentTool->>loadAgentsDir: resolve agent definition & tools
  AgentTool->>runAgent: spawn runAgent(...initialMessages, toolPool)
  runAgent->>MCP: connect agent-scoped MCP servers (if any)
  runAgent->>Model: send initial API request (system prompt + tools + messages)
  loop model/tool loop
    Model-->>runAgent: assistant/message / tool_use
    runAgent->>Tools: execute tool (shell, file, mcp tool)
    Tools-->>runAgent: tool result
    runAgent->>Model: send follow-up request with tool results
  end
  runAgent->>TranscriptStore: write sidechain transcript and metadata
  runAgent->>AgentTool: finish (result or async-launched)
  AgentTool->>Coordinator: return result (agentId if async)
  Note over User,Coordinator: If background, notification posted later when TranscriptStore has final result

## Files to inspect for details
- `src/tools/AgentTool/loadAgentsDir.ts` — agent loading/validation/plugin merge
- `src/tools/AgentTool/agentMemory.ts` — agent memory helpers and prompt builder
- `src/tools/AgentTool/runAgent.ts` — core agent runtime and MCP init
- `src/tools/AgentTool/AgentTool.tsx` — Agent tool wrapper and orchestration
- `src/utils/forkedAgent.ts` — fork helpers, cache-safe params, subagent context
- `src/tools/SkillTool/prompt.ts` — skill listing, token budgeting
- `src/tools/shared/spawnMultiAgent.ts` — teammate spawn and swarm orchestration
- `src/utils/toolResultStorage.ts`, `src/utils/sessionStorage.ts` — transcript/sidechain/resume

---

If you'd like, I can now:
- add cross-links with line-range anchors into these files (I can include specific functions and line ranges), or
- add a shorter example showing an `AgentTool` call your code can generate (a one-message multi-agent launch example), or
- generate a README-level summary paragraph you can paste into the project README.

What should I do next?
