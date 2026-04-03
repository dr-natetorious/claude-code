# Anti-distillation and Reverse-engineering Friction

This note explains how the `src/` tree tries to make prompt distillation, prompt leakage, and codebase reverse engineering harder.

The short version is: this code does not rely on one hard lock. It uses several smaller controls that reduce what gets surfaced, what gets bundled, what gets logged, and what gets shipped into external builds.

It is better to read these as friction and compartmentalization mechanisms, not as absolute secrecy guarantees.

## What the code is trying to protect

The implementation repeatedly shows concern about four kinds of leakage:

- Hidden assistant output and reasoning leaking into user-visible transcripts.
- Sensitive identifiers, tool names, internal agent names, plugin paths, and server names leaking into logs, analytics, or remote bridge messages.
- Internal-only modules and strings being statically bundled into external builds.
- Debug and bridge payloads exposing tokens or secrets.

## 1. Brief mode hides normal assistant text

The clearest anti-distillation mechanism is the brief-only flow.

In `src/commands/brief.ts`, toggling brief mode does two things:

- It turns on `userMsgOptIn`, which makes the brief tool available.
- It injects a system reminder telling the model that plain text outside the brief tool is hidden from the user.

That is then enforced in the UI layer.

In `src/components/Messages.tsx`, the brief-mode filters deliberately suppress most assistant output:

- `filterForBriefTool(...)` keeps only brief tool calls, their tool results, and real user input.
- `dropTextInBriefTurns(...)` removes normal assistant text for turns where the brief tool was used.
- Live `streamingText` and `streamingThinking` are not rendered when `isBriefOnly` is true.

In practice, that means the model can still produce internal text, but the user-facing transcript only shows the curated tool output path. This makes casual prompt distillation through the normal interface harder because the system is narrowing what the user can see.

## 2. Thinking blocks are explicitly hidden unless transcript or verbose mode is active

`src/components/Message.tsx` contains explicit handling for `thinking` and `redacted_thinking` content blocks.

The behavior is conservative:

- Outside transcript mode and outside verbose mode, `redacted_thinking` is not rendered.
- Outside transcript mode and outside verbose mode, `thinking` is also not rendered.
- In transcript mode, older thinking blocks can still be hidden so only the latest one remains visible.

This is not a full prompt-protection system, but it does reduce exposure of internal chain-of-thought-like material in ordinary use.

## 3. Logs and debug payloads are sanitized before printing

`src/bridge/debugUtils.ts` includes two direct protections:

- `redactSecrets(...)` masks values for fields like `token`, `secret`, `access_token`, and `environment_secret`.
- `debugBody(...)` both sanitizes and truncates payloads before they are logged.

This reduces the chance that reverse engineering starts with harvested logs, debug output, or copied bridge payloads that still contain raw credentials or full request bodies.

## 4. Remote bridge messages intentionally omit tool, MCP, and plugin metadata

`src/hooks/useReplBridge.tsx` contains one of the more explicit anti-leak comments in the repo.

When building the system-init message for the REPL bridge, it deliberately redacts:

- tool lists
- MCP client names
- plugin information

The comment explains why: MCP-prefixed tool names and server names reveal which integrations a user has wired up, and plugin paths reveal raw filesystem structure such as usernames and project layout.

This matters for reverse engineering because a remote or synced bridge channel is one of the easiest places for hidden implementation details to accidentally escape. The code is explicitly preventing that.

## 5. Analytics avoid recording custom agent names

`src/main.tsx` logs agent usage, but only keeps the real name for built-in agents.

If the active agent is custom, analytics record it as just `custom` instead of sending the actual agent name.

That is a small but important compartmentalization choice: custom agent names often encode private workflow names, internal project structure, or prompt intent.

## 6. The build tries not to ship internal strings and modules into external bundles

A second major theme is compile-time and load-time concealment.

Across files like `src/commands.ts`, `src/tools.ts`, and `src/main.tsx`, optional modules are guarded behind:

- `feature('...')`
- environment checks like `process.env.USER_TYPE === 'ant'`
- `safeConditional(...)` from `src/utils/safeModuleLoader.ts`

This is paired with comments like:

- "Dead code elimination"
- "Conditional require avoids leaking the tool-name string into external builds"
- notes about values being present in an `excluded-strings` check

The intent is straightforward:

- Internal-only commands and tools should not be statically imported unless a build flag enables them.
- Sensitive names should not even appear as bundled string literals in external distributions.
- Missing internal modules should resolve to `null` instead of forcing the external build to include or reveal them.

This does not stop a determined reverse engineer with access to an internal build, but it does reduce how much of the internal surface area is visible in the public artifact.

## 7. Some code paths are written specifically to avoid string leakage

There are several spots where the implementation goes beyond ordinary lazy loading and explicitly avoids static imports because the import would leak sensitive identifiers into the bundle.

Examples include:

- `src/main.tsx` around brief-tool activation and CLI tool parsing.
- `src/commands/brief.ts`, which avoids pulling in a helper through an import chain because it would trip the excluded-strings check.
- `src/screens/REPL.tsx`, where an org warning hook is conditionally required so an internal org UUID list is eliminated from external builds.

Those comments are unusually direct: the code is not just optimizing startup, it is trying to keep names and constants from being discoverable by scanning shipped bundles.

## 8. Dangerous permissions are stripped or narrowed early

This is more containment than anti-distillation, but it still contributes.

In `src/main.tsx`, the startup path removes overly broad shell permissions and strips dangerous permissions for auto mode.

That does not hide prompts directly. What it does do is reduce the agent's ability to trivially exfiltrate files, secrets, or local state through broad tool access if a prompt or model behavior goes wrong.

## 9. The design assumes users should not automatically see the full internal transcript

Taken together, the message rendering, brief-mode filters, redacted thinking handling, and bridge redaction all suggest the same architectural assumption:

The internal assistant state is richer than the default user-visible state, and the product tries to keep those two views separate.

That separation is one of the main anti-distillation strategies in the repo. The code is repeatedly choosing a narrower external representation than the full underlying execution trace.

## Important caveat: this is not airtight

The repo also contains explicit escape hatches and internal evaluation paths.

Most notably, `src/entrypoints/cli.tsx` has a `--dump-system-prompt` fast path behind `feature('DUMP_SYSTEM_PROMPT')`. The comment says it is used for prompt sensitivity evaluations and is eliminated from external builds.

That is important context:

- The codebase does not treat prompt extraction as impossible.
- It treats prompt extraction as something that should be gated, controlled, and kept out of normal external builds.

Similarly, some comments make clear that SDK or internal consumers still receive fuller telemetry than bridge or UI paths do.

## Bottom line

`src/` tries to resist prompt distillation and reverse engineering by combining:

- view-layer suppression of non-user-facing assistant text
- hiding of thinking and redacted thinking in normal modes
- redaction and truncation of logs and bridge payloads
- analytics minimization for custom or private identifiers
- build-time dead-code elimination and conditional imports
- deliberate avoidance of shipping sensitive strings in external bundles

The pattern is consistent: do not expose more than the current surface needs, and do not statically bundle internal-only names or modules unless a gated build asks for them.

That makes extraction harder, but it is still defense-in-depth rather than a perfect anti-reversing barrier.