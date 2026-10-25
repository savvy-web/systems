---
"@savvy-web/silk-effects": minor
---

## Refactoring

- The `Lint` namespace's `Command` utility now runs on the @effected kit's synchronous facades, `detectPackageManagerSync` and `ToolDiscoverySync`, instead of a hand-rolled copy, so lint-staged handlers and the kit share one set of tool-discovery rules. Its public API is unchanged, and tools still resolve global-first. Closes #471

Behavior differences to be aware of:

- Package-manager detection now follows the kit's order: `devEngines`, then `packageManager`, then the lockfile and workspace markers. It falls back to `npm` when nothing is found.
- `getExecPrefix("npm")` now returns `["npx", "--no", "--"]`, with a trailing `--`.
- `isAvailable` probes the tool directly, with no shell, instead of running `command -v`.
- `Command.exec` and `Command.execSilent` are deprecated and will be removed in a future major.
