# @savvy-web/silk-effects

## 4.2.5

### Bug Fixes

* ### Dependency table cells are no longer markdown-escaped

  Dependency table cells are now written to markdown verbatim instead of being escaped. Version specifiers and package names survive serialization intact, so a generated changeset reads `~0.2.1` and `some_pkg` rather than `\~0.2.1` and `some\_pkg`.

  The escaping came from `remark-stringify`, which backslashes any character that could open a markdown construct — with GFM enabled `~` is the strikethrough delimiter and `_` opens emphasis. It affected every table cell, not just tilde ranges, and compounded each time a table was re-serialized through consolidation or PR-body reconstruction.

  * Cells are marked literal and escape only `|` and `\`, the two characters that would otherwise break the table grid
  * Fixes both write paths — the markdown-string serializer and the mdast table node the dependency-table aggregation plugin inserts into a changeset AST
  * Prose elsewhere in a changeset keeps normal markdown escaping

  ### Hook-injected catalogs now produce dependency rows

  A dependency declared against a catalog that is injected at install time by a pnpmfile hook — rather than written into `pnpm-workspace.yaml` or recorded in the lockfile's `catalogs:` block — resolved to nothing on both sides of a diff. The two raw specifiers compared equal and no row was emitted, so a real version movement produced no changeset at all.

  The dependency diff now resolves specifiers per lockfile importer, which answers from the importer's own recorded versions when the catalog set cannot.

  * Requires `@effected/workspaces` 0.7.0, which adds the importer-scoped resolution the fix reads through
  * Scoped to the declaring importer rather than the workspace as a whole, so a repo whose packages hold different versions of the same dependency gets a correct answer per package instead of none
  * Plain semver ranges are unaffected and still fall through to the declared specifier

  ### CSH005 now judges the same value under both linters

  The markdownlint implementation of CSH005 validated the raw source of a dependency table cell, while the remark implementation validated the parsed value. A cell containing a markdown escape therefore got two different verdicts: a changeset written by the older serializer, carrying `\~0.2.0`, passed `savvy changeset check` and the pre-commit hook while failing `markdownlint`.

  The markdownlint rules now resolve CommonMark backslash escapes before validating, so both implementations judge the value a reader actually sees.

  Escape resolution lives in the shared token extractors rather than in one rule, so heading-based rules are aligned too — CSH002 previously compared a raw heading against the category list while its remark counterpart compared the parsed one.

  * Affects existing changesets written before the escaping fix above; regenerating one clears it either way
  * A value that is genuinely invalid once unescaped is still reported
  * Only ASCII punctuation is unescaped, per CommonMark, so a backslash before a space stays literal [#369][#369]

### Dependencies

* | Dependency           | Type       | Action  | From   | To     |                                                                       |
  | -------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/workspaces | dependency | updated | ^0.6.2 | ^0.7.0 | [#369][#369] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#369]: https://github.com/savvy-web/systems/pull/369

## 4.2.4

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/git          | dependency | updated | ^0.4.1 | ^0.4.2 |                                                                              |
  | @effected/glob         | dependency | updated | ^0.2.0 | ^0.2.1 |                                                                              |
  | @effected/jsonc        | dependency | updated | ^0.5.0 | ^0.5.1 |                                                                              |
  | @effected/package-json | dependency | updated | ^0.5.0 | ^0.5.1 |                                                                              |
  | @effected/walker       | dependency | updated | ^0.3.1 | ^0.3.2 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.6.1 | ^0.6.2 |                                                                              |
  | @effected/yaml         | dependency | updated | ^0.5.0 | ^0.5.1 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 4.2.3

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/package-json | dependency | updated | ^0.4.2 | ^0.5.0 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.6.0 | ^0.6.1 | [#351][#351] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#351]: https://github.com/savvy-web/systems/pull/351

## 4.2.2

### Dependencies

* | Dependency | Type       | Action  | From   | To     |                                                                              |
  | ---------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | prettier   | dependency | updated | ^3.9.5 | ^3.9.6 | [#349][#349] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#349]: https://github.com/savvy-web/systems/pull/349

## 4.2.1

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                       |
  | ---------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | @effected/package-json | dependency | updated | ^0.4.1 | ^0.4.2 |                                                                       |
  | @effected/workspaces   | dependency | updated | ^0.5.2 | ^0.6.0 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 4.2.0

### Bug Fixes

* `Lint.PnpmWorkspace.formatContent` no longer post-processes its output through Prettier. It now stringifies directly via `@effected/yaml` with `quoteStyle: "double"` and `indentSequences: true`, producing the repo's byte format in one pass. This fixes a formatter regression where scoped package keys in `pnpm-workspace.yaml` were rewritten from double to single quotes (`"@parcel/watcher"` -> `'@parcel/watcher'`) on every `savvy lint fmt pnpm-workspace` run, causing churn on every format pass.

  `formatContent` also dropped its now-unused `filepath` parameter, since there is no longer a second printer (Prettier) that needed it to resolve config.

  * Fixed scoped-package-key quote-style churn in `pnpm-workspace.yaml` formatting
  * `PnpmWorkspace.formatContent(content)` no longer takes a `filepath` argument

### Refactoring

* Replaced `sort-package-json` with `@effected/package-json`'s `PackageJsonFormat.sortValue`/`formatToString` (byte-identical output)
* `SilkPublishability` now reads `WorkspacePackage.workspaceRoot` from the discovered package instead of deriving it internally
* Changeset glob and version-file matching moved to `@effected/glob`'s `compileResult` and `@effected/walker`'s `compileAndExpand`, fixing a latent dot-glob dialect divergence between attribution and materialization (wildcard segments matching dotted directories now agree across both paths) [#336][#336]

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                       |
  | ---------------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | sort-package-json      | dependency | removed | ^4.0.0 | —      |                                                                       |
  | @effected/glob         | dependency | updated | ^0.1.2 | ^0.2.0 |                                                                       |
  | @effected/jsonc        | dependency | updated | ^0.4.0 | ^0.5.0 |                                                                       |
  | @effected/package-json | dependency | updated | ^0.3.1 | ^0.4.1 |                                                                       |
  | @effected/walker       | dependency | updated | ^0.2.2 | ^0.3.1 |                                                                       |
  | @effected/workspaces   | dependency | updated | ^0.4.1 | ^0.5.2 |                                                                       |
  | @effected/yaml         | dependency | updated | ^0.4.0 | ^0.5.0 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#336]: https://github.com/savvy-web/systems/pull/336

## 4.1.0

### Features

* Added `Lint.PnpmWorkspace.formatContent(content, filepath?)` — a public static that stringifies sorted `pnpm-workspace.yaml` content and normalizes it through Prettier's YAML printer to the repo's canonical byte format (2-space block-sequence indent, double-quoted scalars).

  `Lint` handlers have two entry points that must never drift from each other: the lint-staged `create()` handler and the `savvy lint fmt <name>` CLI subcommand. `formatContent` is now the single source of truth both call, so the two paths always produce identical bytes for the same file.

  ````typescript
  import { Lint } from "@savvy-web/silk-effects";

  const formatted = await Lint.PnpmWorkspace.formatContent(sortedContent, "pnpm-workspace.yaml");
  ``` [#328](https://github.com/savvy-web/systems/pull/328) Thanks [@spencerbeggs](https://github.com/spencerbeggs)!
  ````

### Dependencies

* | Dependency             | Type       | Action  | From   | To     |                                                                              |
  | ---------------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | @effected/git          | dependency | updated | ^0.4.0 | ^0.4.1 |                                                                              |
  | @effected/glob         | dependency | updated | ^0.1.1 | ^0.1.2 |                                                                              |
  | @effected/jsonc        | dependency | updated | ^0.3.0 | ^0.4.0 |                                                                              |
  | @effected/package-json | dependency | updated | ^0.3.0 | ^0.3.1 |                                                                              |
  | @effected/walker       | dependency | updated | ^0.2.1 | ^0.2.2 |                                                                              |
  | @effected/workspaces   | dependency | updated | ^0.4.0 | ^0.4.1 |                                                                              |
  | @effected/yaml         | dependency | updated | ^0.3.1 | ^0.4.0 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 4.0.1

### Dependencies

* | Dependency           | Type       | Action  | From   | To     |                                                          |
  | -------------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @effected/git        | dependency | updated | ^0.3.0 | ^0.4.0 |                                                          |
  | @effected/glob       | dependency | updated | ^0.1.0 | ^0.1.1 |                                                          |
  | @effected/walker     | dependency | updated | ^0.2.0 | ^0.2.1 |                                                          |
  | @effected/workspaces | dependency | updated | ^0.3.0 | ^0.3.1 |                                                          |
  | @effected/yaml       | dependency | updated | ^0.2.0 | ^0.3.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 4.0.0

### Breaking Changes

* The library now targets `effect@4` and peers on `catalog:effectPeers`; the `@effect/platform` peer is dropped because its abstractions moved into core `effect`.
* All 19 services convert from `Context.Tag` to class-based `Context.Service`, and each now exports a companion `*Shape` interface for structural consumers.
* Result schemas, tagged errors, and value objects are rebuilt on the v4 `Schema` surface; consumers that embed these types (notably the MCP tool contracts) must update to the v4 shapes.

### Dependencies

* | Dependency             | Type           | Action  | From    | To                  |                                                                       |
  | ---------------------- | -------------- | ------- | ------- | ------------------- | --------------------------------------------------------------------- |
  | jsonc-effect           | dependency     | removed | ^0.3.1  | —                   |                                                                       |
  | semver-effect          | dependency     | removed | ^0.3.1  | —                   |                                                                       |
  | tinyglobby             | dependency     | removed | ^0.2.17 | —                   |                                                                       |
  | workspaces-effect      | dependency     | removed | ^2.1.0  | —                   |                                                                       |
  | yaml                   | dependency     | removed | ^2.9.0  | —                   |                                                                       |
  | yaml-effect            | dependency     | removed | ^0.7.2  | —                   |                                                                       |
  | @effect/platform       | peerDependency | removed | ^0.96.0 | —                   |                                                                       |
  | effect                 | peerDependency | updated | ^3.21.0 | catalog:effectPeers |                                                                       |
  | @effected/git          | dependency     | added   | —       | ^0.3.0              |                                                                       |
  | @effected/glob         | dependency     | added   | —       | ^0.1.0              |                                                                       |
  | @effected/jsonc        | dependency     | added   | —       | ^0.2.0              |                                                                       |
  | @effected/package-json | dependency     | added   | —       | ^0.3.0              |                                                                       |
  | @effected/walker       | dependency     | added   | —       | ^0.2.0              |                                                                       |
  | @effected/workspaces   | dependency     | added   | —       | ^0.3.0              |                                                                       |
  | @effected/yaml         | dependency     | added   | —       | ^0.2.0              | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

* Git invocation unifies onto `@effected/git`, including the repos manager's full mutating tier; workspace discovery moves to `@effected/workspaces` with deterministic per-package root derivation.
* Glob, JSONC, YAML, and directory walking adopt `@effected/glob`, `@effected/jsonc`, `@effected/yaml`, and `@effected/walker`, retiring the hand-rolled glob walker for `Walker.descend`. [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 3.3.1

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                                              |
  | ----------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 3.3.0

### Features

* ### `Repos` namespace: vendored reference repos

  Adds a new public `Repos` namespace for managing vendored reference repos under a project's `.repos/` directory — git submodules kept purely as read-only agent authorities, never forks to modify.

  ```ts
  import { Repos } from "@savvy-web/silk-effects";

  const manager = yield* Repos.ReposManager;
  const report = yield* manager.status(root);
  // report.clean, report.repos[].{ name, ref, purpose, present, commit, dirty, staleNoteIds }
  ```

  The manifest lives at `.repos/config.json`. Each entry (`Repos.RepoEntry`) declares a `url`, a pinned `ref`, a required `purpose`, optional `sparse` checkout paths, an optional `orientation` block (`layout`, `keyPaths`, `startHere`), and up to ten agent-authored `notes` — each stamped with a content-hash `id` and the ref it was written against.

  Two services back the namespace:

  * `Repos.ReposConfigStore` — reads, validates, and writes the manifest.
  * `Repos.ReposManager` — drift reporting (`status`), idempotent self-healing sync that clears stale git lock files before reinitializing a submodule (`sync`), staging a new vendored repo with a shallow ref fetch (`add`), re-pinning an existing entry to a new ref (`pin`), and adding, removing, or promoting agent notes (`note`). `add` and `pin` stage their changes and hand back a ready-made commit message rather than committing.

  A missing manifest is a distinct, non-error `ReposConfigError` kind (`"missing"`) from a corrupt one (`"invalid"`), so callers can render the common "nothing vendored yet" case as a friendly no-op.

### Documentation

* Corrected the `ShellScripts` lint handler's TSDoc: the exec-bit strip is now explained as intentional normalization (scripts run via `bash <script>`, so the mode is never needed at runtime), and the `.claude/scripts/` default exclude is now described as a consumer escape-hatch convention rather than something Silk itself requires — the previous comment incorrectly claimed it was needed "for lint-staged hooks to work." [#299][#299]

### Maintenance

* The generated markdownlint template now ignores `**/.repos`, so vendored submodule content is excluded from lint runs in projects that adopt the pattern via `savvy init`'s union-merge. [#292][#292]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

[#299]: https://github.com/savvy-web/systems/pull/299

## 3.2.5

### Dependencies

* | Dependency  | Type       | Action  | From   | To      |                                                                              |
  | ----------- | ---------- | ------- | ------ | ------- | ---------------------------------------------------------------------------- |
  | shell-quote | dependency | updated | ^1.9.0 | ^1.10.0 | [#283][#283] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#283]: https://github.com/savvy-web/systems/pull/283

## 3.2.4

### Dependencies

* | Dependency | Type       | Action  | From   | To     |                                                                       |
  | ---------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | prettier   | dependency | updated | ^3.9.4 | ^3.9.5 | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 3.2.3

### Bug Fixes

* `Changesets.DepsRegen.plan()` no longer deletes a pure dependency changeset it isn't about to recreate (#258). The delete set is now restricted to packages that actually produced a fresh diff in the current run, and a changeset already committed at the merge-base ref — authored by an earlier, already-merged change — is never deleted by an unrelated branch's regen pass. Previously a devDependency-only manifest change silently destroyed the package's existing dependency changeset with nothing to replace it, and running regen on an unrelated branch could wipe out release notes for already-merged work.
* `ConfigInspector` and `ChangesetConfig` gained a `refresh()` method that drops their per-root caches, which otherwise never expire. `DepsRegen.plan()` now calls both up front, so long-lived host processes (for example, an MCP server holding one `DepsRegen` for its whole lifetime) see on-disk `.changeset/config.json` edits — the `ignore` list, `privatePackages.version`, and `baseBranch` — made between calls (#229). [#267][#267]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#267]: https://github.com/savvy-web/systems/pull/267

## 3.2.2

### Bug Fixes

* Replaced the unanchored trailing-slash regex in the workspace analysis `sameRegistry` comparison with a shared index-scan helper (`trimTrailingSlashes`), eliminating a polynomial-time regex (CodeQL `js/polynomial-redos`) that degraded to O(n²) on registry strings containing long interior slash runs. `normalizeDir` in the publishability service now uses the same helper. [#265][#265]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#265]: https://github.com/savvy-web/systems/pull/265

## 3.2.1

### Bug Fixes

* `Changesets.DepsRegen.plan` now refreshes the `WorkspaceDiscovery` cache before any workspace read — the `ConfigInspector` base-branch fallback, the worktree snapshot, and the versionable-package gating — so it diffs the workspace as it is on disk at plan time. Previously, in a process that had already enumerated the workspace before manifests were edited (the natural flow of an updater tool like silk-update-action), those reads were served pre-edit manifests from the discovery layer's lifetime cache, and the plan silently collapsed to zero changesets.

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                                       |
  | ----------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | [#262][#262] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#262]: https://github.com/savvy-web/systems/pull/262

## 3.2.0

### Features

* ### Refuse to publish a directory the prod `targets.json` binding does not describe

  `SilkPublishability.resolveTargets` now asserts that every surviving target's directory is one of the group directories named by the package's `dist/prod/targets.json`, whenever that binding exists. A directory outside it means publishability detection did not select the prod build output.

  This is the `yaml-effect@0.7.1` shape from #143: silk mode was misdetected, detection fell through to the vanilla `publishConfig.directory` branch and picked `dist/dev/pkg`, and the dev manifest — still carrying `catalog:` specifiers — was packed and published. The published package could not be installed anywhere (`EUNSUPPORTEDPROTOCOL: Unsupported URL Type "catalog:"`).

  * New `PublishTargetBindingError` (exported) carries the package, the directory detection chose, and the directories the binding actually binds.
  * `resolveTargets` gains that error in its error channel; it was previously `never`. Callers must handle or propagate it.
  * Before the prod build writes a binding there is nothing to check, so pre-build placeholder directories are left alone.

  Refs #143, #144. [#257][#257]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#257]: https://github.com/savvy-web/systems/pull/257

## 3.1.0

### Features

* `DepsRegen` gains batch and exclude controls for regenerating dependency changesets across several packages in a single call:

  * `DepsRegenOptions.packages` — restrict a run to a list of workspace packages, unioned with the existing single-package `package` option. Explicit targets bypass the versionable gate but not the ignore list.
  * `DepsRegenOptions.exclude` — drop packages from scope entirely: nothing is written for them, and their existing pure-dependency changesets are left untouched. `exclude` wins over both `package` and `packages`.

  ```ts
  import { Changesets } from "@savvy-web/silk-effects";

  const plan = yield* Changesets.DepsRegen.plan({
  	cwd: process.cwd(),
  	packages: ["@scope/a", "@scope/b"],
  	exclude: ["@scope/c"]
  });
  ```

### Bug Fixes

* `computeWorkspaceDependencyDiffs` no longer reports a dependency reclassified between fields at an unchanged resolved version (e.g. moved from `devDependencies` to `dependencies` with no version bump) as an unrelated removed row plus an added row — the pair now collapses to nothing. A move that also changes the resolved version still produces both rows.
* `BranchAnalyzer.analyzeBranch` no longer reports the branch's own `.changeset/*.md` files in `files[]` / `unmappedFiles` — they are the artifact being reconciled, never a classification question. [#241][#241]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#241]: https://github.com/savvy-web/systems/pull/241

## 3.0.3

### Bug Fixes

* `VersionFiles.updateFile` now performs format-preserving in-place edits via jsonc-effect's `modify`/`applyEdits` (minimal edit spans, requires `jsonc-effect >= 0.3.1`) instead of round-tripping through `JSON.parse`/`JSON.stringify`, so a version bump produces a one-line diff and the rest of the document — inline arrays, comments, indentation — survives byte-for-byte (closes #234)
* JSONC documents (comments, trailing commas) are now supported in versionFiles-managed files; the dry-run preview paths in `processVersionFiles`/`processResolvedVersionFiles` parse via jsonc-effect too, so a commented file previews cleanly instead of throwing
* A wildcard-free JSONPath whose leaf property does not yet exist is now inserted using the document's detected indent, instead of being silently skipped [#235][#235]

### Dependencies

* | Dependency   | Type       | Action  | From   | To     |                                                                       |
  | ------------ | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | jsonc-effect | dependency | updated | ^0.3.0 | ^0.3.1 | [#235][#235] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#235]: https://github.com/savvy-web/systems/pull/235

## 3.0.2

### Dependencies

* | Dependency        | Type       | Action  | From   | To     |                                                                       |
  | ----------------- | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | yaml-effect       | dependency | updated | ^0.7.0 | ^0.7.2 |                                                                       |
  | workspaces-effect | dependency | updated | ^2.0.1 | ^2.0.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#232]: https://github.com/savvy-web/systems/pull/232

## 3.0.1

### Bug Fixes

* `ChangesetConfigReader` now recognizes the standalone `@savvy-web/changelog` package as a Silk changelog adapter. Configs written by the new `savvy init` (which uses `@savvy-web/changelog` as the canonical `changelog` id) were silently decoded as plain non-Silk configs because the id matched neither legacy marker substring. The two legacy id families (`@savvy-web/changesets` and `@savvy-web/silk/changesets`) remain accepted.

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.0.0

### Breaking Changes

* Migrates the changesets integration from the stable v2 line to the v3 `next` prereleases (`@changesets/apply-release-plan@^8.0.0-next.7`, `@changesets/config@^4.0.0-next.6`, `@changesets/get-release-plan@^5.0.0-next.7`, `@changesets/get-github-info@^1.0.0-next.3`, `@changesets/types@^7.0.0-next.6`). The underlying release-plan engine, config reader, and GitHub info client are all new major versions with their own behavior changes; test upgrades against a real changeset flow before relying on it in CI.
* `ReleasePlanner` now drives the v3 engine directly: config loading uses the non-throwing `readConfig` result (invalid config now surfaces as a description-only failure rather than a thrown parse error) and workspace discovery consumes the manypkg v3 `Packages` shape natively. The v1-shaped compatibility adapter that previously bridged `@manypkg/get-packages@3.x` down to the engine's v1 `Packages` contract has been deleted.

### Features

* ### `changelogModules` option on `ReleasePlanner.apply`

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

### Dependencies

* | Dependency                     | Type       | Action  | From    | To            |                                                                       |
  | ------------------------------ | ---------- | ------- | ------- | ------------- | --------------------------------------------------------------------- |
  | @changesets/apply-release-plan | dependency | updated | ^7.1.1  | ^8.0.0-next.7 |                                                                       |
  | @changesets/config             | dependency | updated | ^3.1.4  | ^4.0.0-next.6 |                                                                       |
  | @changesets/get-github-info    | dependency | updated | ^0.8.0  | ^1.0.0-next.3 |                                                                       |
  | @changesets/get-release-plan   | dependency | updated | ^4.0.16 | ^5.0.0-next.7 | [#218][#218] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Major Changes

[#218]: https://github.com/savvy-web/systems/pull/218

## 2.1.0

### Features

* ### Release lines no longer carry commit-link prefixes

  Generated CHANGELOG release lines drop the ``[`abc1234`](.../commit/abc1234)`` prefix that used to lead every entry. Squash-merge workflows collapse a PR into a single squash commit, so per-changeset commit links pointed at the wrong commit and added no useful history — git history is already the reference. Authored links, issue references (`Closes`/`Fixes`/`Refs`), and PR/user attribution are unchanged.

  Before:

  ```markdown
  - [`abc1234`](https://github.com/org/repo/commit/abc1234) Fixed the thing
  ```

  After:

  ```markdown
  - Fixed the thing
  ```

  One consequence: identical summaries from separate changesets now genuinely deduplicate. Commit-hash prefixes previously made every rendered line unique, which masked `DeduplicateItemsPlugin` from collapsing duplicate entries across sections.

  **Upgrading:** No action required. Regenerating `CHANGELOG.md` with this version drops the prefix on newly rendered entries; previously published entries are unaffected until re-rendered.

- ### Maintenance notes for changeset-less releases

  Version-only releases forced by `fixed`/`linked` version groups now get a generated `### Maintenance` note instead of shipping an empty version block. The note names the triggering package (e.g. "Released in lockstep with `@scope/pkg@1.2.3` (fixed version group)."), with a generic fallback sentence when the trigger can't be determined.

  New public API: `MaintenanceNotePlugin`, `deriveMaintenanceReason`, `MaintenanceReasonSchema`, `MaintenanceTriggerSchema`, the derived `MaintenanceReason`/`MaintenanceTrigger` types, and a `maintenance` option on `ChangelogTransformer`'s `TransformOptions`.

  ### Dependency tables under their own heading

  Dependency update tables are now emitted under their own `### Dependencies` heading instead of surfacing beneath the engine's default `### Patch Changes` wrapper.

### Bug Fixes

* `ChangelogTransformer.transformContent` now runs the full `SilkChangesetTransformPreset`, restoring the `AggregateDependencyTablesPlugin` pass that merges duplicate dependency tables.

## 2.0.2

### Dependencies

* [`5ada627`](https://github.com/savvy-web/systems/commit/5ada627c7e8b959036f0a7e1bf9ecaf4978136c8) | Dependency | Type | Action | From | To |
  \| --------------------- | ---------- | ------- | ------ | ------ |
  \| @manypkg/get-packages | dependency | updated | ^1.1.3 | ^3.1.0 |

## 2.0.1

### Bug Fixes

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| semver-effect | dependency | updated | ^0.3.0 | ^0.3.1 |
  \| workspaces-effect | dependency | updated | ^2.0.0 | ^2.0.1 |

## 2.0.0

### Breaking Changes

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) ### `Changesets.DepsRegen` moves to `workspaces-effect`'s point-in-time snapshots

The `Changesets` namespace no longer exports its own git-ref workspace reader. `DepsRegen` now snapshots both sides of a diff through `workspaces-effect`'s `PointInTimeWorkspace` service, which resolves `catalog:`/`workspace:` specifiers per-ref before rows are ever compared.

Removed from `@savvy-web/silk-effects` (`Changesets` namespace):

* `WorkspaceSnapshotReader`, `WorkspaceSnapshotReaderBase`, `WorkspaceSnapshotReaderLive`
* `WorkspaceSnapshot` (type), `WorkspaceSnapshotReaderShape` (type)
* `snapshotFromWorktree`
* `resolveDiffRows`

If you composed `DepsRegenLive` by hand, replace `WorkspaceSnapshotReaderLive` and `CatalogResolverLive` with `PointInTimeWorkspaceLive` (from `workspaces-effect`):

```typescript
// Before
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
  Layer.provide(Changesets.WorkspaceSnapshotReaderLive),
  Layer.provide(CatalogResolverLive.pipe(Layer.provide(LockfileReaderLive))),
  Layer.provide(PublishabilityDetectorLive),
);

// After
const DepsRegenGroupLive = Changesets.DepsRegenLive.pipe(
  Layer.provide(PointInTimeWorkspaceLive.pipe(Layer.provide(WorkspaceLive))),
  Layer.provide(PublishabilityDetectorLive),
  Layer.provide(
    ChangesetConfigLive.pipe(Layer.provide(ChangesetConfigReaderLive)),
  ),
);
```

`gitMergeBase` still exists but relocated from `Changesets.snapshotFromWorktree`'s module to `./utils/git.js` — the public export path (`Changesets.gitMergeBase`) is unchanged.

### Features

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) ### `DepsRegenDefault` batteries-included layer

`Changesets.DepsRegenDefault` provides the full `DepsRegen` dependency graph with silk's opinionated defaults — point-in-time snapshots, config inspection, and the adaptive publishability detector — leaving only the platform services to supply:

```typescript
import { NodeContext } from "@effect/platform-node";
import { Layer } from "effect";
import { Changesets } from "@savvy-web/silk-effects";

const depsRegen = Changesets.DepsRegenDefault.pipe(
  Layer.provide(NodeContext.layer),
);
```

Note the layer reads git history, so it needs a `CommandExecutor`-capable platform layer (`NodeContext.layer`), not a bare filesystem layer. `DepsRegenLive` is unchanged for callers who inject their own dependencies.

### Refactoring

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) Routed `DepsRegen` and `ReleasePlanner` file I/O through `@effect/platform`'s `FileSystem` instead of `node:fs` (#205, #144). `ReleasePlanner`'s preview path now uses a `Scope`-managed temp directory that is cleaned up automatically. New `ChangesetIOError` tagged error surfaces changeset file read/write/list/delete failures.

### Dependencies

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^1.2.0 | ^2.0.0 |

### `DepsRegen` error channels and layer requirements changed

* `plan()` now fails with `GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError` (previously `GitError | WorkspaceDiscoveryError`).
* `execute()` now fails with `ChangesetIOError` — it was previously infallible. Write failures are loud; stale-changeset deletion stays skip-and-continue so an interrupted run stays safely re-runnable.
* `DepsRegenLive` drops its `CatalogResolver` and `WorkspaceSnapshotReader` requirements and now requires `PointInTimeWorkspace`, `ChangesetConfig`, and `FileSystem.FileSystem` in addition to `WorkspaceDiscovery` and `PublishabilityDetector`.
* `ReleasePlannerLive` gains a `FileSystem.FileSystem` requirement (its preview path now writes to a scope-managed temp directory instead of `node:fs`).

Any handler that only caught `GitError` needs to add the new tags:

```typescript
program.pipe(
  Effect.catchTags({
    GitError: handleGit,
    GitReadError: handleSnapshot,
    CatalogAssemblyError: handleSnapshot,
    WorkspaceRootNotFoundError: handleSnapshot,
    WorkspaceDiscoveryError: handleDiscovery,
    ChangesetIOError: handleIO,
  }),
);
```

### `listPublishablePackageNames` takes an explicit project root

`Changesets.listPublishablePackageNames(packages, root)` gains a required `root` parameter (the project root containing `.changeset/`), passed through to the publishability detector. Previously each package's own directory was passed, which made the adaptive detector's changeset-config lookup miss and silently classify every package as non-publishable. Pass the same workspace root you give `DepsRegen.plan`.

### Per-ref catalog/workspace specifier resolution before diffing (#208)

The dependency diff behind `savvy changeset deps regen`/`detect` now resolves `catalog:` and `workspace:` specifiers against each ref's own catalogs and package versions *before* comparing them. A package that merely adopts a `catalog:` specifier without its resolved version changing no longer produces a row; a catalog version bump under a stable specifier now correctly produces an updated row showing the concrete `from`/`to` versions.

### Dependency-changeset gating tightened (#209)

A package is now in scope for dependency-changeset regeneration and stale-changeset cleanup when it is `publishable OR privatePackages.version` **and** not on the changeset ignore list — the ignore list wins over an explicit `--package` target. Previously only publishability was considered.

## 1.6.0

### Features

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) Added `Changesets.DepsRegen`, a `plan()`/`execute()` service that owns dependency-changeset regeneration. `plan()` computes the cumulative dependency diff and returns a complete, side-effect-free plan; `execute()` applies it. Along the way it resolves `catalog:`/`workspace:` specifiers to concrete versions (falling back to the raw specifier when a catalog cannot be resolved, so a commit is never blocked) and drops `devDependency` rows, which never reach a consumer.

`ChangesetLinter` now enforces the dependency-table format: `validateContent` runs the remark `DependencyTableFormatRule`, so `savvy changeset check`/`lint` and the `changeset_validate` MCP tool reject a prose `## Dependencies` section — the same check the pre-commit markdownlint CSH005 rule already ran. The dependency-table version pattern is now a single exported `VERSION_RE`, widened to accept `catalog:`/`workspace:`/`npm:` protocol specifiers.

Closes the changeset validator split-brain behind #193, #199, and #151.

### Dependencies

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) | Dependency | Type | Action | From | To |
  \| ------------- | ---------- | ------- | ------ | ------ |
  \| jsonc-effect | dependency | updated | ^0.2.1 | ^0.3.0 |
  \| semver-effect | dependency | updated | ^0.2.1 | ^0.3.0 |
  \| yaml-effect | dependency | updated | ^0.6.0 | ^0.7.0 |

## 1.5.2

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.

## 1.5.1

### Dependencies

* | [`689a1aa`](https://github.com/savvy-web/systems/commit/689a1aa25f72a4521ff8e21c3fd610862247a0ce) | Dependency    | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :------ | :------ | -- |
  | shell-quote                                                                                       | dependency    | updated | ^1.8.4  | ^1.9.0  |    |
  | @commitlint/types                                                                                 | devDependency | updated | ^21.0.1 | ^21.1.0 |    |

## 1.5.0

### Features

* [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) The commitlint config types reachable from `CommitlintUserConfig` are now exported flat from the package entry, in addition to the `Commitlint` namespace: `CommitlintPlugin`, `PromptConfig`, `PromptSettings`, `RuleApplicability`, `RuleConfigTuple`, `RuleSeverity`, and `RulesConfig`. This lets a generated `commitlint.config.ts` name them directly for declaration emit.

### Documentation

* [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) Added `@public` release tags across the public surface of all three packages so every exported symbol registers in the generated API model and passes the `ae-missing-release-tag` check. In `github-action-builder`, promoted the `Data.TaggedError` base classes and the `Schema`-derived type sources to `@public` to clear `ae-incompatible-release-tags`. Fixed TSDoc link warnings: unresolvable `{@link}` references (Effect `Context.Tag` service methods, which live in the tag's type argument rather than as class members, plus external symbols) were replaced with backtick code spans, ambiguous references were given member-reference selectors, and the stale `PublishabilityDetector` reference was retargeted to `SilkPublishability`. Removed stray `@packageDocumentation` tags from non-entry modules so only each package entry carries one.

This is a documentation-surface change only — every retagged symbol was already exported, and the build performs no `@internal` trimming, so the shipped type declarations are unchanged.

## 1.4.0

### Features

* [`ec206d3`](https://github.com/savvy-web/systems/commit/ec206d3cb8b0c1687b6e89f0b2a49c866a53fb7f) Adds a Changesets.ReleasePlanner service that drives the genuine changesets
  engine to compute a release plan, render a non-destructive preview of the next
  release, or natively apply a release. Preview runs the real formatter in a
  throwaway directory and reads the result back, so its output matches what ships.

## 1.3.1

### Bug Fixes

* [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### commit-quality reminder no longer fires on every prompt

The silk plugin injected the commit-create skill reminder on every `UserPromptSubmit` whose text mentioned a commit-adjacent verb (`commit`, `ship`, `finalize`, and the like). Because the trigger matched any mention — "look at the last commit", "revert that commit" — rather than an intent to create one, the block appeared on analysis, review, and status turns throughout a session and drowned out the turns where a commit was actually being composed.

The blanket `UserPromptSubmit` injection is removed. The commit-create directive is still delivered once per session by the SessionStart orientation block, and the message validation still runs as a just-in-time PreToolUse check on the actual `git commit` and `gh pr create` commands. The now-unused `savvy commit hook user-prompt-submit` subcommand and the `UserPromptSubmitEnvelope` and `userPromptSubmitContext` hook helpers are removed along with it.

* [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### markdownlint no longer lints files under `.git/`

The default markdownlint-cli2 config globs `**/*.{md,mdx}`, which swept ad-hoc session files under `.git/` (for example `.git/sdd/*.md`) and flagged them in the pre-commit hook. `**/.git` is now part of the default `ignores` list, so those files are excluded.

`savvy init` also reconciles `ignores` on an existing config now. On the silk preset without `--force` it previously synced only `$schema` and compared `config`, never touching `ignores`, so existing repos could not pick up new default excludes on a plain re-init. It now non-destructively appends any template ignores a repo is missing while preserving user-added entries — these are additive safety-excludes that cannot change a lint verdict, so they apply automatically, unlike `config` rules which stay warn-only.

## 1.3.0

### Bug Fixes

* [`2d7893a`](https://github.com/savvy-web/systems/commit/2d7893afbd2f82324f94a2a70eeeac2ee4b28b89) ### npm and GitHub Packages targets opt into provenance by default

`SilkPublishability.detect` now derives `PublishTarget.provenance` from the target registry: `true` for the npm public registry and GitHub Packages, `false` for JSR and custom registries. Previously every resolved target defaulted to `provenance: false`, so a consumer that gates attestation on the flag — such as the release action — never attested a published tarball and left the provenance column of its release summary empty.

The default is registry-derived rather than keyed to the `npm`/`github` target ids, so a custom target key pointed at `registry.npmjs.org` or `npm.pkg.github.com` also opts in.

## 1.2.0

### Features

* [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `Lint.POST_COMMIT_HOOK_PATH` export (#122)

A new constant `Lint.POST_COMMIT_HOOK_PATH` is exported from the `Lint` namespace, resolving to `.husky/post-commit`. It holds the conventional path for the savvy-hooks post-commit hygiene script so callers that create or inspect the hook do not need to hard-code the path themselves.

### `ConfigInspector` augments explicit `packages` records (#127)

`Changesets.ConfigInspector` now **augments** an explicit `.changeset/config.json` `packages` record with the remaining release-surface workspace packages detected via `SilkPublishability`, rather than treating the record as a closed allow-list.

Previously, a `packages` record that existed only to annotate one package's `versionFiles` caused every other workspace package to be classified as unmapped during branch analysis. With this fix, all publishable workspace packages appear in the attribution map; packages whose annotation (`additionalScopes`, `versionFiles`, etc.) comes entirely from the config record retain their annotation, while unannotated packages are added with default attribution.

### Markdownlint template ignores test-fixture directories (#123)

The generated `.markdownlint-cli2.jsonc` template now adds `**/__test__/**/fixtures/**` and `**/__fixtures__/**` to its `ignores` list. This brings the markdownlint handler into parity with the Yaml, Biome, and PackageJson handlers, which already excluded these paths.

The template's `MD025` rule is now configured as `{ "front_matter_title": "" }` (previously `true`), matching the `MD024: { "siblings_only": true }` rule it already carried. A regenerated config now allows sibling duplicate headings and treats front-matter titles as `H1`s consistently.

## 1.1.0

### Features

* [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) Exposes the changeset resolved-output result types as Effect `Schema`, so downstream tools can validate them and generate schemas from a single source of truth. New exports from the `Changesets` namespace: `BranchAnalysisSchema`, `BranchFileEntrySchema`, `FileStatusSchema`, `InspectedConfigSchema`, `ResolvedPackageScopeSchema`, `ResolvedVersionFileSchema`, `ClassificationSchema`, and `ClassificationReasonSchema`. The existing `BranchAnalysis`, `InspectedConfig`, and related types are now derived from these schemas, so their shape is unchanged.

### Bug Fixes

* [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) `ConfigInspector` now attributes changed files to workspace packages even when `.changeset/config.json` declares no explicit `packages` record. It falls back to the discovered workspace packages that are a release surface — those whose `publishConfig` resolves to publish targets — so single-root repos and monorepos with a non-root package directory get correct attribution instead of an empty result. A private package with no `publishConfig` is correctly excluded, and packages in the `ignore` list remain valid changeset targets.
* `silk/body-no-markdown` no longer flags double-underscore identifiers such as `__PACKAGE_VERSION__` as bold. Bold is now detected only in its asterisk form, so identifier tokens written in commit bodies are accepted.

### Dependencies

* | [`e6e3ee4`](https://github.com/savvy-web/systems/commit/e6e3ee464b9e5ae56e45acbf03b583e1bc11d7c3) | Dependency | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :------ | :------ | -- |
  | tinyglobby                                                                                        | dependency | updated | ^0.2.16 | ^0.2.17 |    |

## 1.0.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | sort-package-json                                                                                 | dependency | updated | ^3.6.1 | ^4.0.0 |    |
  | workspaces-effect                                                                                 | dependency | updated | ^1.1.0 | ^1.2.0 |    |

## 1.0.0

### Breaking Changes

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Publish-target resolution is binding-driven and Record-map only

`SilkPublishability` no longer understands the legacy array form of `publishConfig.targets` — declare targets as the keyed Record-map (`{ npm: true, github: true, … }`). Target resolution now matches the `@savvy-web/bundler` prod layout:

* `SilkPublishability.detect(pkgName, raw, binding)` takes a third argument: the parsed `dist/prod/targets.json` binding (or `null` before the prod build). With a binding it emits one `PublishTarget` per resolved registry target, with `directory` set to the bound group's `dist/prod/<group>/pkg` dir. `npm: true` + `github: true` collapse into one scoped-name byte group deployed to both registries (two targets, one directory). Without a binding it emits one count-accurate placeholder per declared key.
* `access` comes from top-level `publishConfig.access` (default `public`); per-target `access`/`provenance`/`directory` and string shorthands are removed (`provenance` defaults `false`).
* New public API: `readTargetsBinding(fs, pkgPath)` and the binding types `TargetsBinding` / `TargetBinding` / `TargetGroupBinding`. Removed `RawTargetSpec`, replaced by `RawTargetObject` / `RawTargetValue` / `RawPublishTargets`.
* Both `PublishabilityDetector` layers and `SilkWorkspaceAnalyzer` thread the binding through.

### Features

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Adds the `Turbo` read-only Turborepo inspection namespace (`TurboInspector` + `TurboDigest` exposing `diagnoseCache`/`taskGraph`/`affected`, all `--dry`).

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

## 0.6.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

## 0.6.0

### Features

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### Changesets namespace

Adds a `Changesets` namespace export with the full changeset tooling logic extracted from the standalone `@savvy-web/changesets` package. Consumers can import changeset validation, changelog generation, dependency-table utilities, remark pipeline plugins, markdownlint custom rules, and Effect-based services (`ConfigInspector`, `BranchAnalyzer`, `ChangelogService`) directly from `@savvy-web/silk-effects`.

```typescript
import { Changesets } from "@savvy-web/silk-effects";

// Changelog formatter
const { getReleaseLine, getDependencyReleaseLine } = Changesets.Changelog;

// Linter API
const result = await Changesets.Linter.lint(changesetContent);

// Remark pipeline presets
const output = await Changesets.Remark.transform(markdown);
```

### Bug Fixes

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) `SilkWorkspaceAnalyzer.analyze(root)` now passes `root` through to `WorkspaceDiscovery.listPackages()`. Previously the call omitted `root`, causing package discovery to resolve from the process working directory rather than the requested workspace root. Topological sort falls back to discovery order when the sort was built against a different root (e.g. in tests).

### Commitlint namespace

Adds a `Commitlint` namespace export carrying the hook, formatter, config factory, prompt configuration, and detection utilities that back the Silk commitlint integration. Includes the Claude Code hook diagnostics (branch, DCO, open-issues, signing), the custom rules engine, and the silent-logger shim.

```typescript
import { Commitlint } from "@savvy-web/silk-effects";

// Config factory
const config = Commitlint.Config.factory({ scopes: ["feat", "fix"] });

// Formatter
const formatted = Commitlint.Formatter.format(results);
```

### Lint namespace

Adds a `Lint` namespace export with workspace-aware Biome, Markdown, TypeScript, YAML, and shell-script lint handler logic, plus the `createConfig` preset builder and workspace-discovery utilities.

```typescript
import { Lint } from "@savvy-web/silk-effects";

// Create a lint preset config
const config = Lint.Config.createConfig({ preset: "strict" });
```

### Dual-format build

The package now ships both ESM and CJS bundles. The CJS build allows tools with CommonJS loaders — such as `markdownlint-cli2`'s custom-rule loader — to `require()` the markdownlint rules directly from `@savvy-web/silk-effects`.

## 0.5.0

### Features

* [`1321cc8`](https://github.com/savvy-web/systems/commit/1321cc8965d0c24bccf5fc783f0bee7934227b16) ### `ManagedSection.syncMany` — ordered multi-section sync

`ManagedSection.syncMany(path, blocks)` (and its data-last form `syncMany(blocks)(path)`) accepts an ordered array of `SectionBlock` descriptors and ensures every section exists with its given content in declared relative order. Existing sections are updated in place; missing sections are inserted adjacent to their declared sibling. Section order is normalized on each call, user content and unrelated tool sections are preserved, and the operation is idempotent. Returns one `SyncResult` (`Created` / `Updated` / `Unchanged`) per input block, in input order.

```typescript
import { Effect } from "effect";
import {
  ManagedSection,
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.syncMany(".husky/pre-commit", [
    SavvyBaseSection.block(savvyBasePreamble()),
    savvyToolSection(
      "savvy-lint",
      'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
    ),
  ]);
});
// result: [SyncResult.Created, SyncResult.Created]
```

### `ManagedSection.remove` — section removal

`ManagedSection.remove(path, definition)` (and its data-last form `remove(definition)(path)`) removes a managed section's full marker span from the file and collapses the leftover blank line. Returns `true` when a section was removed, `false` when the section is absent or the file does not exist. Useful for migrating renamed sections.

```typescript
const program = Effect.gen(function* () {
  const sections = yield* ManagedSection;
  return yield* sections.remove(".husky/pre-commit", OldSection);
});
// result: true (a section was removed) | false (absent or file missing)
```

### `SavvySections` — shared husky-hook shell helpers

New helpers, exported from the package root, provide composable primitives for building multi-section husky hooks:

* `SavvyBaseSection` + `savvyBasePreamble()` — a package-manager detection preamble that sets `ROOT`, `in_ci`, `PM`, and `pm_exec` shell variables.
* `SavvyHooksSection` + `savvyHooksHygiene()` — a self-guarded repo hygiene section (runs only outside CI).
* `savvyToolSection(toolName, command)` — builds an `in_ci || pm_exec <command>` tool-execution section for any named tool.

Together these let consumer CLIs compose multiple ordered managed sections per hook file and migrate renamed sections cleanly.

```typescript
import {
  SavvyBaseSection,
  savvyBasePreamble,
  savvyToolSection,
} from "@savvy-web/silk-effects";

// savvyToolSection needs a savvy-base section ahead of it in the same hook so
// `in_ci` / `pm_exec` are defined — pass both to syncMany in order.
const blocks = [
  SavvyBaseSection.block(savvyBasePreamble()),
  savvyToolSection(
    "savvy-lint",
    'lint-staged --config "$ROOT/lib/configs/lint-staged.config.ts"',
  ),
];
```

## 0.4.1

### Dependencies

* | [`846ab73`](https://github.com/savvy-web/systems/commit/846ab73ee6d7dba52822cd7d346fa0c2b66156da) | Dependency    | Type    | Action  | From    | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :------ | :------ | -- |
  | workspaces-effect                                                                                 | dependency    | updated | ^1.0.0  | ^1.1.0  |    |
  | @savvy-web/rslib-builder                                                                          | devDependency | updated | ^0.20.4 | ^0.20.6 |    |

## 0.4.0

### Minor Changes

* [`30f6764`](https://github.com/savvy-web/systems/commit/30f6764ead0350128471d09721c4d5df15addb6c) Standardize publishability on workspaces-effect's `PublishTarget` + `PublishabilityDetector` Tag. Adds `SilkPublishability` (the silk `detect` rule plus `expandShorthand`/`resolveTargetAccess` helpers and `resolveTargets`/`listPublishable` resolvers, all as static members), `SilkPublishabilityDetectorLive`, `PublishabilityDetectorAdaptiveLive` (ignore-aware silk/vanilla/none dispatch over the `PublishabilityDetector` Tag), and a `ChangesetConfig` accessor service (`mode`/`versionPrivate`/`ignorePatterns`/`isIgnored`/`fixed`, plus the static `ChangesetConfig.matches` ignore matcher). `SilkWorkspaceAnalyzer` now emits `PublishTarget` and honors `@scope/*` wildcard changeset-ignore patterns.

**Breaking:** removes the bespoke `SilkPublishabilityPlugin`, `TargetResolver`, the `PublishabilitySchemas` exports (`PublishTarget`/`ResolvedTarget`/`PublishProtocol`/`PublishTargetObject`/`PublishTargetShorthand`/`AuthStrategy`), `TargetResolutionError`, and `PublishConfigError`. The changeset-config schema types `ChangesetConfig`/`SilkChangesetConfig` are renamed to `ChangesetConfigFile`/`SilkChangesetConfigFile` — the `ChangesetConfig` name is now the accessor service. `auth`/`tokenEnv` resolution moves consumer-side.

## 0.3.0

### Features

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added `SilkWorkspaceAnalyzer` service — composite service that analyzes a workspace root and produces a complete `WorkspaceAnalysis` result. Discovers workspaces via `workspaces-effect`, detects publishability with Silk multi-target support, reads changeset config, computes versioning strategy, and determines release status per workspace.
* Added `AnalyzedWorkspace` and `WorkspaceAnalysis` — `Schema.TaggedClass` data types with instance methods for workspace queries, target lookups, group membership, and filtered views. Includes `Equal`/`Hash` support and `Pretty` printing.
* Added `SilkPublishConfig` schema — extends the upstream `PublishConfig` from `workspaces-effect` with a Silk `targets` field for multi-registry publishing.
* Extended `ChangesetConfig` to cover the full `@changesets/config@3.1.1` specification, including `privatePackages`, `snapshot`, `prettier`, `changedFilePatterns`, and `bumpVersionsWithWorkspaceProtocolOnly`.

### Tests

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added 100+ fixture files across standalone, pnpm, npm, yarn, and bun workspace configurations, with 29 integration tests that exercise the full `SilkWorkspaceAnalyzer` pipeline against real filesystem reads.
* `AnalyzedWorkspace` and `WorkspaceAnalysis` include property-based test coverage via `fast-check`.

### Maintenance

* [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Migrated all co-located unit tests from `src/` to `__test__/` for consistent `vitest` auto-discovery.

## 0.2.2

### Bug Fixes

* [`b65d3d2`](https://github.com/savvy-web/systems/commit/b65d3d26fb9da4474b9e39225d8c4b85d35e6eac) ### Fix ManagedSection markers missing newline separators from content

BEGIN/END markers were concatenated directly with managed content, producing malformed output where markers and content appeared on the same line. The service now ensures markers are always on their own lines and handles boundary newlines transparently on read/write round-trips.

## 0.2.1

### Bug Fixes

* [`31824c1`](https://github.com/savvy-web/systems/commit/31824c15a013cf5ce13462c4dfc223785f9e893e) Bumps workspaces-effect dependency for parsing issue fix

## 0.2.0

### Features

* [`0da7c1e`](https://github.com/savvy-web/systems/commit/0da7c1e04fa60ad6745d3dbabf9af9a5b68d780d) ### SectionDefinition and SectionBlock value objects

Introduces `SectionDefinition` and `ShellSectionDefinition` as `Schema.TaggedClass` value objects that declare the identity of a managed section type. `SectionDefinition` compares on `toolName` + `commentStyle` via `Equal`/`Hash`. `ShellSectionDefinition` is a convenience subtype that hardcodes `commentStyle` to `"#"`.

`SectionBlock` is the complementary value object holding the content between a pair of managed section markers. Equality is normalized (trimmed, whitespace-collapsed), so cosmetic whitespace differences do not produce spurious diffs.

Both classes expose a dual API (`Fn.dual`) so methods can be used data-first or data-last in a pipeline:

```typescript
import { SectionDefinition, SectionBlock } from "@savvy-web/silk-effects";

const def = new SectionDefinition({ toolName: "silk", commentStyle: "#" });

// Data-first
const block = def.block("\nexport FOO=bar\n");

// Dual static — data-last for pipe composition
const withValidation = SectionDefinition.withValidation((block) =>
  block.content.includes("FOO"),
)(def);
```

### SectionDiff, SyncResult, and CheckResult tagged enums

Three `Data.TaggedEnum` types capture the outcomes of section operations:

* `SectionDiff` — `Unchanged` or `Changed({ added, removed })` from comparing two `SectionBlock` values
* `SyncResult` — `Created`, `Updated({ diff })`, or `Unchanged` from a write-if-changed operation
* `CheckResult` — `Found({ isUpToDate, diff })` or `NotFound` from a read-only comparison

### ManagedSection service redesigned with sync/check/dual API

`ManagedSection` is a fully redesigned `Context.Tag` service backed by `@effect/platform` `FileSystem`. The previous hook-style API is replaced with five operations, all using the dual pattern:

| Method      | Takes               | Returns                |
| :---------- | :------------------ | :--------------------- |
| `read`      | `SectionDefinition` | `SectionBlock \| null` |
| `isManaged` | `SectionDefinition` | `boolean`              |
| `write`     | `SectionBlock`      | `void`                 |
| `sync`      | `SectionBlock`      | `SyncResult`           |
| `check`     | `SectionBlock`      | `CheckResult`          |

`sync` writes only when content has changed and returns a typed result describing what happened. `check` is read-only and reports staleness without writing.

```typescript
import {
  ManagedSection,
  ManagedSectionLive,
  SectionBlock,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";

const block = SectionBlock.make({
  toolName: "silk",
  commentStyle: "#",
  content: "\nexport FOO=bar\n",
});

const program = Effect.gen(function* () {
  const ms = yield* ManagedSection;
  const result = yield* ms.sync(".env.local", block);
  // result is SyncResult.Created | SyncResult.Updated | SyncResult.Unchanged
});

Effect.runPromise(
  program.pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

### ToolDiscovery service

New `ToolDiscovery` `Context.Tag` service that locates CLI tools globally (PATH) or locally (via the detected package manager), extracts versions, enforces source and version constraints, and caches results by tool name.

Three resolution methods:

* `resolve(definition)` — returns `ResolvedTool` or `ToolResolutionError`
* `require(definition, message?)` — like `resolve` but maps failures to `ToolNotFoundError`
* `isAvailable(definition)` — quick boolean availability check, no caching

Resolution behavior is controlled by three tagged-enum policies on `ToolDefinition`:

* `VersionExtractor` — `Flag({ flag, parse? })`, `Json({ flag, path })`, or `None`
* `ResolutionPolicy` — `Report`, `PreferLocal`, `PreferGlobal`, or `RequireMatch`
* `SourceRequirement` — `Any`, `OnlyLocal`, `OnlyGlobal`, or `Both`

```typescript
import {
  ToolDiscovery,
  ToolDiscoveryLive,
  ToolDefinition,
  ResolutionPolicy,
} from "@savvy-web/silk-effects";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

const biome = ToolDefinition.make({
  name: "biome",
  policy: ResolutionPolicy.PreferLocal(),
});

const program = Effect.gen(function* () {
  const td = yield* ToolDiscovery;
  const tool = yield* td.require(biome);
  // tool.exec("check", "--write") returns a ToolCommand
  return yield* tool.exec("check", "--write").string();
}).pipe(Effect.provide(ToolDiscoveryLive), Effect.provide(NodeContext.layer));
```

### ResolvedTool and ToolCommand

`ResolvedTool` is the `Schema.TaggedClass` value returned by `ToolDiscovery`. It carries the resolved source, versions, and package manager, and exposes two command-building methods:

* `exec(...args)` — runs the tool through the local package manager (`pnpm exec`, `npx --no`, etc.) or directly if global
* `dlx(...args)` — runs the tool via the package manager's dlx/npx equivalent without requiring a local install

Both return a `ToolCommand`, a thin wrapper around `@effect/platform` `Command` with instance-method ergonomics (`cmd.string()`, `cmd.lines()`, `cmd.exitCode()`, `cmd.stream()`, `cmd.env()`, `cmd.workingDirectory()`, `cmd.stdin()`).

### Module restructure — single root export, role-based layout

The sub-path exports (`/biome`, `/config`, `/hooks`, `/publish`, `/tags`, `/versioning`) have been removed. All public APIs are now available from the single root import:

```typescript
// Before (v0.1.x)
import { ManagedSection } from "@savvy-web/silk-effects/hooks";
import { TagStrategy } from "@savvy-web/silk-effects/tags";

// After (v0.2.0+)
import { ManagedSection, TagStrategy } from "@savvy-web/silk-effects";
```

Source files are reorganized into four role-based folders: `errors/`, `schemas/`, `services/`, and `utils/`. Unit tests are co-located with their source file.

## 0.1.0

### Features

* [`d553939`](https://github.com/savvy-web/systems/commit/d5539392f70a56ada8b035313fa2d11c98fa5bde) Introduces `@savvy-web/silk-effects`, a platform-agnostic Effect library that consolidates shared Silk Suite conventions into a single package consumed across the ecosystem. The library is built on `@effect/platform` and requires `effect` as a peer dependency -- consumers supply their own platform layer.

### Publish -- Multi-Registry Target Resolution

The `./publish` module resolves raw publish-target values into fully-normalized `ResolvedTarget` records. Supported input forms are the shorthand strings `"npm"`, `"github"`, and `"jsr"`, arbitrary `https://` registry URLs, and structured `PublishTargetObject` values. Auth strategy (`oidc` vs `token`) and token environment variable names are derived automatically from the registry URL.

The module also ships `SilkPublishabilityPlugin`, a plugin for `workspaces-effect` that detects whether a workspace package is publishable by inspecting `publishConfig.access` and `private` fields.

```typescript
import {
  TargetResolver,
  TargetResolverLive,
} from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

### Versioning -- Changeset Config Reading and Strategy Detection

The `./versioning` module reads `.changeset/config.json` files via `ChangesetConfigReader` and detects whether the config uses Silk-specific extensions (`SilkChangesetConfig`). `VersioningStrategy` maps the config to one of three strategy types: `"single"` (one package), `"fixed-group"` (changesets `fixed` array present), or `"independent"`.

### Tags -- Git Tag Format Determination

The `./tags` module provides `TagStrategy`, which determines whether a repository should use single version tags (`1.2.3`) or scoped package tags (`@scope/pkg@1.2.3`) based on the workspace layout and versioning strategy. The `TagStrategyType` union (`"single" | "scoped"`) is exported for consumers that need to branch on the result.

### Hooks -- Managed Section Pattern for Tool-Owned File Regions

The `./hooks` module implements the managed section pattern: tool-owned regions delimited by `BEGIN {TOOL_NAME} MANAGED SECTION` / `END {TOOL_NAME} MANAGED SECTION` markers inside user-editable files. `ManagedSection` exposes `read`, `write`, `update`, and `isManaged` operations that preserve everything outside the markers while replacing managed content. Comment style (`"#"` or `"//"`) is configurable.

### Config -- Config File Discovery with `lib/configs/` Priority

The `./config` module provides `ConfigDiscovery`, which locates config files using a two-level search. When a `lib/configs/` directory contains the target file, it takes priority over the repo root -- the Silk convention for centralizing shared configs in a workspace. The resolved `ConfigLocation` includes both the file path and the `ConfigSource` (`"lib" | "root"`).

### Biome -- `$schema` URL Synchronization

The `./biome` module provides `BiomeSchemaSync`, which scans `biome.json` and `biome.jsonc` files in the working directory and updates their `$schema` field to point to the canonical versioned URL for the target Biome release. `BiomeSyncResult` reports each file as `updated`, `current`, or `skipped`.
