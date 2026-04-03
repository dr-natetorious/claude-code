# Shims

This repository is internal-only and part of a research project.

The `shims/` tree exists to make the source buildable when internal or unavailable
dependencies are missing from the local environment.

Conventions:

- External package replacements live here as package-shaped shims.
- These shims are linked through npm workspaces from the repo root.
- Keep behavior minimal and explicit; prefer no-op implementations over fake logic.
- If an official package is available, prefer installing it instead of creating a shim.
- Source-level temporary stubs that satisfy missing internal files can stay in `src/`
  unless we later decide to refactor imports to route through `shims/`.

Current workspace shims:

- `@ant/claude-for-chrome-mcp`
- `@internal/build-stubs`

This folder is intentional tech debt for the build kit. Remove entries as real
dependencies or internal implementations become available.