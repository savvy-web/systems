---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### The Changesets engine now runs on `@effected/changesets` and `@effected/github`

The `Changesets` namespace no longer depends on the eight `@changesets/*` packages or `@manypkg/get-packages`. It runs on `@effected/changesets` and `@effected/github`. Release output is byte-identical to `changeset version`.

* `@effected/changesets` and `@effected/github` are now required peer dependencies. Install both next to `effect` and the other `@effected/*` peers.
* The GitHub service layer now requires `ChangelogInfo` from `@effected/github`: `Layer<GitHubService, never, ChangelogInfo>`. Provide it when you build the layer.
* The `ReleasePlanner` layer now requires `WorkspaceDiscovery` and `Git` in its environment.

Every peer range is now spelled through the effected peers catalog, so the published peers read `effect ~4.1.0` and a minor caret for each `@effected/*` package. Peer ranges moved up one minor with the Effect 4.1.3 kit.
