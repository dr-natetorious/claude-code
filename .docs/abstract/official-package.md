## Official npm package: @anthropic-ai/claude-code

I inspected the npm registry metadata for `@anthropic-ai/claude-code`. The package is actively published; recent versions include `2.1.89` (and many others). The registry exposes per-version metadata with tarball URLs, integrity hashes, shasum, and file counts.

Typical workflow to inspect a published version locally:

1. Pick a version (example: `2.1.89`).
2. Download the tarball and verify integrity.
3. Extract and inspect the package.json and built files.

Example (run locally):

```powershell
# Replace version as needed
$version = '2.1.89'
$pkg = '@anthropic-ai/claude-code'
$url = "https://registry.npmjs.org/$($pkg)/-/claude-code-$($version).tgz"
mkdir -Force .tmp\npm-claude-code-$version
Invoke-WebRequest -Uri $url -OutFile ".tmp\claude-tarball-$version.tgz"
tar -xzf ".tmp\claude-tarball-$version.tgz" -C ".tmp\npm-claude-code-$version"
ls .tmp\npm-claude-code-$version\package\
cat .tmp\npm-claude-code-$version\package\package.json
```

Notes from the registry metadata:
- The registry JSON includes `dist.tarball` and `dist.integrity` / `dist.shasum` per version.
- Many published versions ship a built CLI (bin: `claude` → `cli.js`), and some versions bundle platform-specific native optional dependencies (sharp images).
- Unpacked sizes vary (tens of MB) and file counts vary by release.

If you'd like, I can:
- Generate a CSV of recent versions with tarball URLs + integrity hashes.
- Attempt to download and extract a tarball into the workspace (subject to environment/network restrictions). If network downloads are allowed here, confirm and I'll fetch and unpack.

This file was generated from the npm registry metadata and the npm package page for `@anthropic-ai/claude-code`.
