---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

### `@savvy-web/cli` and `@savvy-web/mcp` are no longer hoisted

`@savvy-web/cli` and `@savvy-web/mcp` are removed from the plugin's `publicHoistPattern`. `@savvy-web/silk` now ships the `savvy` and `savvy-mcp` bins itself, so the hoist entries had nothing left to provide. `@savvy-web/changelog` stays hoisted — the changesets engine resolves the changelog id from the consumer root.

Release this plugin together with, or after, the `@savvy-web/silk` release that carries the bins: a project on an older silk that reached `savvy`/`savvy-mcp` only through the hoist will lose them once it picks up this plugin version.

## Maintenance

* Removed the stale `@modelcontextprotocol/inspector` entry from `allowBuilds`
