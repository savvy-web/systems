---
"@savvy-web/mcp": patch
---

## Bug Fixes

Ship the runtime modules in the published `@savvy-web/mcp` tarball. The package carried a `"files": ["public"]` allowlist that excluded every per-module runtime `.js` file (`runtime.js`, `server.js`, `index.js`, `resources/*`, `tools/*`). npm only force-includes `bin/`, `package.json`, and the README, so the `savvy-mcp` binary imported sibling modules that were never published and crashed on launch with `ERR_MODULE_NOT_FOUND` (affecting 0.4.0 and 0.4.1, breaking the silk plugin's `savvy-mcp` server).

Removing the `files` field lets the clean build-output directory be the implicit allowlist — matching every other package in the repo — so the full runtime ships. A new packaging regression test walks the published module graph against the actual `npm pack` file list to keep entry points and their reachable runtime modules in the tarball.
