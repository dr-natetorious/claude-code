## Build information — claude-code (src)

This file documents how to build the `src/` tree locally and what the build expects. The repo's published package lives in `.tmp/package/` and is a compiled artifact — this guide explains how to reproduce a local developer build from the `src/` sources.

### Purpose
- Provide the minimal steps and assumptions required to build the CLI from `src/`.
- Explain build-time macros (MACRO.*) and Bun `feature()` usage that affect dead-code elimination and what to set during local builds.

---

## Prerequisites
- Bun (recommended) — the source uses Bun bundler macros (e.g. `bun:bundle`/`feature()`) and the project expects Bun-compatible bundling. Install Bun from https://bun.sh.
- Node.js >= 18 is recommended for running ancillary scripts / tests when not using Bun directly.
- A working package manager (bun/npm) to install runtime dependencies listed in `package.json`.

Note: The repo contains a published artifact under `.tmp/package/` with a `package.json` that shows the shape of the published package. Use that as a reference if you want to seed dependencies and `bin` metadata.

---

## High-level build contract
- Input: the TypeScript/TSX sources under `src/`.
- Output: a single CLI bundle (e.g. `dist/cli.js`) and auxiliary files under `dist/` suitable for installing as the `claude` CLI command.
- Error modes: missing runtime dependencies, missing Bun, or missing build-time defines (MACRO.* and feature flags) will cause the bundle to fail or produce incorrect runtime behavior.
- Success criteria: `bun build` completes and the produced `dist/cli.js` runs (e.g. `node dist/cli.js --version` or `bun run dist/cli.js --version`) and returns the inlined version string.

---

## Build-time macros and feature flags
- The codebase uses Bun's `feature()` (imported from `bun:bundle`) pervasively. These are compile-time flags used to include or exclude code via dead-code elimination. feature() values are not runtime environment variables — they are resolved at build time by Bun.
- The codebase also expects `MACRO.*` constants (for example `MACRO.VERSION`, `MACRO.PACKAGE_URL`, and `MACRO.NATIVE_PACKAGE_URL`) to be supplied as build-time defines. These are referenced at build-time and often in telemetry, version strings, and packaging logic.

How to provide them:
- When running Bun's bundler, you can pass `--define` style flags to set build-time constants. Example (Bun CLI may vary by version; check `bun build --help` for the exact flag syntax):

```powershell
# production build (example values)
bun build src/entrypoints/cli.tsx --outfile dist/cli.js --target bun --minify --define:MACRO.VERSION="2.1.89" --define:MACRO.PACKAGE_URL="@anthropic-ai/claude-code"

# development build (sourcemap)
bun build src/entrypoints/cli.tsx --outfile dist/cli.js --target bun --sourcemap=inline --define:MACRO.VERSION="dev"
```

- Feature gates: to include or exclude feature-gated code, you must set the corresponding build-time flags (via your bundler config or defines). Example (pseudocode — consult Bun docs to pass booleans or truthy values):

```powershell
# enable a sample gate at build time (pseudo-syntax)
bun build ... --define:FEATURE_KAIROS=1 --define:FEATURE_TEAMMEM=0
```

Note: The exact define syntax for feature() gating depends on Bun's bundler CLI and/or a `bunconfig` or build script. If unsure, try a simple build first (with MACRO.VERSION defined) and then enable feature gates as needed.

---

## Recommended `package.json` (developer)
Create a root `package.json` in the repo root (not the `.tmp` folder). Minimal example:

```json
{
  "name": "@anthropic-ai/claude-code",
  "version": "2.1.89",
  "type": "module",
  "bin": { "claude": "dist/cli.js" },
  "scripts": {
    "build": "bun build src/entrypoints/cli.tsx --outfile dist/cli.js --target bun --minify --define:MACRO.VERSION=\"2.1.89\"",
    "build:dev": "bun build src/entrypoints/cli.tsx --outfile dist/cli.js --target bun --sourcemap=inline --define:MACRO.VERSION=\"dev\"",
    "typecheck": "tsc --noEmit"
  }
}
```

- Start by copying runtime dependencies from `.tmp/package/package.json` into the root `package.json`'s `dependencies` section. Then run `bun install` (or `npm install`) and let missing packages surface during `bun build` so you can add any additional dependencies.

---

## Build example (step-by-step)
1. Install Bun: follow instructions at https://bun.sh
2. In the repo root, create `package.json` (see recommended snippet above) and run:

```powershell
bun install
```

3. Run a dev build (with version defined):

```powershell
bun build src/entrypoints/cli.tsx --outfile dist/cli.js --target bun --sourcemap=inline --define:MACRO.VERSION="dev"
```

4. Verify the bundle:

```powershell
node dist/cli.js --version
# or
bun run dist/cli.js -- --version
```

If the bundle runs and prints a version string, the build succeeded.

---

## Notes & troubleshooting
- Missing modules: the first build attempt will likely report missing modules. Add them to `package.json` and re-run `bun install`.
- Bun `feature()` gates: many optional features are disabled by default in external builds. If you need an internal feature (e.g. KAIROS/TEAMMEM/BRIDGE_MODE) enable it explicitly via your bundler/defines.
- If you prefer not to use Bun, building with an alternate bundler is possible but non-trivial — the code relies on `bun:bundle` macros and MACRO.* in many places. Replacing feature() semantics requires a pre-processing pass or code changes to avoid build-time gating.

---

## Next recommended steps
1. Decide whether you want a conservative local build (MACRO.VERSION set to a dev value and feature gates off) or a more faithful internal build (set many `feature()` flags and MACRO values).
2. I can create a root `package.json` for you (first-pass) and run a `bun build` here to discover missing dependencies. If you want that, say `Create package.json and run build` and I will proceed.

---

End of build-info.md
