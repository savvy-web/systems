# @savvy-web/mcp

## 2.3.0

### Features

* `repos_manage` action `add` accepts an `orientation` argument, so the block a preceding `remove` reported can be handed straight back and a re-vendor is lossless in one call.

  `action: "remove"` echoes the removed entry's orientation block verbatim as JSON, because `add` does not resurrect it and a re-vendor otherwise loses it silently.

  `action: "sync"` renders a `Boundary marked` section, and `action: "restore"` renders a `Still dirty` section when it is non-empty. The latter is deliberately omitted when empty: a standing empty heading on every clean restore trains a reader to skip past the one section that matters. [#464][#464]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.5.2 | 5.6.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#464]: https://github.com/savvy-web/systems/pull/464

## 2.2.2

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.5.1 | 5.5.2 |

* | Dependency           | Type       | Action  | From    | To      |                                                                              |
  | -------------------- | ---------- | ------- | ------- | ------- | ---------------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.11.0 | ^0.11.1 | [#453][#453] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#453]: https://github.com/savvy-web/systems/pull/453

## 2.2.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.5.0 | 5.5.1 |

* | Dependency            | Type       | Action  | From           | To             |                                                                              |
  | --------------------- | ---------- | ------- | -------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 |                                                                              |
  | @effected/commands    | dependency | updated | ^0.3.1         | ^0.4.0         |                                                                              |
  | @effected/git         | dependency | updated | ^0.6.0         | ^0.7.0         |                                                                              |
  | @effected/workspaces  | dependency | updated | ^0.10.2        | ^0.11.0        |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#449][#449] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#449]: https://github.com/savvy-web/systems/pull/449

## 2.2.0

### Features

* `repos_inspect` gains two new modes: `drift` runs the four-authority reconciliation (manifest, `.gitmodules`, worktree, `git submodule status`) and returns every disagreement found; `gitmodules` returns the decoded `.gitmodules` sections directly (or a parse error).

  `repos_manage` gains three new actions matching `ReposManager`'s new lifecycle operations: `remove` (unvendor a repo), `rename` (rename a vendored repo's worktree, git config, and manifest key), and `restore` (hard-reset dirty vendored repos back to their pinned commit). [#436][#436]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.4.0 | 5.5.0 |

* | Dependency              | Type       | Action  | From    | To      |                                                                       |
  | ----------------------- | ---------- | ------- | ------- | ------- | --------------------------------------------------------------------- |
  | @effected/workspaces    | dependency | updated | ^0.10.0 | ^0.10.2 |                                                                       |
  | @savvy-web/silk-effects | dependency | updated | 5.3.1   | 5.4.0   |                                                                       |
  | @effected/git           | dependency | added   | —       | ^0.6.0  | [#436][#436] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#436]: https://github.com/savvy-web/systems/pull/436

## 2.1.0

### Features

* Both `savvy repos` (cli) and `repos_manage` (mcp) now provide `Repos.ReposLockdown.layer` alongside `Repos.ReposConfigStore.layer` when assembling `Repos.ReposManager.layer`, matching the vendored-repos read-only permissions enforcement added to `@savvy-web/silk-effects`. The exported `reposCommand` (cli) and `reposManage` (mcp) error unions each widen to include `Repos.ReposLockdownError`, surfaced if a lock/unlock chmod fails around a `sync`/`add`/`pin` operation. [#429][#429]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.3.1 | 5.4.0 |

* | Dependency           | Type       | Action  | From   | To      |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------- | --------------------------------------------------------------------- |
  | @effected/commands   | dependency | updated | ^0.2.1 | ^0.3.1  |                                                                       |
  | @effected/workspaces | dependency | updated | ^0.9.5 | ^0.10.0 | [#429][#429] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#429]: https://github.com/savvy-web/systems/pull/429

## 2.0.19

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.3.0 | 5.3.1 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.9.4 | ^0.9.5 | [#427][#427] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#427]: https://github.com/savvy-web/systems/pull/427

## 2.0.18

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.2.1 | 5.3.0 |

## 2.0.17

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.2.0 | 5.2.1 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/commands   | dependency | updated | ^0.2.0 | ^0.2.1 |                                                                              |
  | @effected/workspaces | dependency | updated | ^0.9.3 | ^0.9.4 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 2.0.16

### Refactoring

* Internal layer composition in the MCP server's runtime updated to consume `@savvy-web/silk-effects`'s renamed service statics (`ChangesetConfig.layer`, `ChangesetConfigReader.layer`, `SilkPublishability.layerAdaptive`, `SilkWorkspaceAnalyzer.layer`, `Changesets.BranchAnalyzer.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.ConfigInspector.layer`, `Changesets.DepsRegen.layer`, `Repos.ReposManager.layer`, `Repos.ReposConfigStore.layer`, `Turbo.TurboInspector.layer`) in place of the removed `XLive` exports. No change to the server's tool surface or behavior. [#408][#408]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.1.3 | 5.2.0 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.9.1 | ^0.9.3 | [#400][#400] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#400]: https://github.com/savvy-web/systems/pull/400

[#408]: https://github.com/savvy-web/systems/pull/408

## 2.0.15

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.1.2 | 5.1.3 |

## 2.0.14

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.1.1 | 5.1.2 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/commands   | dependency | updated | ^0.1.0 | ^0.2.0 |                                                                              |
  | @effected/workspaces | dependency | updated | ^0.9.0 | ^0.9.1 | [#396][#396] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#396]: https://github.com/savvy-web/systems/pull/396

## 2.0.13

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.1.0 | 5.1.1 |

## 2.0.12

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.0.1 | 5.1.0 |

## 2.0.11

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 5.0.0 | 5.0.1 |

## 2.0.10

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.6 | 5.0.0 |

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.8.0 | ^0.9.0 |                                                                       |
  | @effected/commands   | dependency | added   | —      | ^0.1.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#382]: https://github.com/savvy-web/systems/pull/382

## 2.0.9

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.5 | 4.2.6 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.7.0 | ^0.8.0 | [#375][#375] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#375]: https://github.com/savvy-web/systems/pull/375

## 2.0.8

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.4 | 4.2.5 |

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.6.2 | ^0.7.0 | [#369][#369] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#369]: https://github.com/savvy-web/systems/pull/369

## 2.0.7

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.3 | 4.2.4 |

* | Dependency            | Type       | Action  | From          | To             |                                                                              |
  | --------------------- | ---------- | ------- | ------------- | -------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 |                                                                              |
  | @effected/workspaces  | dependency | updated | ^0.6.1        | ^0.6.2         |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 2.0.6

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.2 | 4.2.3 |

* | Dependency           | Type       | Action  | From   | To     |                                                                              |
  | -------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.6.0 | ^0.6.1 | [#351][#351] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#351]: https://github.com/savvy-web/systems/pull/351

## 2.0.5

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.1 | 4.2.2 |

## 2.0.4

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.2.0 | 4.2.1 |

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.5.2 | ^0.6.0 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 2.0.3

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.1.0 | 4.2.0 |

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.4.1 | ^0.5.2 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#336]: https://github.com/savvy-web/systems/pull/336

## 2.0.2

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.0.1 | 4.1.0 |

* | Dependency            | Type       | Action  | From          | To            |                                                                              |
  | --------------------- | ---------- | ------- | ------------- | ------------- | ---------------------------------------------------------------------------- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 |                                                                              |
  | @effected/workspaces  | dependency | updated | ^0.4.0        | ^0.4.1        |                                                                              |
  | effect                | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 2.0.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.0.0 | 4.0.1 |

* | Dependency           | Type       | Action  | From   | To     |                                                          |
  | -------------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.3.0 | ^0.3.1 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.0.0

### Breaking Changes

* The server targets `effect@4`; the runtime layer stack and the `Schema`-to-JSON-Schema-to-zod bridge are rebuilt on `Schema.toJsonSchemaDocument`.

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.3.1 | 4.0.0 |

* | Dependency            | Type       | Action  | From     | To             |                                                                       |
  | --------------------- | ---------- | ------- | -------- | -------------- | --------------------------------------------------------------------- |
  | @effect/cluster       | dependency | removed | ^0.59.0  | —              |                                                                       |
  | @effect/experimental  | dependency | removed | ^0.60.0  | —              |                                                                       |
  | @effect/platform      | dependency | removed | ^0.96.2  | —              |                                                                       |
  | @effect/rpc           | dependency | removed | ^0.75.1  | —              |                                                                       |
  | @effect/sql           | dependency | removed | ^0.51.1  | —              |                                                                       |
  | @effect/workflow      | dependency | removed | ^0.18.2  | —              |                                                                       |
  | workspaces-effect     | dependency | removed | ^2.1.0   | —              |                                                                       |
  | @effect/platform-node | dependency | updated | ^0.107.0 | catalog:effect |                                                                       |
  | effect                | dependency | updated | ^3.21.4  | catalog:effect |                                                                       |
  | @effected/workspaces  | dependency | added   | —        | ^0.3.0         | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

* Tool result contracts track the v4 `Schema` shapes; the ten-tool surface and the `@modelcontextprotocol/sdk` transport are unchanged. [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 1.8.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.3.0 | 3.3.1 |

* | Dependency        | Type       | Action  | From   | To     |                                                                              |
  | ----------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 1.8.0

### Features

* ### `repos_inspect` and `repos_manage` tools

  Adds two tools for the vendored `.repos/` reference-repo pattern, bringing the server to ten tools (three mutating):

  * `repos_inspect` (read-only) — `mode: "status"` returns a drift report (presence, dirtiness, stale notes per repo); `mode: "config"` returns the full parsed manifest, including purposes, orientation, and notes.
  * `repos_manage` (mutating) — `action: "sync" | "pin" | "add" | "note"` against the vendored submodules, using a flat wire schema (no `oneOf`) that decodes into a per-action request internally, naming the first missing required field on failure. The `pin` result surfaces `commitMessage` and `staleNoteIds` as an explicit review-and-commit cue.

  Both tools render vendored-repo content (names, refs, purposes, note text) as escaped inline code spans in their markdown transcript, since that content originates from an external, untrusted source. [#292][#292]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.5 | 3.3.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

## 1.7.6

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.4 | 3.2.5 |

## 1.7.5

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.3 | 3.2.4 |

## 1.7.4

### Bug Fixes

* The `changeset_inspect` tool now refreshes the shared `ConfigInspector` (and its workspace discovery) at the start of every call, so edits to `.changeset/config.json` or the workspace made during a long-running session are visible immediately across `branch`, `config`, and `classify` modes — instead of serving state cached from the first call. Completes the staleness fix started in #262 for the dependency tools (#229). [#267][#267]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.2 | 3.2.3 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#267]: https://github.com/savvy-web/systems/pull/267

## 1.7.3

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.1 | 3.2.2 |

## 1.7.2

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.0 | 3.2.1 |

* | Dependency        | Type       | Action  | From   | To     |                                                          |
  | ----------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.7.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.1.0 | 3.2.0 |

## 1.7.0

### Features

* Added an optional `strict` input to `biome_check`. When `strict: true`, warnings are surfaced as errors in-process; each upgraded diagnostic is marked with `originalSeverity: "warning"`, and `summary.upgradedWarnings` reports how many were upgraded
* Guidance text is now severity-aware — a warnings-only run (no `strict`) returns non-blocking guidance instead of the previous fix-it-now wording [#240][#240]

- The `changeset_deps_detect` and `changeset_deps_regen` tools each gain two new optional inputs, mirroring `@savvy-web/silk-effects`'s `DepsRegen` service:

  * `packages` — an array of workspace package names to restrict the run to, unioned with the existing `package` input.
  * `exclude` — an array of workspace package names to drop from scope entirely; nothing is written for them and their existing changesets are left untouched. Wins over `package` and `packages`. [#241][#241]

### Bug Fixes

* `biome_check` no longer silently upgrades project warn-level diagnostics to errors by default — severities now match the project's Biome config, the same as running `biome check` / `pnpm run lint` directly

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.3 | 3.1.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#240]: https://github.com/savvy-web/systems/pull/240

[#241]: https://github.com/savvy-web/systems/pull/241

## 1.6.7

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.2 | 3.0.3 |

## 1.6.6

### Bug Fixes

* Declared `@effect/experimental` and `@effect/workflow` as regular dependencies, completing the Effect peer-dependency closure. Both were required peers of the already-declared `@effect/sql` and `@effect/cluster`, so pnpm auto-installed them at the consumer's importer level, where a consumer depending on a different major of `effect` could bind them against an incompatible `effect` instance (#228) [#232][#232]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.1 | 3.0.2 |

* | Dependency        | Type       | Action  | From   | To     |                                                                       |
  | ----------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.1 | ^2.0.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#232]: https://github.com/savvy-web/systems/pull/232

## 1.6.5

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.0 | 3.0.1 |

## 1.6.4

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.1.0 | 3.0.0 |

## 1.6.3

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.0.2 | 2.1.0 |

## 1.6.2

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.0.1 | 2.0.2 |

## 1.6.1

### Bug Fixes

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^2.0.0 | ^2.0.1 |
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 2.0.0 | 2.0.1 |

## 1.6.0

### Features

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) `changeset_deps_regen`/`changeset_deps_detect` now report catalog-aware dependency rows: a stable `catalog:` specifier whose resolved version changed shows the concrete `from`/`to` versions, and a package that only adopted a `catalog:` specifier without a version change no longer produces a row.
* Dependency-changeset gating now follows the `publishable OR privatePackages.version` (minus ignored) rule, matching the rest of the changeset tooling.

### Refactoring

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) Both tools' declared error unions widen to include `ChangesetIOError` and `PointInTimeReadError`, reflecting the underlying `DepsRegen` service's new failure modes. Internal layer composition moved from `WorkspaceSnapshotReaderLive` to `workspaces-effect`'s `PointInTimeWorkspaceLive`.

### Dependencies

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^1.2.0 | ^2.0.0 |
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.6.0 | 2.0.0 |

## 1.5.0

### Features

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) Added two tools backed by `Changesets.DepsRegen`, bringing the server to eight tools: `changeset_deps_detect` (read-only — the cumulative dependency diff with `catalog:`/`workspace:` specifiers resolved to concrete versions) and `changeset_deps_regen` (regenerates pure-dependency changesets; the second mutating tool after `biome_check`, and a no-op preview under `dryRun`).

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.5.2 | 1.6.0 |

## 1.4.0

### Features

* [`c7e38d4`](https://github.com/savvy-web/systems/commit/c7e38d46b844e26ffc4e6ebb55d949f9a91d5d86) Remove the resource subsystem from savvy-mcp: the silk:// corpus, the manifest, the silk\_docs\_search tool, and the api-doc render pipeline. The server is now tools-only; api documentation moves to a dedicated website built from the api-models.

## 1.3.5

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.5.1 | 1.5.2 |

## 1.3.4

### Bug Fixes

* [`055e4bc`](https://github.com/savvy-web/systems/commit/055e4bc60546e5f1147ff99f07cedc88d2be2613) The generated `silk://packages/<pkg>/api/**` reference docs and inflated manifest are now shipped in the published package. Previously they were gitignored and never committed, so every `silk://packages/<pkg>/api/...` read failed with `ENOENT` on a clean release machine and `silk_docs_search` could not surface any API symbol.
* Each documented package now serves an API index page at the bare `silk://packages/<pkg>/api` URI, listing every documented symbol with a link to its page.
* A missing `silk://` resource now returns a clean not-found error referencing the requested URI instead of a raw `ENOENT` that leaked the server's absolute install path.
* `silk_docs_search` now returns an empty result set for a real query that matches nothing, instead of a fallback package listing with `confidence: 0` and `matchedOn: []` that read like real hits. A keyword-free browse (only stop-words) still returns the low-confidence priority listing.
* The bundled documentation corpus no longer describes the defunct `@savvy-web/rslib-builder`; the builder overview, "choosing a builder," and API-model-pipeline docs now cover `@savvy-web/bundler` (the `defineBuild`/`runBuild` front door).
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.1 |

## 1.3.3

## 1.3.2

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.0 |

## 1.3.1

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.0 |

## 1.3.0

### Features

* [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) The MCP corpus now includes API documentation for `@savvy-web/bundler`, `@savvy-web/tsdown-plugins`, and `@savvy-web/rspress-builder`. These three packages are generated into the corpus on prod build alongside silk-effects, templates, and the GitHub Action packages. The `silk_docs_search` tool can now answer questions about the bundler API (`defineBuild`, `runBuild`, `RunOptions`), tsdown-plugins exports (`runMetaPass`, `writeIssuesArtifact`, and all plugin functions), and rspress-builder options.
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.4.0 | 1.5.0 |

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @effect/platform                                                                                  | dependency    | updated | ^0.96.1               | ^0.96.2               |    |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |

## 1.2.0

### Features

* [`ec206d3`](https://github.com/savvy-web/systems/commit/ec206d3cb8b0c1687b6e89f0b2a49c866a53fb7f) Adds a changeset\_preview tool that previews the next release using the real
  changeset engine, and refactors savvy changeset version onto the native
  ReleasePlanner apply so it no longer shells out to an installed changeset
  binary. The silk plugin changeset-preview skill renders from the new tool.

This bumps the cli and silk packages in lockstep through the fixed changeset
group. Note a behavior change to savvy changeset version: the dry-run flag is
now a true no-write report of the planned release, where it previously delegated
to the changeset binary.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.3.1 | 1.4.0 |

## 1.1.2

### Documentation

* [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### Corrected the `savvy` command-tree corpus doc

The `silk://packages/cli/command-tree` corpus doc that ships in the tarball listed the `savvy commit hook(...)` group with a `user-prompt-submit` handler that no longer exists, and prefixed the `savvy commit` and `savvy lint` groups with per-tool `init`/`check` subcommands that were removed earlier. The command tree now matches the shipped CLI: `savvy commit hook(session-start · pre-commit-message · post-commit-verify)` and `savvy lint fmt(...)` with no per-tool `init`/`check`.

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.3.0 | 1.3.1 |

## 1.1.1

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.2.0 | 1.3.0 |

## 1.1.0

### Features

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `savvy lint init` and `savvy commit init` manage a post-commit hook (#122)

`savvy lint init` and `savvy commit init` now create and manage a `.husky/post-commit` hook that restores the executable bit on shell scripts after each commit. This mirrors the existing post-checkout and post-merge hygiene hooks, closing the gap where a commit could strip the execute permission from the very hooks that `post-checkout`/`post-merge` maintained.

### Bug Fixes

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash the `savvy` CLI or `savvy-mcp` server at load (#126)

`@savvy-web/cli` and `@savvy-web/mcp` now declare `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies. The `@effect/platform-node` root barrel eagerly links these clustering submodules at import time. Without these declarations, a fresh install that did not already provide them indirectly would fail with `ERR_MODULE_NOT_FOUND` before any command could run.

### Changeset push-guard no longer blocks tag and delete pushes (#124)

The `changeset-push-guard` plugin hook no longer triggers on `git push --tags`, `git push --delete`/`-d`, or refspec-deletion pushes (`git push origin :branch`). These push forms cannot introduce unreleased commits, so blocking them on an unreleased-changeset check was a false positive.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.1.0 | 1.2.0 |

## 1.0.0

### Features

* [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) ### changeset\_validate tool

A new `changeset_validate` MCP tool validates changeset files against the section-aware lint rules (CSH001–CSH005). It accepts an optional `dir` path (defaults to `.changeset/`) and returns a structured result with a pass/fail flag, an error count, and per-file diagnostics including file path, rule ID, line, column, and message.

```json
{
  "tool": "changeset_validate",
  "arguments": { "dir": ".changeset" }
}
```

Returns `{ dir, ok, errorCount, messages[] }` where each message has `file`, `rule`, `line`, `column`, and `message` fields.

### classify mode for changeset\_inspect

`changeset_inspect` now accepts `mode: "classify"` alongside the existing `branch` and `config` modes. Pass an array of repo-relative file paths and receive the owning package for each, resolved against the workspace configuration.

```json
{
  "tool": "changeset_inspect",
  "arguments": { "mode": "classify", "paths": ["packages/cli/src/index.ts"] }
}
```

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.1.0 | 1.1.0 |

## 0.5.0

### Features

* [`111241c`](https://github.com/savvy-web/systems/commit/111241cefd5d91163871c02d2372a2dfae7cac5c) Adds the `biome_check` MCP tool, a thin proxy that runs Biome over a path and returns structured diagnostics instead of console text. Use `mode: "check"` (the default — lint, format, and organize-imports) or `mode: "lint"`; set `write` to apply safe fixes (`--write`) or `unsafe` to apply unsafe fixes (`--write --unsafe`). The tool parses Biome's gitlab reporter into a typed payload with per-file severity, rule, and message, alongside a markdown summary. Unlike the other savvy-mcp tools, `biome_check` can mutate the working tree when `write` or `unsafe` is set, so it carries no read-only hint.

- [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) Adds the `changeset_inspect` MCP tool, a read-only changeset analyzer for the changeset-manager workflow. `mode: "branch"` diffs the current branch against its base and classifies every changed file by owning package, returning the affected packages and the unmapped paths to ask the user about; `mode: "config"` surfaces the resolved `.changeset/config.json` (release surfaces, version files, ignore list). Results are returned as typed structured content, replacing the previous bash wrappers that parsed CLI stdout.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.0.1 | 1.1.0 |

## 0.4.2

### Bug Fixes

* [`7cc2c10`](https://github.com/savvy-web/systems/commit/7cc2c105819e7459d99663335dff142f488f1cec) Ship the runtime modules in the published `@savvy-web/mcp` tarball. The package carried a `"files": ["public"]` allowlist that excluded every per-module runtime `.js` file (`runtime.js`, `server.js`, `index.js`, `resources/*`, `tools/*`). npm only force-includes `bin/`, `package.json`, and the README, so the `savvy-mcp` binary imported sibling modules that were never published and crashed on launch with `ERR_MODULE_NOT_FOUND` (affecting 0.4.0 and 0.4.1, breaking the silk plugin's `savvy-mcp` server).

Removing the `files` field lets the clean build-output directory be the implicit allowlist — matching every other package in the repo — so the full runtime ships. A new packaging regression test walks the published module graph against the actual `npm pack` file list to keep entry points and their reachable runtime modules in the tarball.

## 0.4.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | workspaces-effect                                                                                 | dependency | updated | ^1.1.0 | ^1.2.0 |    |
  | Dependency                                                                                        | Type       | Action  | From   | To     |    |
  | -----------------------                                                                           | ---------- | ------- | -----  | -----  |    |
  | @savvy-web/silk-effects                                                                           | dependency | updated | 1.0.0  | 1.0.1  |    |

## 0.4.0

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Adds the `turbo_inspect` tool — a read-only Turborepo inspector over silk-effects' `Turbo` namespace, returning a discriminated-union result keyed by mode (cache|graph|affected) — plus the `silk://standards/turbo/*` corpus docs.

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.6.1 | 1.0.0 |

## 0.3.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 0.6.0 | 0.6.1 |

## 0.3.0

## 0.2.1

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

* **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
* **`silk_docs_search` tool** — a read-only intent search across the Silk documentation corpus using an in-memory Fuse index over each document's title, tags, and summary. Accepts a plain-keyword query plus optional `limit` and `tier` filters; returns ranked matches with the document URI, title, summary, tags, and a normalized high/medium/low confidence label, tie-broken by curated priority. It never returns empty — a no-match query falls back to the top entries with a catalog nudge. Agents use this to locate the right document before fetching it with the resource layer.
* **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs.
* **`silk://{+path}` resource template** — serves individual documents from the on-disk corpus by URI path. Documents live under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`; the catalog lists every addressable path.

The document corpus is compiled at build time by a `build:catalog` script into a validated `manifest.json`. At runtime the server hydrates the Fuse search index from the manifest and serves each document on demand through the resource template.

The `McpContext` public export carries the resource layer, so the barrel also re-exports the types reachable through it — `DocIndex`, `Manifest`, `ManifestEntry`, `SearchResult`, and `SearchOptions` — letting consumers that embed or extend the server work with the manifest and search shapes directly.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary. It consumes the external unscoped `api-extractor-llms` npm package as a build-time devDependency to render the generated API-reference tier (see below).

### API-doc generation pipeline

The server's per-package API-reference docs are rendered from in-monorepo library packages' API Extractor models, via `api-extractor-llms`. They occupy the `silk://packages/<pkg>/api/*` tier of the resource tree and are available to agents via `silk_docs_search` and the `silk://{+path}` resource template. The rendered markdown is tracked source content that ships in the published package; only the upstream `.api.json` Extractor models stay out of version control. The catalog `manifest.json` is likewise tracked, and every resource carries an accurate `lastModified` drawn from its git history.

### Body-content search

The Fuse index backing `silk_docs_search` now indexes document bodies at low weight (0.03), in addition to title (0.55), tags (0.30), and summary (0.12). Queries that have no strong title or tag match now surface relevant documents based on body content rather than falling through to the priority-ordered fallback.

### Related-graph see-also boost

`silk_docs_search` results now include a `related` field on each hit, carrying the related document URIs declared in the manifest. The top three ranked results pull in their related neighbors as low-confidence see-also entries (if not already present in the result set), giving agents a broader view of connected content.

```typescript
// Each search hit now includes:
{
  uri: "silk://packages/mcp/overview",
  title: "...",
  related: ["silk://standards/api-model-pipeline", "silk://guides/api-docs-from-api-extractor"],
  // ...
}
```

### Structured query logging

The server emits structured stderr log lines for every `silk_docs_search` invocation. Each line records the raw query string, the resolved result count, and whether the response was a fallback (no Fuse match). Logging goes to stderr only, so it does not affect the MCP stdio protocol.

### Hand-authored corpus content (4 standards + 3 guides)

Seven new documents are part of the Silk knowledge corpus and are indexed at launch:

Standards:

* `silk://standards/api-model-pipeline` — API Extractor model pipeline conventions
* `silk://standards/changeset-format` — changeset file format and style rules
* `silk://standards/dependency-conventions` — dependency declaration conventions
* `silk://standards/semver` — SemVer versioning policy for the Silk Suite

Guides:

* `silk://guides/api-docs-from-api-extractor` — generating API docs from API Extractor models
* `silk://guides/building-a-github-action` — building a GitHub Action with Silk tooling
* `silk://guides/choosing-a-builder` — selecting the right rslib builder for a package

### Docs authoring plugin for the savvy MCP corpus

A new `docs` Claude Code plugin ships alongside the savvy MCP server, turning the documentation corpus into something agents can author and maintain, not just read. The plugin spawns the same shared `savvy-mcp` server and adds a guided authoring workflow on top of it.

What a plugin user gets:

* **`mcp` corpus agent** — an authoring agent that resolves a savvy-web/systems checkout, reads the live front-matter contract, drafts or edits a doc under the standards, packages, or guides tier, verifies it through the `build:catalog` integrity gate, and commits with DCO sign-off or opens a PR. It orients itself through `silk://catalog` and `silk_docs_search` before touching source, so subagent runs follow the same catalog-first discipline as the main session.
* **`/docs:write-guide [topic] [--pr]`** — author a new corpus doc from a topic, defaulting to the guides tier, checking for an overlapping doc first.
* **`/docs:improve [doc-id-or-path] [--pr]`** — improve an existing doc: stale content, over-budget bodies, broken related links, or outdated status.
* **`corpus-authoring` skill** — encodes the front-matter schema, tier assignment, the controlled tag vocabulary with a propose-then-add workflow, and related-id rules, reading the live contract so values never drift from the server's schema.
* **`corpus-verify` skill** — runs the `build:catalog` gate (schema, id uniqueness, tier/directory double-check, tag and related resolution, dead-name check, per-tier body budgets) and reports errors versus body-budget warnings, with both human-readable and JSON output.

A SessionStart orientation hook points the agent at the shared MCP catalog and search tools at the start of each session.

## 0.1.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

* **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
* **`silk_docs_search` tool** — a read-only intent search across the Silk documentation corpus using an in-memory Fuse index over each document's title, tags, and summary. Accepts a plain-keyword query plus optional `limit` and `tier` filters; returns ranked matches with the document URI, title, summary, tags, and a normalized high/medium/low confidence label, tie-broken by curated priority. It never returns empty — a no-match query falls back to the top entries with a catalog nudge. Agents use this to locate the right document before fetching it with the resource layer.
* **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs.
* **`silk://{+path}` resource template** — serves individual documents from the on-disk corpus by URI path. Documents live under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`; the catalog lists every addressable path.

The document corpus is compiled at build time by a `build:catalog` script into a validated `manifest.json`. At runtime the server hydrates the Fuse search index from the manifest and serves each document on demand through the resource template.

The `McpContext` public export carries the resource layer, so the barrel also re-exports the types reachable through it — `DocIndex`, `Manifest`, `ManifestEntry`, `SearchResult`, and `SearchOptions` — letting consumers that embed or extend the server work with the manifest and search shapes directly.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary. It consumes the external unscoped `api-extractor-llms` npm package as a build-time devDependency to render the generated API-reference tier (see below).

### Ephemeral API-doc generation pipeline

The server generates per-package API-reference docs at startup from in-monorepo library packages' API Extractor models, via `api-extractor-llms`. The generated docs occupy the `silk://packages/<pkg>/api/*` tier of the resource tree and are available immediately to agents via `silk_docs_search` and the `silk://{+path}` resource template. Generation is ephemeral — docs are produced on demand during the build phase and are not checked into the repo.

### Body-content search

The Fuse index backing `silk_docs_search` now indexes document bodies at low weight (0.03), in addition to title (0.55), tags (0.30), and summary (0.12). Queries that have no strong title or tag match now surface relevant documents based on body content rather than falling through to the priority-ordered fallback.

### Related-graph see-also boost

`silk_docs_search` results now include a `related` field on each hit, carrying the related document URIs declared in the manifest. The top three ranked results pull in their related neighbors as low-confidence see-also entries (if not already present in the result set), giving agents a broader view of connected content.

```typescript
// Each search hit now includes:
{
  uri: "silk://packages/mcp/overview",
  title: "...",
  related: ["silk://standards/api-model-pipeline", "silk://guides/api-docs-from-api-extractor"],
  // ...
}
```

### Structured query logging

The server emits structured stderr log lines for every `silk_docs_search` invocation. Each line records the raw query string, the resolved result count, and whether the response was a fallback (no Fuse match). Logging goes to stderr only, so it does not affect the MCP stdio protocol.

### Hand-authored corpus content (4 standards + 3 guides)

Seven new documents are part of the Silk knowledge corpus and are indexed at launch:

Standards:

* `silk://standards/api-model-pipeline` — API Extractor model pipeline conventions
* `silk://standards/changeset-format` — changeset file format and style rules
* `silk://standards/dependency-conventions` — dependency declaration conventions
* `silk://standards/semver` — SemVer versioning policy for the Silk Suite

Guides:

* `silk://guides/api-docs-from-api-extractor` — generating API docs from API Extractor models
* `silk://guides/building-a-github-action` — building a GitHub Action with Silk tooling
* `silk://guides/choosing-a-builder` — selecting the right rslib builder for a package

### Docs authoring plugin for the savvy MCP corpus

A new `docs` Claude Code plugin ships alongside the savvy MCP server, turning the documentation corpus into something agents can author and maintain, not just read. The plugin spawns the same shared `savvy-mcp` server and adds a guided authoring workflow on top of it.

What a plugin user gets:

* **`mcp` corpus agent** — an authoring agent that resolves a savvy-web/systems checkout, reads the live front-matter contract, drafts or edits a doc under the standards, packages, or guides tier, verifies it through the `build:catalog` integrity gate, and commits with DCO sign-off or opens a PR. It orients itself through `silk://catalog` and `silk_docs_search` before touching source, so subagent runs follow the same catalog-first discipline as the main session.
* **`/docs:write-guide [topic] [--pr]`** — author a new corpus doc from a topic, defaulting to the guides tier, checking for an overlapping doc first.
* **`/docs:improve [doc-id-or-path] [--pr]`** — improve an existing doc: stale content, over-budget bodies, broken related links, or outdated status.
* **`corpus-authoring` skill** — encodes the front-matter schema, tier assignment, the controlled tag vocabulary with a propose-then-add workflow, and related-id rules, reading the live contract so values never drift from the server's schema.
* **`corpus-verify` skill** — runs the `build:catalog` gate (schema, id uniqueness, tier/directory double-check, tag and related resolution, dead-name check, per-tier body budgets) and reports errors versus body-budget warnings, with both human-readable and JSON output.

A SessionStart orientation hook points the agent at the shared MCP catalog and search tools at the start of each session.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.5.0 | 0.6.0 |
