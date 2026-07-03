---
"@savvy-web/silk-effects": major
---

## Breaking Changes

- Migrates the changesets integration from the stable v2 line to the v3 `next` prereleases (`@changesets/apply-release-plan@^8.0.0-next.7`, `@changesets/config@^4.0.0-next.6`, `@changesets/get-release-plan@^5.0.0-next.7`, `@changesets/get-github-info@^1.0.0-next.3`, `@changesets/types@^7.0.0-next.6`). The underlying release-plan engine, config reader, and GitHub info client are all new major versions with their own behavior changes; test upgrades against a real changeset flow before relying on it in CI.
- `ReleasePlanner` now drives the v3 engine directly: config loading uses the non-throwing `readConfig` result (invalid config now surfaces as a description-only failure rather than a thrown parse error) and workspace discovery consumes the manypkg v3 `Packages` shape natively. The v1-shaped compatibility adapter that previously bridged `@manypkg/get-packages@3.x` down to the engine's v1 `Packages` contract has been deleted.

## Features

### `changelogModules` option on `ReleasePlanner.apply`

`apply()` accepts a new `changelogModules` option mapping configured changelog ids to absolute module paths, for consumers that don't have `node_modules` available at release time (like this repo's own release action):

```ts
yield* releasePlanner.apply(root, {
	changelogModules: {
		"@savvy-web/changelog": "/abs/path/to/changelog-module.js",
	},
});
```

When set, the configured changelog id in `config.changelog[0]` must be a key of the map — unmapped ids fail with a typed `ReleasePlanError` — and the engine's own `format` integration is suppressed for that run.

### Vendored GitHub info adapter tracks the renamed upstream API

The vendored `getGitHubInfo` helper now calls the v1 `getCommitInfo` API (upstream renamed `getInfo`) and adapts its structured `CommitInfo | undefined` result back to the existing `GitHubCommitInfo` shape, which is unchanged — no consumer-facing type changes here, only an internal adapter update plus not-found handling for the new `undefined` return case.

## Dependencies

| Dependency                     | Type       | Action  | From    | To            |
| ------------------------------ | ---------- | ------- | ------- | ------------- |
| @changesets/apply-release-plan | dependency | updated | ^7.1.1  | ^8.0.0-next.7 |
| @changesets/config             | dependency | updated | ^3.1.4  | ^4.0.0-next.6 |
| @changesets/get-github-info    | dependency | updated | ^0.8.0  | ^1.0.0-next.3 |
| @changesets/get-release-plan   | dependency | updated | ^4.0.16 | ^5.0.0-next.7 |
