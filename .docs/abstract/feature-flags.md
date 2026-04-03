## Feature flags (compile-time, runtime, and env)

This document lists the feature gates used across the codebase. It groups them into:

- Compile-time feature gates: feature('FLAG') — designed to be DCE-friendly and used to include/exclude code at build time.
- Runtime GrowthBook flags: getFeatureValue_CACHED_MAY_BE_STALE('flag', default) — runtime feature toggles.
- Environment variables: CLAUDE_CODE_* env vars used to enable/disable behaviors at process spawn time.

Below are representative flags and example locations where they appear. This is not exhaustive but covers the most-used flags found by scanning the repository.

### Compile-time feature('...') flags (representative)

- KAIROS / KAIROS_BRIEF — attachments, transcript handling, UI brief mode (e.g., `src/utils/attachments.ts`, `src/utils/systemPrompt.ts`, `src/utils/messages.ts`).
- TRANSCRIPT_CLASSIFIER — automatic permission/classifier pipeline and related permissions code (`src/utils/permissions/*`, `src/utils/attachments.ts`).
- TEAMMEM — team memory file support and TeamMem file types (`src/utils/memoryFileDetection.ts`, `src/utils/claudemd.ts`).
- HISTORY_SNIP — history snipping and compaction helpers (`src/utils/attachments.ts`, `src/utils/messages.ts`).
- PROACTIVE — background proactive agents/tick messages (`src/utils/sessionStorage.ts`, `src/utils/systemPrompt.ts`).
- BASH_CLASSIFIER / POWERSHELL_AUTO_MODE — command-classifier related code paths (`src/utils/permissions/*`, `src/utils/bash/parser.ts`).
- EXTRACT_MEMORIES / MEMORY_SHAPE_TELEMETRY — memory extraction & telemetry (`src/utils/backgroundHousekeeping.ts`, `src/services/extractMemories/*`).
- AGENT_TRIGGERS / BG_SESSIONS / UDS_INBOX — agent orchestration features (`src/tools/AgentTool/*`, `src/utils/concurrentSessions.ts`).
- COORDINATOR_MODE / CONTEXT_COLLAPSE / REACTIVE_COMPACT — session/compact & coordinator features (`src/utils/sessionRestore.ts`, `src/utils/analyzeContext.ts`).
- CHICAGO_MCP / CCR_AUTO_CONNECT — MCP and remote transport gating (`src/utils/computerUse/*`, `src/utils/config.ts`).
- SHOT_STATS / PERFETTO_TRACING / ENHANCED_TELEMETRY_BETA — telemetry/metrics features (`src/utils/telemetry/*`).
- VOICE_MODE — voice-mode feature gate (`src/voice/voiceModeEnabled.ts`).
- TEMPLATES / FILE_PERSISTENCE / WORKFLOW_SCRIPTS — tooling and persistence (`src/utils/markdownConfigLoader.ts`, `src/utils/filePersistence.ts`, `src/tasks.ts`).

These feature('...') flags are used extensively and often gate whole modules via conditional require/feature checks. They are intended to enable dead-code elimination in downstream builds.

### Runtime GrowthBook flags (getFeatureValue_CACHED_MAY_BE_STALE)

GrowthBook-backed runtime flags are dynamically read and usually have a 'tengu_*' name. Representative examples:

- tengu_amber_quartz_disabled — voice/voice-mode related toggles (`src/voice/voiceModeEnabled.ts`).
- tengu_slate_prism, tengu_amber_json_tools — UI/feature previews (`src/utils/betas.ts`).
- tengu_cobalt_raccoon — compaction/auto-compact control (`src/utils/analyzeContext.ts`, `src/services/compact/autoCompact.ts`).
- tengu_agent_list_attach / tengu_slim_subagent_claudemd — agent behavior and subagent toggles (`src/tools/AgentTool/*`).
- tengu_hive_evidence — evidence/attribution toggles used in prompts and constants (`src/tools/AgentTool/builtInAgents.ts`, `src/constants/prompts.ts`).
- tengu_bridge_* / tengu_copper_bridge — bridge/remote features (`src/utils/claudeInChrome/*`, `src/bridge/*`).
- tengu_remote_backend / tengu_remote_tui — remote TUI/backends (`src/main.tsx`).
- tengu_kairos_brief / tengu_willow_mode — UI brief/alternate modes (`src/screens/REPL.tsx`, `src/components/messages/UserPromptMessage.tsx`).

Notes:
- GrowthBook flags often control smaller runtime UX and behavior toggles. They are not DCE-friendly and will be read at runtime.
- Flag names usually start with `tengu_` in this codebase.

### Environment variables (CLAUDE_CODE_*)

Environment variables are heavily used for dev/test/runtime configuration. Representative env vars:

- CLAUDE_CODE_REMOTE / CLAUDE_CODE_SESSION_ACCESS_TOKEN / CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR — remote session connectivity and auth (`src/utils/sessionIngressAuth.ts`).
- CLAUDE_CODE_USE_BEDROCK / CLAUDE_CODE_USE_VERTEX / CLAUDE_CODE_USE_FOUNDRY — model/backend selection (`src/utils/apiPreconnect.ts`, `src/utils/log.ts`).
- CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS — kill-switch for betas (`src/utils/toolSearch.ts`).
- CLAUDE_CODE_ENABLE_TELEMETRY / CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS — telemetry controls (`src/utils/telemetry/*`).
- CLAUDE_CODE_PROFILE_STARTUP / CLAUDE_CODE_ENTRYPOINT — profiling and runtime metadata (`src/utils/headlessProfiler.ts`).
- CLAUDE_CODE_PLUGIN_CACHE_DIR / CLAUDE_CODE_PLUGIN_USE_ZIP_CACHE / CLAUDE_CODE_USE_COWORK_PLUGINS — plugins & plugin caching (`src/utils/plugins/*`).
- CLAUDE_CODE_SIMPLE / CLAUDE_CODE_SHELL_PREFIX / CLAUDE_CODE_TMPDIR — hooks, shell, and simple mode toggles (`src/utils/hooks.ts`, `src/utils/Shell.ts`).

See `src/utils/managedEnvConstants.ts` for a canonical list of many CLAUDE_CODE_* environment keys.

### How to act on these flags (recommended reviewer steps)

1. If you're preparing a production build and want to DCE out optional features, ensure the list of compile-time flags passed to the build system matches the desired set. Search for `feature('...')` usages and confirm which should be true at build-time.
2. Audit GrowthBook flags you rely on: add comments in the docs about runtime semantics for flags starting with `tengu_`. Use the code references above to find their uses.
3. For env vars, consult `src/utils/managedEnvConstants.ts` and `src/utils/sessionIngressAuth.ts` for auth/session env var behavior.

### Next steps (optional)

- I can produce a full CSV-style export listing each discovered flag, the files where it occurs, and the first-line context. This is helpful for making a targeted audit PR.
- I can insert direct file:line anchors into `.docs/abstract/*` files for quick navigation.

Done. This file was generated by scanning for `feature('...')`, GrowthBook calls (`getFeatureValue_CACHED_MAY_BE_STALE`) and CLAUDE_CODE_ env references.
