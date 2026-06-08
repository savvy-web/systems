---
"@savvy-web/silk": patch
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
---

## Other

Build via `@savvy-web/bundler` instead of `@savvy-web/rslib-builder`. The public API and command surface of each package are unchanged.

`@savvy-web/silk` now builds dual-format esm+cjs with a self-contained runtime and declares `effect`, `@effect/platform`, and `semver` as runtime dependencies — its bundler build references their types and, for `semver`, its runtime, because those declarations cannot be inlined and `semver`'s circular CommonJS modules cannot be bundled into the ESM output. The `./biome`, `./commitlint/*`, and `./changesets/markdownlint` exports resolve exactly as before. `@savvy-web/mcp` relocated its markdown corpus under `public/content`, which still ships in the published package.
