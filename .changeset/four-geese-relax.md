---
"@savvy-web/silk": patch
---

## Bug Fixes

* The `savvy` and `savvy-mcp` carrier shims now pass `@savvy-web/silk` as the distribution, so both bins name it in their version output (`savvy --version`, and `serverInfo.version` for `savvy-mcp`). Guaranteed under pnpm; npm's flat `.bin` layout may link the `cli`/`mcp` packages' own bins instead.

## Maintenance

* The package-layering guard now lives in silk's own test suite.
