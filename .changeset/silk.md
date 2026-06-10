---
"@savvy-web/silk": minor
---

## Bug Fixes

- The `./changesets/markdownlint` entry stays dual-format CJS (markdownlint-cli2 `require()`s it) via a per-entry format override.

## Build System

- Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/cli` and `@savvy-web/mcp` (fixed release group).
