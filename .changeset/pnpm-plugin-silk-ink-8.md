---
"@savvy-web/pnpm-plugin-silk": minor
---

## Breaking Changes

### The `silk` catalog moves Ink to v8

- `catalog:silk` now resolves `ink` to `^8.0.0`, and `catalog:silk:peers` to `^8.0.0`. Ink 8 requires React `>=19.3.0`, which the catalog's `react` and `@types/react` entries already provide.
- A package that declares `ink` as `catalog:silk` should check its code against the [Ink 8 release notes](https://github.com/vadimdemedes/ink/releases/tag/v8.0.0) before upgrading. The changes most likely to affect it are that `<Box minWidth/maxWidth>` accept only numbers, that `useStdout().stdout` no longer types `columns`/`rows` (use `useWindowSize()`), and that `useInput` drops unrecognized terminal control sequences.
- A package built on `@effected/cli/ui` needs `@effected/cli` `^0.14.0`, the first release that peers on Ink 8.

## Maintenance

- Removed the stale `ink-tab>ink` entry from `peerDependencyRules.allowedVersions`. It relaxed an Ink 7 peer for `ink-tab`, which no Silk Suite package installs, and would not cover Ink 8 anyway.

## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| ink | config | updated | ^7.1.1 | ^8.0.0 |
| @rsbuild/core | config | updated | ^2.2.11 | ^2.2.12 |
| turbo | config | updated | ^2.11.6 | ^2.11.7 |
| vite | config | updated | ^8.3.2 | ^8.3.3 |
