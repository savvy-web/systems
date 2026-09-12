---
"@savvy-web/silk": major
---

## Breaking Changes

### `@savvy-web/silk` owns the `savvy` and `savvy-mcp` bins

Installing `@savvy-web/silk` now puts `savvy` and `savvy-mcp` on your `node_modules/.bin` path. Both are thin shims over `@savvy-web/cli/main` and `@savvy-web/mcp/main`, and `@savvy-web/cli`, `@savvy-web/mcp`, `@savvy-web/changelog` and `@savvy-web/silk-effects` ship as exact-pinned regular dependencies of silk. `@savvy-web/silk-effects` was previously a dev dependency only; it is now installed with silk.

If you relied on `@savvy-web/pnpm-plugin-silk` hoisting `@savvy-web/cli`/`@savvy-web/mcp` to reach these bins, upgrade silk to this release first — the plugin no longer hoists them.

### `./lint` inherits the `ConfigDiscovery` signature change

`ConfigDiscovery.find`/`findAll`, re-exported from `@savvy-web/silk/lint`, now require `{ cwd }`:

```ts
// before
const location = yield* discovery.find("biome.json");

// after
const location = yield* discovery.find("biome.json", { cwd: "/path/to/repo" });
```

## Bug Fixes

### Claude Code plugin: `start-mcp.sh` execs the project's own `savvy-mcp`

The plugin's MCP loader now runs `node_modules/.bin/savvy-mcp` from the project directly, instead of dispatching through `pnpm exec`/`yarn exec`/`bunx`, which resolved the bin through the package manager's workspace rules rather than the project's installed tree. When the bin is missing it prints the install command for the detected package manager and falls back to `npx --yes @savvy-web/mcp`. `SAVVY_MCP_PROJECT_DIR` is exported alongside `CLAUDE_PROJECT_DIR` so the server resolves the right project root.

## Maintenance

* The deprecated `./changesets/changelog` shim now reads `VITEST`/`GITHUB_ACTIONS` itself and provisions the log mode through `Changesets.makeChangelogFunctions`; behaviour is unchanged
