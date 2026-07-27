---
"@savvy-web/silk-effects": minor
---

## Features

### `ReleasePlanner.preview` accepts `changelogModules`

`preview` now takes the same `changelogModules` option `apply` has, mapping configured changelog ids to absolute module paths:

```ts
const preview = yield* planner.preview(root, {
	changelogModules: { "@savvy-web/changelog": changelogModulePath },
});
```

Rendering `changelogEntry` resolves the changelog module named in `.changeset/config.json`, so a caller running before `node_modules` exists — a bundled GitHub Action reading a release plan, for instance — could not use `preview` at all. Resolution failed inside `import-meta-resolve` and surfaced only as `Release plan error (preview): expected to be defined`. Mapping the id gives the engine an absolute path to import instead.

The option behaves as it does on `apply`: `config.changelog[0]` must be a key of the map, an unmapped id fails with a `ReleasePlanError` naming the supported keys, and the engine's `format` integration is disabled so the caller owns formatting. Omitting the option preserves the previous behaviour exactly. `plan` is unchanged — it renders no changelog and so resolves no module.

## Bug Fixes

A changelog id naming an `Object.prototype` member — `toString`, `constructor`, `valueOf` — is now correctly reported as unmapped. Membership was tested with `changelogModules[id] === undefined`, which reads back an inherited function for those names, so the id skipped the typed error and the engine received a function where it expects a module specifier. This affected `apply` before `preview` existed as an option-taking member, and is fixed for both.

## Refactoring

* `preview` and `apply` now share one `withChangelogModules` config rewrite rather than carrying separate copies
