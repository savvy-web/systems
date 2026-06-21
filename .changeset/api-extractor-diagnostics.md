---
"@savvy-web/tsdown-plugins": minor
---

## Features

- API Extractor diagnostics now surface in the unified build log. Forgotten exports, missing release tags, and TSDoc issues were previously dropped because API Extractor's default message routing silenced them; they are now reported as warnings during the meta-generation pass.
- Suppressed messages are now accounted for. The build log summarizes how many messages each `suppressWarnings` rule hid, grouped by message id, and `--verbose` lists them in full.

## Breaking Changes

- Forgotten exports now fail the build in CI. A forgotten export silently drops the symbol from the generated API model, so in CI (`CI` or `GITHUB_ACTIONS` set) an unsuppressed `ae-forgotten-export` is a hard error. Locally it stays a warning, tagged so the build log can warn that it will fail CI.
