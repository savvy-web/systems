# @savvy-web/silk-effects

## 7.3.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/markdown | dependency | updated | ^0.7.0 | ^0.8.0 |

[#595][#595]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#595]: https://github.com/savvy-web/systems/pull/595

## 7.3.0

### Features

#### Package-manager toolchain drift check

- Adds `SavvyToolchainSection` and `savvyToolchainCheck()`, a new `SAVVY-TOOLCHAIN` managed hook section that warns when the running package manager's version has drifted off the repo's `devEngines.packageManager` pin.

- Warn-only — never blocks the hook and never installs anything

- Skipped under CI, where the runtime action installs the pin by construction

- Honours the `name` recorded in the pin rather than assuming pnpm

- Strips the `+sha512…` integrity tail before comparing, and skips inexact pins (ranges, wildcards)

- Self-contained: defines its own root/CI/pin lookups rather than depending on `SavvyBaseSection`, since its homes (`post-checkout`, `post-merge`) carry `SavvyHooksSection` but no `SavvyBaseSection` [#589][#589]

```ts
import { SavvyToolchainSection, savvyToolchainCheck } from "@savvy-web/silk-effects";

const section = SavvyToolchainSection.section(savvyToolchainCheck());
```

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#589]: https://github.com/savvy-web/systems/pull/589

## 7.2.0

### Features

- Export `CoexistingChangesetSchema`, `RegenDiffRowSchema`, `RegenPlanSchema`, and `RegenResultSchema` from `Changesets`, and derive the existing `CoexistingChangeset`, `RegenDiffRow`, `RegenPlan`, and `RegenResult` types from those schemas so deps-regen result contracts are schema-first runtime surfaces.
- Align `RegenPlanSchema` with `DepsRegen.plan()` output by accepting unresolved raw dependency specifier cells (`*`, `^1.2`, `latest`, etc.) in in-memory regen diff rows.

### Bug Fixes

- Tighten Biome schema URL handling so only an exact `biomejs.dev` hostname is considered managed.
- Update only the `$schema` field during Biome schema sync instead of replacing every matching URL string in the file. [#578][#578]

### Refactoring

- Mark `withChangelogModules` and `extractVersionBlock` as `@internal` test-only helpers while preserving their in-module exports and runtime behavior. [#581][#581]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#578]: https://github.com/savvy-web/systems/pull/578

[#581]: https://github.com/savvy-web/systems/pull/581

## 7.1.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/jsonc | dependency | updated | ^0.8.0 | ^0.8.1 |

[#572][#572]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#572]: https://github.com/savvy-web/systems/pull/572

## 7.1.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/package-json | dependency | updated | ^0.12.0 | ^0.13.0 |

[#565][#565]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#565]: https://github.com/savvy-web/systems/pull/565

## 7.1.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/jsonc | dependency | updated | ^0.7.0 | ^0.8.0 |
| @effected/markdown | dependency | updated | ^0.6.3 | ^0.7.0 |
| @effected/package-json | dependency | updated | ^0.11.0 | ^0.12.0 |
| @effected/yaml | dependency | updated | ^0.11.0 | ^0.12.0 |

[#552][#552]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#552]: https://github.com/savvy-web/systems/pull/552

## 7.1.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/package-json | dependency | updated | ^0.10.2 | ^0.11.0 |

[#550][#550]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#550]: https://github.com/savvy-web/systems/pull/550

## 7.1.0

### Features

- ### Rendered thanks section for contributors
  Changelog rendering now emits a `### Thanks` section at the end of each version block, aggregating contributor attributions instead of smushing them inline. A new `thanks` option controls it:
  ```typescript
  import { Changesets } from "@savvy-web/silk-effects";

  const options: Changesets.ChangesetOptions = {
    repo: "owner/repo",
    thanks: false, // strip attribution entirely; PR links are kept either way
  };
  ```
  `thanks` defaults to `true` and is plumbed through `.changeset/config.json`'s changelog options, `ChangelogTransformer`, and `ReleasePlanner`.
  ### Unified CSH005 dependency-section validation (\#456, \#457)
  The remark-lint rule and the markdownlint rule now share one dependency-section scanner. Prose written before or after a `## Dependencies` table is now accepted by both engines — previously markdownlint alone flagged it. Missing-table diagnostics now anchor at the `## Dependencies` heading in both engines. Rule docs (`CSH001`–`CSH005`) moved in-repo under `packages/silk-effects/docs/rules/`, replacing links to the archived `savvy-web/changesets` repo.
  ### Cross-seeded catalog resolution in dependency diffs (\#539)
  `Changesets.DepsRegen`'s dependency diff now seeds each side of the diff with the other side's catalog declarations at lower precedence, via `@effected/workspaces`' `WorkspaceStateSnapshot.crossSeed`. Config-dependency-injected catalogs (e.g. `catalog:effected`) now resolve to their declared ranges instead of falling through to concrete lockfile versions, eliminating false `^` → exact rows in generated dependency tables. The service graph now composes `Workspaces.layerWithGitAndConfigDependenciesSubprocess`, so subprocess-replayed config-dependency catalog hooks work in bundled hosts (like `savvy-mcp`) that can't rely on an in-process dynamic `import()`.
  ### `runtime` and `packageManager` dependency-table types (\#544)
  The dependency-table `Type` vocabulary gains `runtime` (language runtime bumps, e.g. node) and `packageManager` (the package manager's self-upgrade, e.g. pnpm). Both validate through CSH005 in both lint engines, survive table aggregation, and are classified release-neutral — the same bucket as `devDependency`.
  ### `coexisting` bucket on dependency regeneration (\#279)
  `Changesets.DepsRegen.plan`/`execute` results now include a `coexisting` list: prose-only changesets that reference an in-scope package but aren't touched by the regeneration pass. A new `Changesets.parseChangesetPackages` helper extracts the package names declared in a changeset's frontmatter.
  ### Better unmapped-file attribution (\#290, \#487)
  `Changesets.ConfigInspector` now returns a machine-readable hint on files it can't attribute to a package — for example, a path that used to match a since-deleted `versionFiles`/`additionalScopes` entry, or a known template-mirror path. Discovered package paths are also re-rooted onto the per-call project directory, so inspection now works correctly from git worktrees, not just the primary checkout.
  ### Vanilla changelog renderer re-export (\#413)
  `Changesets.vanillaChangelogFunctions` re-exports `@changesets/changelog-git` unmodified, for consumers (like `silk-release-action`) that need stock changesets rendering — plain summary lines, no sections, no attribution, no dependency tables — without declaring the dependency themselves.
  ```typescript
  import { Changesets } from "@savvy-web/silk-effects";

  const line = await Changesets.vanillaChangelogFunctions.getReleaseLine(
    { id: "x", summary: "Fix a thing", releases: [{ name: "pkg", type: "patch" }] },
    "patch",
    null,
  );
  ```
  ### Canonical markdown emission via `@effected/markdown`
  Changelog rendering now emits through `@effected/markdown`'s canonical stringifier (a documented stability commitment) instead of `remark-stringify`. Rendered output shifts accordingly: `-` bullets, compact table cells, and canonically escaped cell text (`\~`, `\_` — values round-trip unchanged through parsing). Language-less code fences stay fenced via an explicit emit policy.

### Bug Fixes

- Changelog rendering is now AST-native: `### Sub-headings` inside a changeset render as `#### Sub-headings` in the CHANGELOG instead of being demoted to bullets, and tables, code fences, and blockquotes pass through as blocks instead of getting bullet-wrapped
- Contributor attribution no longer lands inside a table cell, fixing duplicated or bulleted dependency tables in released notes
- `aggregate-dependency-tables` now unwraps legacy bullet-wrapped dependency tables and merges authored and synthesized tables into a single table per version, preserving surrounding non-table bullets in place
- Attribution lands on the deepest trailing bullet of a nested list, and list items emptied by attribution stripping no longer leave bare bullets behind
- All five CSH rules recognize setext headings in the markdownlint engine (parity with remark), and changeset classification ignores `## Dependencies` headings quoted inside fenced code blocks
- Harvesting an existing `### Thanks` section whose body is itself attribution-shaped no longer deletes the following sibling section
- Hand-authored `### Thanks` content (prose, plain-name lists, anything without an `@handle`) round-trips untouched through the transformer instead of being deleted; only pure attribution paragraphs are harvested into the merged credit
- `ConfigInspector.refreshIn` on a child directory now also clears the cached parent workspace root, matching its documented contract [#547][#547]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/changelog-git | dependency | added | — | ^1.0.0 |  |
  | @effected/markdown | dependency | added | — | ^0.6.3 |  |
  | @effected/workspaces | peerDependency | updated | ^0.17.0 | ^0.18.0 | [#547][#547] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#547]: https://github.com/savvy-web/systems/pull/547

## 7.0.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/yaml | dependency | updated | ^0.10.0 | ^0.11.0 |  |
  | @effected/workspaces | peerDependency | updated | 0.17.1 | 0.17.2 | [#542][#542] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#542]: https://github.com/savvy-web/systems/pull/542

## 7.0.0

### Breaking Changes

- ### `@effected/workspaces`, `@effected/git` and `@effected/commands` are now required peer dependencies
  These three are no longer installed for you. Declare them yourself, or your install will report an unmet peer.
  ```jsonc
  {
    "dependencies": {
      "@effected/commands": "catalog:effected",
      "@effected/git": "catalog:effected",
      "@effected/workspaces": "catalog:effected"
    }
  }
  ```
  If you consume the `@effected/pnpm-plugin-effect` config dependency at `0.6.0` or later, prefer the catalog
  references above so both sides of the peer relationship move together on a single config bump. Otherwise declare
  literal ranges — `@effected/commands@^0.5.0`, `@effected/git@^0.9.0`, `@effected/workspaces@^0.17.0`.

  **Why this is breaking on purpose.** Consuming this package both directly and transitively — through&#10;`@savvy-web/silk` to `cli`/`mcp` — used to put two copies of it in one tree whenever the direct pin drifted, and
  each copy dragged its own kit. Both were bundled into the resulting artifact. Nothing failed; the build stayed
  green and shipped two of everything.

  As peers, that skew becomes visible instead of silent. Two copies mean two distinct type identities, so a
  mismatched consumer fails at `tsc` with an unsatisfiable `Layer` — a service reading unprovided in a graph that
  visibly provides it — rather than installing clean and bundling both.

  **The stop is typecheck, not install.** With `autoInstallPeers: true` and `strictPeerDependencies` unset (pnpm's
  default), a conflicting peer range prints a warning and the install still exits 0. A repo whose CI only bundles,
  without a typecheck step, will not catch the skew. Turning this into an install-time failure means setting&#10;`strictPeerDependencies: true`, which is a behavior change for every consuming repo and belongs in its own
  change.

  Only these three moved. They are the packages whose services and types cross this package's public API boundary —&#10;`WorkspaceSnapshots` in `DepsRegen.layer`, `Git` in the service layers, `ToolDiscovery` in `TurboInspector`. The
  other seven `@effected/*` dependencies remain ordinary dependencies: a duplicate of a pure-function package costs
  bytes, not correctness.

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @effected/commands | peerDependency | added | — | ^0.5.0 |  |
  | @effected/commands | dependency | removed | ^0.5.0 | — |  |
  | @effected/commands | devDependency | added | — | ^0.5.0 |  |
  | @effected/git | peerDependency | added | — | ^0.9.0 |  |
  | @effected/git | dependency | removed | ^0.9.0 | — |  |
  | @effected/git | devDependency | added | — | ^0.9.0 |  |
  | @effected/workspaces | peerDependency | added | — | ^0.17.0 |  |
  | @effected/workspaces | dependency | removed | ^0.17.0 | — |  |
  | @effected/workspaces | devDependency | added | — | ^0.17.1 | [#537][#537] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

* | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | removed | ^0.17.0 | — |  |
  | @effected/commands | peerDependency | added | — | 0.5.0 |  |
  | @effected/git | peerDependency | added | — | 0.9.0 |  |
  | @effected/workspaces | peerDependency | added | — | 0.17.1 | [#537][#537] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#537]: https://github.com/savvy-web/systems/pull/537

## 6.0.5

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.16.0 | ^0.17.0 | [#532][#532] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#532]: https://github.com/savvy-web/systems/pull/532

## 6.0.4

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.15.1 | ^0.16.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 6.0.3

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.15.0 | ^0.15.1 | [#525][#525] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#525]: https://github.com/savvy-web/systems/pull/525

## 6.0.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.14.2 | ^0.15.0 | [#522][#522] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#522]: https://github.com/savvy-web/systems/pull/522

## 6.0.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.10.1 | ^0.10.2 |  |
  | @effected/workspaces | dependency | updated | ^0.14.1 | ^0.14.2 | [#513][#513] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#513]: https://github.com/savvy-web/systems/pull/513

## 6.0.0

### Breaking Changes

- ### `ClosingReferences.BARE_LINE_PATTERN` removed
  The regex static that matched a bare `Closes #123`-style line is no longer part of the public API. `ClosingReferences.parseBare(region)` remains — same signature, same return shape — and is now backed by `@effected/github-references`.

  If you were matching against `ClosingReferences.BARE_LINE_PATTERN` directly, call `parseBare` instead:
  ```typescript
  // before
  const ids = region
  	.split("\n")
  	.map((line) => ClosingReferences.BARE_LINE_PATTERN.exec(line.trim())?.[1])
  	.filter((id): id is string => id !== undefined)
  	.map(Number);

  // after
  const ids = ClosingReferences.parseBare(region);
  ```

### Features

- ### Closing-keyword grammar now covers all nine GitHub tenses everywhere it's checked
  The commitlint `closes-trailer` rule and the changelog's commit-message issue harvesting both now recognize every closing keyword GitHub itself links on — `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved` — not just the present-tense plural (`closes`/`fixes`/`resolves`) they previously required. `Fixed #3` now satisfies the commitlint rule and is harvested into the changelog the same as `Fixes #3`.

### Bug Fixes

- `closes-trailer` now matches strictly whole-line trailers — a closing keyword appearing mid-prose no longer satisfies the rule (previously a sentence containing "closes #3" anywhere could pass)
- Changelog issue harvesting requires a `#` before the issue number — a bare `closes: 123` is no longer picked up (this was accidental drift, not an intended format)
- Changelog issue harvesting now accumulates references across every matching line instead of only the first — a commit body with two separate `Closes #...` lines previously lost the second
- Changelog issue harvesting now fully parses one-line, multi-keyword lists like `Closes #123, Fixes #456`
- Changelog issue harvesting accepts `and`/Oxford-comma separators (`Closes #1, #2 and #3`) [#511][#511]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.10.0 | ^0.10.1 |  |
  | @effected/workspaces | dependency | updated | ^0.14.0 | ^0.14.1 |  |
  | @effected/github-references | dependency | added | — | ^0.1.0 | [#511][#511] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#511]: https://github.com/savvy-web/systems/pull/511

## 5.9.3

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.3.0 | ^0.4.0 | [#509][#509] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#509]: https://github.com/savvy-web/systems/pull/509

## 5.9.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.4.0 | ^0.5.0 |  |
  | @effected/git | dependency | updated | ^0.8.0 | ^0.9.0 |  |
  | @effected/glob | dependency | updated | ^0.3.0 | ^0.4.0 |  |
  | @effected/jsonc | dependency | updated | ^0.6.0 | ^0.7.0 |  |
  | @effected/package-json | dependency | updated | ^0.9.0 | ^0.10.0 |  |
  | @effected/templates | dependency | updated | ^0.2.0 | ^0.3.0 |  |
  | @effected/walker | dependency | updated | ^0.4.0 | ^0.5.0 |  |
  | @effected/workspaces | dependency | updated | ^0.13.1 | ^0.14.0 |  |
  | @effected/yaml | dependency | updated | ^0.9.0 | ^0.10.0 |  |
  | effect | peerDependency | updated | 4.0.0-beta.107 | 4.0.0-rc.109 | [#502][#502] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#502]: https://github.com/savvy-web/systems/pull/502

## 5.9.1

### Refactoring

- Version-file I/O now runs through the Effect `FileSystem` service instead of&#10;`node:fs`. Behavior is unchanged: `ReleasePlanner.apply` still surfaces a
  version-file write failure as a typed `ReleasePlanError`, and the deprecated
  top-level `versionFiles[]` path still fails as a defect.
  - `VersionFiles` reads and writes through `FileSystem`, so its members are now
    Effects requiring `FileSystem.FileSystem` — an internal surface, not exported
    from the package root
  - Package-manifest parsing is fail-soft as before, including on malformed JSON [#498][#498]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.13.0 | ^0.13.1 |  |
  | @effected/yaml | dependency | updated | ^0.8.0 | ^0.9.0 | [#498][#498] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#498]: https://github.com/savvy-web/systems/pull/498

## 5.9.0

### Features

- ### ReposManager.deregister — clear a stale submodule registration
  New `deregister(root, section)` on `Repos.ReposManager`, closing the asymmetry where `ReposDrift` reported an orphaned `submodule.<section>.*` local-config section (left behind by a rename or an unvendoring) but no tool performed the remedy. The section argument is the registration name exactly as the drift report states it; the removal is one `Git.configRemoveSection` call.
  - Refuses, typed and before any mutation: a section outside `.repos/` (a host repo's own submodule registration is not this machinery's to clear), the canonical registration of a live manifest entry, and a live registration under a diverged name — identified by the same module-gitdir attribution the drift check uses, since that state's remedy is a re-vendor, not a deregister; a diverged twin whose entry is also canonically registered is a genuine orphan and IS removable, which is a crashed-rename recovery's own final step
  - Treats a missing manifest as empty, since a stale registration can outlive the manifest itself
  - Probes the config first — pinned to the repository-local config file, resolved through a linked worktree's gitdir indirection, so a global-only section fails typed instead of passing a merged-view probe and dying on the local-scoped removal — and the new `ReposDeregisterResult` reports the keys the removed section actually carried
  - Touches only the superproject's local config — no lockdown bracket, nothing staged, no commit message
  - The drift report's orphan remedy now names `savvy repos deregister` instead of a raw `git config --remove-section`

### Refactoring

- ### sync no longer flips the boundary marker around its initialize call
  `sync`'s initialize branch now passes `--checkout` to `git submodule update` — git's documented command-line override of the `submodule.<path>.update = none` boundary marker, exposed by `@effected/git` 0.8.0. The temporary flip of the marker to `checkout` and its restoring bracket are gone, removing two config writes per repo per sync and the crash window that could leave the marker neutralized. [#494][#494]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#494]: https://github.com/savvy-web/systems/pull/494

## 5.8.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.7.0 | ^0.8.0 |  |
  | @effected/package-json | dependency | updated | ^0.8.0 | ^0.9.0 |  |
  | @effected/workspaces | dependency | updated | ^0.12.0 | ^0.13.0 | [#490][#490] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#490]: https://github.com/savvy-web/systems/pull/490

## 5.8.0

### Features

- ### PrBody namespace — the shared PR-body contract
  New `PrBody` namespace owning the `silk-release` marker contract dogfooded in `silk-release-action`, so independent writers of a managed PR description share one implementation. All operations are pure and total, and output is byte-compatible with the action's `pr-body.ts`, pinned by fixtures generated from the original implementation.
  - `Markers` — the frozen `silk-release` marker constants and the `proposed-squash-commit` fence language; the single source of truth for the marker grammar
  - `Region` — the generic marker-pair region grammar: `start`, `end`, `read`, `strip`, `upsert`
  - `ManagedPrBody` — `build`, `upsert`, `extractSummary`, `extractReferences`: the managed-body renderer with summary and reference carry-through and owned-id subtraction
  - `ClosingReferences` — one owner for the two closing-reference spellings: the comma-joined commitlint trailer and the bare one-per-line form GitHub's linker reads
  - `LinkedIssueRef` — the issue shape with `isClosed`, the case-insensitive closedness test that classifies REST `closed` and GraphQL `CLOSED` alike
  - `OwnedAttribute` — render and parse for the references marker's owned-ids attribute
  - `PrBodyDiagnostic` — advisory `scan` reporting unpaired or duplicated markers [#488][#488]

### Bug Fixes

- The lint-staged type-check handler now prefers `tsc` over `tsgo` when detecting a TypeScript compiler, so the pre-commit gate runs the same compiler as a repo's own `types:check` task. Previously, any repo with `@typescript/native-preview` anywhere in its dependency graph — even as a hoisted or transitive dep — silently got `tsgo` for its commit gate with no way to opt out.
  - `Lint.TypeScript.detectCompiler()` checks `tsc` first and falls back to `tsgo` [#477][#477]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#477]: https://github.com/savvy-web/systems/pull/477

[#488]: https://github.com/savvy-web/systems/pull/488

## 5.7.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @changesets/apply-release-plan | dependency | updated | ^8.0.0-next.9 | ^8.0.0 |  |
  | @changesets/config | dependency | updated | ^4.0.0-next.6 | ^4.0.0 |  |
  | @changesets/get-release-plan | dependency | updated | ^5.0.0-next.9 | ^5.0.0 | [#483][#483] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#483]: https://github.com/savvy-web/systems/pull/483

## 5.7.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/get-github-info | dependency | updated | ^1.0.0-next.4 | ^1.0.0 | [#472][#472] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

* | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.11.2 | ^0.12.0 | [#475][#475] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#472]: https://github.com/savvy-web/systems/pull/472

[#475]: https://github.com/savvy-web/systems/pull/475

## 5.7.0

### Features

- ### The YAML handler runs on `@effected/yaml` instead of Prettier and yaml-lint
  `Lint.Yaml` now formats and validates through `@effected/yaml`. Prettier and `yaml-lint` leave the dependency tree entirely. `Yaml.create()` with default options needs no change.

  What improves:
  - Comments and blank lines survive formatting. The Prettier path dropped them in several positions.
  - Every document of a multi-document stream is formatted, with `---` separators re-emitted, rather than the stream being truncated to its first document.
  - Validation covers the whole stream. A file whose second document is invalid is now rejected; the old path could not see past the first.
  - Formatting is idempotent — running it twice produces the same bytes as running it once.
  - The formatter no longer invents line wraps. A long `key: value` pair that Prettier split across two lines at `printWidth` is left on one.

  ### Formatting options are configured in code
  `YamlOptions` gains a `format` field taking `YamlFormattingOptions`:
  ```typescript
  import { YamlFormattingOptions } from "@effected/yaml";

  Yaml.create({
    format: YamlFormattingOptions.make({ indentSequences: false }),
  });
  ```
  The default is `quoteStyle: "double"` with `indentSequences: true`, matching the block-sequence indentation an ex-Prettier repository already has on disk. `quoteStyle` governs only scalars the stringifier creates — it never re-quotes scalars already present in a file.

### Refactoring

- ### `formatFile` and `validateFile` are synchronous
  The YAML engine is a pure, IO-free tier, so the `Promise` these returned was never doing anything asynchronous. Both are plain synchronous calls now, and the handler from `Yaml.create()` throws on invalid YAML rather than returning a rejected promise. Awaiting them still works; a caller using `.catch()` should switch to `try`/`catch`.
  ```typescript
  // Before
  await Yaml.formatFile(filepath);
  await Yaml.validateFile(filepath, schema);

  // After
  Yaml.formatFile(filepath);
  Yaml.validateFile(filepath);
  ```
  ### The `.yaml-lint.json` config tier is removed
  `Yaml.findConfig`, `Yaml.loadConfig`, `YamlOptions.config` and `validateFile`'s `schema` argument are gone. They read a `.yaml-lint.json` file that this toolchain never shipped or documented a location for, so the discovery always resolved to nothing and the schema was always undefined. `@effected/yaml` is a pure tier that loads nothing from disk; use the `format` option above instead.

  `formatFile` also used to resolve the calling repository's Prettier config before formatting. Nothing reads `.prettierrc` now. `printWidth` was the only option with visible effect, and dropping it is the "no invented wraps" improvement listed above. [#467][#467]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | prettier | dependency | removed | ^3.9.6 | — |  |
  | yaml-lint | dependency | removed | ^1.7.0 | — |  |
  | @effected/workspaces | dependency | updated | ^0.11.1 | ^0.11.2 |  |
  | @effected/yaml | dependency | updated | ^0.7.0 | ^0.8.0 | [#467][#467] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#467]: https://github.com/savvy-web/systems/pull/467

## 5.6.0

### Breaking Changes

- `ReposLockdown` now locks the vendored **worktree only**. The submodule's git metadata directory is no longer chmodded read-only.

  Locking the metadata directory made the vendored boundary enforce itself solely through an `EACCES` that named neither the directory nor a reason, and it broke ordinary git tooling. A plain `git pull` that moves a gitlink recurses by default and dies writing `FETCH_HEAD`, and any client that keeps per-gitdir state cannot function at all — GitKraken writes a `gk/` directory into every gitdir it manages, which no git setting governs.

  The worktree lock still blocks edits to vendored files and still blocks `git reset --hard`. It does not block `git checkout <other>` inside a vendored tree, verified against git 2.54, so the invariant weakens from "the pin cannot drift" to "a drifted pin is always detected and one command from repaired": git reports the submodule as out of sync, `ReposDrift` reports `checkoutDiverged`, and `restore` repairs it.

  `unlock` still walks the metadata directory even though `lock` no longer does. That asymmetry is the migration — every `withUnlocked` bracket frees a gitdir locked by a previous version and never re-locks it, so one `savvy repos sync` migrates an existing checkout.

  The deprecated `commit` alias on `RepoStatusEntry` is removed. Read `stagedCommit` instead. The alias carried one behavior nuance worth restating: a gitlink committed at `HEAD` but staged for removal read `null` through the alias, where the pre-triple `commit` field showed the committed oid.

### Features

- `ReposManager.sync` and `ReposManager.add` declare the vendored boundary to git instead of leaving a permission error to announce it, writing `submodule.<path>.update = none` and `fetch.recurseSubmodules = false` into the superproject's local config. `add` asserts it too because it is a creation point: deferring to the next `sync` leaves a freshly vendored tree undeclared in the meantime, which is the window the marker exists to close. Neither is written to `.gitmodules`. `submodule.<path>.active` is deliberately left `true`: an inactive submodule reads as uninitialized in `git submodule status` even when fully checked out, which would make every drift report claim a missing worktree, and `git submodule init` flips it back regardless. `ReposSyncReport` gains `boundaryMarked`.

  `ReposDrift.check` reconciles a fifth authority, the superproject's local git config, and reports two new drift kinds.

  `localRegistrationDivergence` fires when a checkout is still registered under a pre-canonicalization section name. The manifest, `.gitmodules`, the index and the worktree can all agree while the local registration disagrees, which previously read as clean while `git submodule status` reported a healthy checkout as uninitialized. The module gitdir's own path is the precise link between the two names, since git names it after the registration name in force at creation and never renames it.

  `nestedSubmoduleDivergence` fires when a vendored repo's own submodule is materialized and off the commit its pinned parent records. Sparse-checkout governs only the parent's tracked files, so a manifest `sparse` list never covers gitlink entries and a nested tree can present source from a version the manifest does not pin.

  `ReposManager.add` accepts an `orientation` option and `ReposManager.remove` returns the whole removed entry as `removedEntry`. Remove-then-re-add is the standing remedy for several vendored-tree problems, and without these a caller following it destroyed the entry's orientation block with nothing downstream reporting the loss.

### Bug Fixes

- `ReposManager.sync` and `ReposManager.restore` deinitialize a vendored repo's own submodules rather than reporting success while leaving them materialized. A plain reset does not recurse, so a diverged nested checkout previously survived every repair while keeping the parent permanently dirty, and `sparseApplied` named repos whose excluded directories were still on disk.

  `ReposManager.restore` re-reads each worktree after resetting it and reports any repo that is still dirty in a new `stillDirty` field, so a reset that ran without achieving anything is no longer indistinguishable from one that worked. [#464][#464]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#464]: https://github.com/savvy-web/systems/pull/464

## 5.5.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.11.0 | ^0.11.1 | [#453][#453] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#453]: https://github.com/savvy-web/systems/pull/453

## 5.5.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.3.1 | ^0.4.0 |  |
  | @effected/git | dependency | updated | ^0.6.0 | ^0.7.0 |  |
  | @effected/glob | dependency | updated | ^0.2.2 | ^0.3.0 |  |
  | @effected/jsonc | dependency | updated | ^0.5.2 | ^0.6.0 |  |
  | @effected/package-json | dependency | updated | ^0.7.3 | ^0.8.0 |  |
  | @effected/templates | dependency | updated | ^0.1.1 | ^0.2.0 |  |
  | @effected/walker | dependency | updated | ^0.3.4 | ^0.4.0 |  |
  | @effected/workspaces | dependency | updated | ^0.10.2 | ^0.11.0 |  |
  | @effected/yaml | dependency | updated | ^0.6.1 | ^0.7.0 |  |
  | effect | peerDependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#449][#449] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#449]: https://github.com/savvy-web/systems/pull/449

## 5.5.0

### Features

- ### `ReposManager` gains full lifecycle operations: `remove`, `rename`, `restore`
  `ReposManager` now supports the complete vendored-repo lifecycle alongside the existing `status`/`sync`/`add`/`pin`/`note`:
  - `remove(root, name)` — unvendors a repo: deletes the gitlink and module gitdir, drops the `.gitmodules` section, and removes the manifest entry. Its notes are returned on the result so any durable ones can be promoted elsewhere before the removal is committed.
  - `rename(root, oldName, newName)` — moves the `.repos/<name>` worktree, re-points the module gitdir's `core.worktree` in both git config locations, canonicalizes the `.gitmodules` section name, and renames the manifest key.
  - `restore(root, names?)` — hard-resets one or more vendored repos back to their staged (or committed) gitlink commit and re-applies sparse-checkout paths. Called with no names, it restores every dirty repo and reports which ones were already clean and skipped; called with explicit names, every one of them is restored regardless of cleanliness.

  All three widen `ReposManager`'s error channel with `ReposLockdownError` (see below).
  ### `ReposManager.add` is now atomic, with ls-remote ref validation
  `add` now validates the requested ref against the remote via `git ls-remote` before vendoring anything. An unresolvable ref fails with a near-miss suggestion list (e.g. `ref "mian" not found at <url>; did you mean: main, maint?`) instead of a bare git error. If any step of the vendor sequence fails partway, `add` rolls back what it already did rather than leaving a half-initialized submodule; interrupted state is resumable on a subsequent `add` call for the same repo.
  ### `ReposDrift`: read-only four-authority reconciliation
  New `Repos.ReposDrift` service (`Repos.ReposDrift.layer`, needs `ReposConfigStore | Git | FileSystem | Path`) reconciles the manifest, `.gitmodules`, the worktree, and `git submodule status` for every vendored repo and reports every disagreement it finds via `check(root)`, returning a `ReposDriftReport` (`{ drifts: RepoDrift[], clean: boolean }`). Each `RepoDrift` names the repo, a `kind` (`urlMismatch`, `pathMismatch`, `unregisteredManifestEntry`, `orphanGitmodulesEntry`, `missingWorktree`, `checkoutDiverged`, `missingShallow`, `gitmodulesUnparsable`), a human-readable `detail`, and — for value mismatches — the disagreeing `manifestValue`/`observedValue` pair. `check` is read-only: it never stages anything and runs unmodified against a `ReposLockdown`-locked tree. Surfaced by `savvy repos status --drift` and the `mcp` `repos_inspect` drift mode.
  ### Index-aware repo status
  `ReposManager.status` now reports three distinct commit fields per repo instead of one: `stagedCommit` (the gitlink oid staged in the index, visible before a pin is committed), `committedCommit` (the oid committed at `HEAD`), and `checkedOutCommit` (what's actually checked out in the submodule worktree). The existing `commit` field is retained as a deprecated alias of `stagedCommit` for one release.
  ### `ReposManager.sync` reconciles submodule URLs and registers orphan manifest entries
  `sync` now also reconciles a `.gitmodules` submodule URL that has drifted from the manifest (reported as `urlSynced`) and registers manifest entries with no corresponding gitlink at all (reported as `registered`), in addition to its existing initialize/sparse-apply/stale-lock-clearing behavior.

### Bug Fixes

- `ReposManager.note`'s `promote` operation now appends the note to the target document (`layout` or `startHere`) instead of overwriting it.
- `ReposConfigStore.update` now serializes manifest reads and writes behind an exclusive lock file, so concurrent callers queue instead of racing a lost update.

### Documentation

- ### Migrating an existing checkout after a `.gitmodules` section rename
  This repo's own `.repos/effect` entry has its `.gitmodules` section canonicalized from `[submodule "effect-smol"]` to `[submodule ".repos/effect"]` as part of this release, ahead of the new `rename` operation existing to do this safely. Renaming a section name in `.gitmodules` directly (rather than via `rename`) does not touch a contributor's own local `.git/config`, which stays registered under the old name — `git submodule status` then reports a perfectly healthy checkout as uninitialized (a leading `-`).

  After pulling this change, run `git submodule sync -- .repos/effect` followed by `git submodule init -- .repos/effect` to re-register the local `.git/config` under the canonical name. `savvy repos sync` does **not** do this on its own when the worktree is already present and the remote URL hasn't changed (verified against a scratch repo) — its reconciliation only fires a re-registration on a URL mismatch, not on a section-name-only rename. The module gitdir itself (`.git/modules/.repos/effect-smol`) needs no action: it's resolved from the worktree's own `.git` pointer file, not by name, so it keeps working from wherever it already is. [#436][#436]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.5.2 | ^0.6.0 |  |
  | @effected/workspaces | dependency | updated | ^0.10.0 | ^0.10.2 | [#436][#436] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#436]: https://github.com/savvy-web/systems/pull/436

## 5.4.0

### Features

- ### `ReposLockdown`: OS-level read-only permissions for vendored repos
  New `Repos.ReposLockdown` service (`Repos.ReposLockdownShape`, `Repos.ReposLockdown.layer`) chmods a vendored repo's working tree and its `.git/modules` gitdir to read-only (`0444` files, `0555` directories) after every mutation, and back to writable around a deliberate one. `lock`/`unlock` walk both trees recursively; `withUnlocked` wraps an effect so the tree is writable only for its duration, re-locking even on failure.

  `ReposManager.sync`, `.add`, and `.pin` now call `withUnlocked` around their git mutations and lock the tree once they finish, so a vendored repo stays chmod-read-only outside those three entry points — accidental edits fail at the filesystem level instead of only being caught by the repos Bash guard hook. All three methods' error channels gain the new `ReposLockdownError` (also exported), and `ReposManager.layer` now additionally requires `ReposLockdown` alongside its existing dependencies.

  A consumer assembling `ReposManager.layer` by hand needs to provide `Repos.ReposLockdown.layer` (platform-only requirements: `FileSystem`/`Path`) in addition to `ReposConfigStore` and `Git`. [#429][#429]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.2.1 | ^0.3.1 |  |
  | @effected/workspaces | dependency | updated | ^0.9.5 | ^0.10.0 | [#429][#429] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#429]: https://github.com/savvy-web/systems/pull/429

## 5.3.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.7.2 | ^0.7.3 |  |
  | @effected/workspaces | dependency | updated | ^0.9.4 | ^0.9.5 | [#427][#427] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#427]: https://github.com/savvy-web/systems/pull/427

## 5.3.0

### Features

- ### Commit bodies target a scannable summary, not a design document
  `verbosityRule` now advises past 12 body lines or 150 words, down from 25 and 400. The house format is three to five bullets, or one to two short paragraphs, plus the two trailer lines the rule counts — so the old thresholds admitted bodies several times longer than anything intended to survive a squash merge. The advisory text now says why brevity is correct here and points depth at the PR description.

  `VERBOSITY_LINE_THRESHOLD` and `VERBOSITY_WORD_THRESHOLD` are exported, so a consumer asserting on the numbers can bind to the constants.

### Bug Fixes

- ### `hasClosingTrailer` reads every id in a comma-separated trailer
  The house format puts every issue on one trailer, as `Closes #247, #248, #251`. The previous pattern anchored on `keyword` followed by a single reference, so it matched only the first id and the `closes-trailer` rule reported a missing trailer that was plainly present. It now captures the whole reference list and scans it, and additionally accepts the `and` and `Closes:` spellings. [#420][#420]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#420]: https://github.com/savvy-web/systems/pull/420

## 5.2.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.2.0 | ^0.2.1 |  |
  | @effected/git | dependency | updated | ^0.5.1 | ^0.5.2 |  |
  | @effected/glob | dependency | updated | ^0.2.1 | ^0.2.2 |  |
  | @effected/jsonc | dependency | updated | ^0.5.1 | ^0.5.2 |  |
  | @effected/package-json | dependency | updated | ^0.7.1 | ^0.7.2 |  |
  | @effected/templates | dependency | updated | ^0.1.0 | ^0.1.1 |  |
  | @effected/walker | dependency | updated | ^0.3.3 | ^0.3.4 |  |
  | @effected/workspaces | dependency | updated | ^0.9.3 | ^0.9.4 |  |
  | @effected/yaml | dependency | updated | ^0.6.0 | ^0.6.1 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 5.2.0

### Breaking Changes

- ### Layer statics replace `XLive` exports
  Every service's production layer moves from a standalone `XLive` const to a `.layer` static on the service's own `Context.Service` class. The old `XLive` names are removed from the package's exports — both the flat services and the `Changesets`, `Repos`, and `Turbo` namespaces.
  ```typescript
  // Before
  import { BiomeSchemaSyncLive, ChangesetConfigReaderLive, ConfigDiscoveryLive } from "@savvy-web/silk-effects";

  Effect.provide(BiomeSchemaSyncLive);
  Effect.provide(ChangesetConfigReaderLive);
  Effect.provide(ConfigDiscoveryLive);

  // After
  import { BiomeSchemaSync, ChangesetConfigReader, ConfigDiscovery } from "@savvy-web/silk-effects";

  Effect.provide(BiomeSchemaSync.layer);
  Effect.provide(ChangesetConfigReader.layer);
  Effect.provide(ConfigDiscovery.layer);
  ```
  Affected services: `BiomeSchemaSync`, `ChangesetConfig`, `ChangesetConfigReader`, `ConfigDiscovery`, `SilkWorkspaceAnalyzer`, `Changesets.BranchAnalyzer`, `Changesets.ConfigInspector`, `Changesets.DepsRegen`, `Changesets.GitHubService`, `Changesets.ReleasePlanner`, `Repos.ReposConfigStore`, `Repos.ReposManager`, and `Turbo.TurboInspector`.

  `SilkPublishability` carries two production layers rather than one, so both move to statics: `SilkPublishability.layer` (the default detector) and `SilkPublishability.layerAdaptive` (the config-aware variant, replacing `PublishabilityDetectorAdaptiveLive`).

  This is a genuine breaking change to the package's export surface, released as a minor bump rather than a major: consumption of `@savvy-web/silk-effects` is effectively in-house across the Silk Suite, so the migration cost is contained and immediate. [#408][#408]

### Documentation

- Corrects stale `Context.Tag` references left over from the v4 migration to `Context.Service`, verified against the current source:
  - `docs/04-changeset-config.md` — the `ChangesetConfigReader` and `ChangesetConfig` service code blocks now show the real `Context.Service<Self, Shape>()("<id>")` form, each with its companion `*Shape` interface.
  - `docs/05-config-discovery.md` — the `ConfigDiscovery` service code block, same correction.
  - `docs/06-biome-sync.md` — the `BiomeSchemaSync` service code block, same correction.
  - `src/changesets/services/changelog.ts` — the module's TSDoc comment, which reaches the published API docs, now says `Context.Service` rather than `Context.Tag`. [#408][#408]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.6.1 | ^0.7.1 |  |
  | @effected/workspaces | dependency | updated | ^0.9.1 | ^0.9.3 | [#400][#400] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#400]: https://github.com/savvy-web/systems/pull/400

[#408]: https://github.com/savvy-web/systems/pull/408

## 5.1.3

### Bug Fixes

- Guard against missing version endpoints on changesets releases typed as none. The changesets types package only guarantees oldVersion and newVersion on the major, minor and patch arms of ComprehensiveRelease, so an entry typed none may carry neither.

  The dependency changelog table now drops entries missing either endpoint rather than rendering an empty From or To cell. Maintenance-reason derivation no longer names a none co-member as a release trigger, which printed an unchanged version as the cause of the release. Next-version resolution skips releases with no newVersion instead of overwriting the seeded current version with undefined. [#398][#398]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @changesets/apply-release-plan | dependency | updated | ^8.0.0-next.7 | ^8.0.0-next.9 |  |
  | @changesets/get-github-info | dependency | updated | ^1.0.0-next.3 | ^1.0.0-next.4 |  |
  | @changesets/get-release-plan | dependency | updated | ^5.0.0-next.7 | ^5.0.0-next.9 |  |
  | @changesets/types | devDependency | updated | ^7.0.0-next.6 | ^7.0.0-next.8 | [#398][#398] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#398]: https://github.com/savvy-web/systems/pull/398

## 5.1.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.1.0 | ^0.2.0 |  |
  | @effected/package-json | dependency | updated | ^0.6.0 | ^0.6.1 |  |
  | @effected/workspaces | dependency | updated | ^0.9.0 | ^0.9.1 | [#396][#396] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#396]: https://github.com/savvy-web/systems/pull/396

## 5.1.1

### Documentation

- Documents the `Changesets` namespace services in the README, which previously appeared only as a single line in the feature list:
  - `ChangesetLinter` — static, synchronous validation of a changeset file against the Silk section rules
  - `ConfigInspector` — resolves `.changeset/config.json` into an attributed view of the workspace, and maps arbitrary file paths to the package that owns them
  - `ReleasePlanner` — `plan`, `preview` and `apply` over the genuine changesets engine, including the `changelogModules` option for callers running without `node_modules`
  - `BranchAnalyzer` — classifies a branch diff by owning package
  - `DepsRegen` — the `plan`/`execute` split behind dependency changesets, with the batteries-included `DepsRegenDefault` layer

  Each entry states its real layer requirements, verified against the source rather than carried over from prose.

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 5.1.0

### Features

- ### `ReleasePlanner.preview` accepts `changelogModules`
  `preview` now takes the same `changelogModules` option `apply` has, mapping configured changelog ids to absolute module paths:
  ```ts
  const preview = yield* planner.preview(root, {
  	changelogModules: { "@savvy-web/changelog": changelogModulePath },
  });
  ```
  Rendering `changelogEntry` resolves the changelog module named in `.changeset/config.json`, so a caller running before `node_modules` exists — a bundled GitHub Action reading a release plan, for instance — could not use `preview` at all. Resolution failed inside `import-meta-resolve` and surfaced only as `Release plan error (preview): expected to be defined`. Mapping the id gives the engine an absolute path to import instead.

  The option behaves as it does on `apply`: `config.changelog[0]` must be a key of the map, an unmapped id fails with a `ReleasePlanError` naming the supported keys, and the engine's `format` integration is disabled so the caller owns formatting. Omitting the option preserves the previous behaviour exactly. `plan` is unchanged — it renders no changelog and so resolves no module.

### Bug Fixes

- A changelog id naming an `Object.prototype` member — `toString`, `constructor`, `valueOf` — is now correctly reported as unmapped. Membership was tested with `changelogModules[id] === undefined`, which reads back an inherited function for those names, so the id skipped the typed error and the engine received a function where it expects a module specifier. This affected `apply` before `preview` existed as an option-taking member, and is fixed for both.

### Refactoring

- `preview` and `apply` now share one `withChangelogModules` config rewrite rather than carrying separate copies [#389][#389]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#389]: https://github.com/savvy-web/systems/pull/389

## 5.0.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.5.0 | ^0.5.1 |  |
  | @effected/walker | dependency | updated | ^0.3.2 | ^0.3.3 | [#385][#385] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#385]: https://github.com/savvy-web/systems/pull/385

## 5.0.0

### Breaking Changes

- Several services, schemas, and errors move out of `@savvy-web/silk-effects` and onto the released `@effected/*` kit. `src/index.ts` no longer re-exports anything from the kit, so each type now has exactly one import path.
  ### Tag and versioning classification moved to `@effected/workspaces`
  `TagStrategy`, `TagStrategyLive`, `TagStrategyShape`, `TagStrategyType`, `VersioningStrategy`, `VersioningStrategyLive`, `VersioningStrategyShape`, `VersioningStrategyResult`, `VersioningStrategyType`, `TagFormatError`, and `VersioningDetectionError` are removed. The equivalent logic now lives in `@effected/workspaces` as pure value classes — `classify` is pure and total, so there is no error channel to catch:
  ```typescript
  import { VersioningStrategy } from "@effected/workspaces";

  const strategy = VersioningStrategy.classify({ packages: publishablePackages, fixedGroups });
  const tags = strategy.tagsFor([{ name: "@savvy-web/silk-effects", version: "1.0.0" }]);
  // => [ReleaseTag { value: "@savvy-web/silk-effects@1.0.0" }]
  ```
  ### Tool discovery and command execution moved to `@effected/commands`
  `ToolDiscovery`, `ToolDiscoveryLive`, `ToolDiscoveryShape`, the `ToolDefinition`/`ResolvedTool`/`ToolResults` schemas, `ToolNotFoundError`, `ToolResolutionError`, `ToolVersionMismatchError`, and `ToolCommand` are removed in favor of `@effected/commands`'s `ToolDiscovery` service, wired to a workspace with `Workspaces.localExecLayer()`:
  ```typescript
  import { ToolDiscovery } from "@effected/commands";
  import { Workspaces } from "@effected/workspaces";

  const ToolsLive = ToolDiscovery.layer.pipe(Layer.provide(Workspaces.localExecLayer()));
  ```
  `Turbo.TurboInspectorLive` now requires this kit `ToolDiscovery` in place of the deleted local service.
  ### Managed section templating moved to `@effected/templates`
  `ManagedSection`, `ManagedSectionLive`, `ManagedSectionShape`, the `SectionDefinition`/`SectionBlock`/`SectionResults`/`CommentStyle` schemas, and `SectionParseError`, `SectionValidationError`, `SectionWriteError` are removed. Husky hook sections now render through `@effected/templates`'s `ManagedSection` service:
  ```typescript
  import { ManagedSection } from "@effected/templates";

  const ms = yield* ManagedSection;
  const results = yield* ms.syncAll(".husky/commit-msg", [
  	/* section list */
  ]);
  ```
  `SavvySections` is rewritten on the kit's `SectionId` type, whose keys are uppercase (`SAVVY-BASE`, `SAVVY-HOOKS`) — marker compatibility with already-installed hook files is preserved.
  ### Removed with no replacement
  The changesets `MarkdownService`, `MarkdownLive`, and `MarkdownShape` are deleted outright — they had zero call sites.
  ### Layer requirement changes
  `SilkWorkspaceAnalyzer`'s layer requirements are reduced to four. A consumer providing its own layer graph for these services should re-check what each service now requires before upgrading.
  ### Migration
  Add `@effected/commands`, `@effected/templates`, and `@effected/workspaces` (already transitive dependencies of this package) to your own manifest if you import them directly, then replace each removed import with its kit equivalent listed above. [#382][#382]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.5.2 | ^0.6.0 |  |
  | @effected/workspaces | dependency | updated | ^0.8.0 | ^0.9.0 |  |
  | @effected/commands | dependency | added | — | ^0.1.0 |  |
  | @effected/templates | dependency | added | — | ^0.1.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#382]: https://github.com/savvy-web/systems/pull/382

## 4.2.6

### Bug Fixes

- The changesets `ConfigInspector` fallback-scope builder now honors `.changeset/config.json`'s `privatePackages.version` — a private root or private workspace package joins the release surface instead of yielding an empty `packages[]` and leaving every file unmapped.
- `ConfigInspector.classify` no longer lets a root-as-package scope win directory containment ahead of a more specific claim. Because the root's workspace directory contains every file in the repo, a versioned root would otherwise shadow the `additionalScopes` and `versionFiles` a config declared for any path outside a sub-package directory. The root now applies as a last-resort fallback, which is what a single-package root-as-package repo relies on. [#373][#373]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.4.2 | ^0.5.0 |  |
  | @effected/package-json | dependency | updated | ^0.5.1 | ^0.5.2 |  |
  | @effected/workspaces | dependency | updated | ^0.7.0 | ^0.8.0 |  |
  | @effected/yaml | dependency | updated | ^0.5.1 | ^0.6.0 | [#375][#375] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#373]: https://github.com/savvy-web/systems/pull/373

[#375]: https://github.com/savvy-web/systems/pull/375

## 4.2.5

### Bug Fixes

- ### Dependency table cells are no longer markdown-escaped
  Dependency table cells are now written to markdown verbatim instead of being escaped. Version specifiers and package names survive serialization intact, so a generated changeset reads `~0.2.1` and `some_pkg` rather than `\~0.2.1` and `some\_pkg`.

  The escaping came from `remark-stringify`, which backslashes any character that could open a markdown construct — with GFM enabled `~` is the strikethrough delimiter and `_` opens emphasis. It affected every table cell, not just tilde ranges, and compounded each time a table was re-serialized through consolidation or PR-body reconstruction.
  - Cells are marked literal and escape only `|` and `\`, the two characters that would otherwise break the table grid
  - Fixes both write paths — the markdown-string serializer and the mdast table node the dependency-table aggregation plugin inserts into a changeset AST
  - Prose elsewhere in a changeset keeps normal markdown escaping

  ### Hook-injected catalogs now produce dependency rows
  A dependency declared against a catalog that is injected at install time by a pnpmfile hook — rather than written into `pnpm-workspace.yaml` or recorded in the lockfile's `catalogs:` block — resolved to nothing on both sides of a diff. The two raw specifiers compared equal and no row was emitted, so a real version movement produced no changeset at all.

  The dependency diff now resolves specifiers per lockfile importer, which answers from the importer's own recorded versions when the catalog set cannot.
  - Requires `@effected/workspaces` 0.7.0, which adds the importer-scoped resolution the fix reads through
  - Scoped to the declaring importer rather than the workspace as a whole, so a repo whose packages hold different versions of the same dependency gets a correct answer per package instead of none
  - Plain semver ranges are unaffected and still fall through to the declared specifier

  ### CSH005 now judges the same value under both linters
  The markdownlint implementation of CSH005 validated the raw source of a dependency table cell, while the remark implementation validated the parsed value. A cell containing a markdown escape therefore got two different verdicts: a changeset written by the older serializer, carrying `\~0.2.0`, passed `savvy changeset check` and the pre-commit hook while failing `markdownlint`.

  The markdownlint rules now resolve CommonMark backslash escapes before validating, so both implementations judge the value a reader actually sees.

  Escape resolution lives in the shared token extractors rather than in one rule, so heading-based rules are aligned too — CSH002 previously compared a raw heading against the category list while its remark counterpart compared the parsed one.
  - Affects existing changesets written before the escaping fix above; regenerating one clears it either way
  - A value that is genuinely invalid once unescaped is still reported
  - Only ASCII punctuation is unescaped, per CommonMark, so a backslash before a space stays literal [#369][#369]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.6.2 | ^0.7.0 | [#369][#369] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#369]: https://github.com/savvy-web/systems/pull/369

## 4.2.4

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.4.1 | ^0.4.2 |  |
  | @effected/glob | dependency | updated | ^0.2.0 | ^0.2.1 |  |
  | @effected/jsonc | dependency | updated | ^0.5.0 | ^0.5.1 |  |
  | @effected/package-json | dependency | updated | ^0.5.0 | ^0.5.1 |  |
  | @effected/walker | dependency | updated | ^0.3.1 | ^0.3.2 |  |
  | @effected/workspaces | dependency | updated | ^0.6.1 | ^0.6.2 |  |
  | @effected/yaml | dependency | updated | ^0.5.0 | ^0.5.1 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 4.2.3

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.4.2 | ^0.5.0 |  |
  | @effected/workspaces | dependency | updated | ^0.6.0 | ^0.6.1 | [#351][#351] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#351]: https://github.com/savvy-web/systems/pull/351

## 4.2.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | prettier | dependency | updated | ^3.9.5 | ^3.9.6 | [#349][#349] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#349]: https://github.com/savvy-web/systems/pull/349

## 4.2.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/package-json | dependency | updated | ^0.4.1 | ^0.4.2 |  |
  | @effected/workspaces | dependency | updated | ^0.5.2 | ^0.6.0 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 4.2.0

### Bug Fixes

- `Lint.PnpmWorkspace.formatContent` no longer post-processes its output through Prettier. It now stringifies directly via `@effected/yaml` with `quoteStyle: "double"` and `indentSequences: true`, producing the repo's byte format in one pass. This fixes a formatter regression where scoped package keys in `pnpm-workspace.yaml` were rewritten from double to single quotes (`"@parcel/watcher"` -\> `'@parcel/watcher'`) on every `savvy lint fmt pnpm-workspace` run, causing churn on every format pass.

  `formatContent` also dropped its now-unused `filepath` parameter, since there is no longer a second printer (Prettier) that needed it to resolve config.
  - Fixed scoped-package-key quote-style churn in `pnpm-workspace.yaml` formatting
  - `PnpmWorkspace.formatContent(content)` no longer takes a `filepath` argument

### Refactoring

- Replaced `sort-package-json` with `@effected/package-json`'s `PackageJsonFormat.sortValue`/`formatToString` (byte-identical output)
- `SilkPublishability` now reads `WorkspacePackage.workspaceRoot` from the discovered package instead of deriving it internally
- Changeset glob and version-file matching moved to `@effected/glob`'s `compileResult` and `@effected/walker`'s `compileAndExpand`, fixing a latent dot-glob dialect divergence between attribution and materialization (wildcard segments matching dotted directories now agree across both paths) [#336][#336]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | sort-package-json | dependency | removed | ^4.0.0 | — |  |
  | @effected/glob | dependency | updated | ^0.1.2 | ^0.2.0 |  |
  | @effected/jsonc | dependency | updated | ^0.4.0 | ^0.5.0 |  |
  | @effected/package-json | dependency | updated | ^0.3.1 | ^0.4.1 |  |
  | @effected/walker | dependency | updated | ^0.2.2 | ^0.3.1 |  |
  | @effected/workspaces | dependency | updated | ^0.4.1 | ^0.5.2 |  |
  | @effected/yaml | dependency | updated | ^0.4.0 | ^0.5.0 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#336]: https://github.com/savvy-web/systems/pull/336

## 4.1.0

### Features

- Added `Lint.PnpmWorkspace.formatContent(content, filepath?)` — a public static that stringifies sorted `pnpm-workspace.yaml` content and normalizes it through Prettier's YAML printer to the repo's canonical byte format (2-space block-sequence indent, double-quoted scalars).

  `Lint` handlers have two entry points that must never drift from each other: the lint-staged `create()` handler and the `savvy lint fmt <name>` CLI subcommand. `formatContent` is now the single source of truth both call, so the two paths always produce identical bytes for the same file.
  ````typescript
  import { Lint } from "@savvy-web/silk-effects";

  const formatted = await Lint.PnpmWorkspace.formatContent(sortedContent, "pnpm-workspace.yaml");
  ``` [#328](https://github.com/savvy-web/systems/pull/328) Thanks [@spencerbeggs](https://github.com/spencerbeggs)!
  ````

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.4.0 | ^0.4.1 |  |
  | @effected/glob | dependency | updated | ^0.1.1 | ^0.1.2 |  |
  | @effected/jsonc | dependency | updated | ^0.3.0 | ^0.4.0 |  |
  | @effected/package-json | dependency | updated | ^0.3.0 | ^0.3.1 |  |
  | @effected/walker | dependency | updated | ^0.2.1 | ^0.2.2 |  |
  | @effected/workspaces | dependency | updated | ^0.4.0 | ^0.4.1 |  |
  | @effected/yaml | dependency | updated | ^0.3.1 | ^0.4.0 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 4.0.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.3.0 | ^0.4.0 |  |
  | @effected/glob | dependency | updated | ^0.1.0 | ^0.1.1 |  |
  | @effected/walker | dependency | updated | ^0.2.0 | ^0.2.1 |  |
  | @effected/workspaces | dependency | updated | ^0.3.0 | ^0.3.1 |  |
  | @effected/yaml | dependency | updated | ^0.2.0 | ^0.3.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 4.0.0

### Breaking Changes

- The library now targets `effect@4` and peers on `catalog:effectPeers`; the `@effect/platform` peer is dropped because its abstractions moved into core `effect`.
- All 19 services convert from `Context.Tag` to class-based `Context.Service`, and each now exports a companion `*Shape` interface for structural consumers.
- Result schemas, tagged errors, and value objects are rebuilt on the v4 `Schema` surface; consumers that embed these types (notably the MCP tool contracts) must update to the v4 shapes.

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | jsonc-effect | dependency | removed | ^0.3.1 | — |  |
  | semver-effect | dependency | removed | ^0.3.1 | — |  |
  | tinyglobby | dependency | removed | ^0.2.17 | — |  |
  | workspaces-effect | dependency | removed | ^2.1.0 | — |  |
  | yaml | dependency | removed | ^2.9.0 | — |  |
  | yaml-effect | dependency | removed | ^0.7.2 | — |  |
  | @effect/platform | peerDependency | removed | ^0.96.0 | — |  |
  | effect | peerDependency | updated | ^3.21.0 | catalog:effectPeers |  |
  | @effected/git | dependency | added | — | ^0.3.0 |  |
  | @effected/glob | dependency | added | — | ^0.1.0 |  |
  | @effected/jsonc | dependency | added | — | ^0.2.0 |  |
  | @effected/package-json | dependency | added | — | ^0.3.0 |  |
  | @effected/walker | dependency | added | — | ^0.2.0 |  |
  | @effected/workspaces | dependency | added | — | ^0.3.0 |  |
  | @effected/yaml | dependency | added | — | ^0.2.0 | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

- Git invocation unifies onto `@effected/git`, including the repos manager's full mutating tier; workspace discovery moves to `@effected/workspaces` with deterministic per-package root derivation.
- Glob, JSONC, YAML, and directory walking adopt `@effected/glob`, `@effected/jsonc`, `@effected/yaml`, and `@effected/walker`, retiring the hand-rolled glob walker for `Walker.descend`. [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 3.3.1

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 3.3.0

### Features

- ### `Repos` namespace: vendored reference repos
  Adds a new public `Repos` namespace for managing vendored reference repos under a project's `.repos/` directory — git submodules kept purely as read-only agent authorities, never forks to modify.
  ```ts
  import { Repos } from "@savvy-web/silk-effects";

  const manager = yield* Repos.ReposManager;
  const report = yield* manager.status(root);
  // report.clean, report.repos[].{ name, ref, purpose, present, commit, dirty, staleNoteIds }
  ```
  The manifest lives at `.repos/config.json`. Each entry (`Repos.RepoEntry`) declares a `url`, a pinned `ref`, a required `purpose`, optional `sparse` checkout paths, an optional `orientation` block (`layout`, `keyPaths`, `startHere`), and up to ten agent-authored `notes` — each stamped with a content-hash `id` and the ref it was written against.

  Two services back the namespace:
  - `Repos.ReposConfigStore` — reads, validates, and writes the manifest.
  - `Repos.ReposManager` — drift reporting (`status`), idempotent self-healing sync that clears stale git lock files before reinitializing a submodule (`sync`), staging a new vendored repo with a shallow ref fetch (`add`), re-pinning an existing entry to a new ref (`pin`), and adding, removing, or promoting agent notes (`note`). `add` and `pin` stage their changes and hand back a ready-made commit message rather than committing.

  A missing manifest is a distinct, non-error `ReposConfigError` kind (`"missing"`) from a corrupt one (`"invalid"`), so callers can render the common "nothing vendored yet" case as a friendly no-op.

### Documentation

- Corrected the `ShellScripts` lint handler's TSDoc: the exec-bit strip is now explained as intentional normalization (scripts run via `bash <script>`, so the mode is never needed at runtime), and the `.claude/scripts/` default exclude is now described as a consumer escape-hatch convention rather than something Silk itself requires — the previous comment incorrectly claimed it was needed "for lint-staged hooks to work." [#299][#299]

### Maintenance

- The generated markdownlint template now ignores `**/.repos`, so vendored submodule content is excluded from lint runs in projects that adopt the pattern via `savvy init`'s union-merge. [#292][#292]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

[#299]: https://github.com/savvy-web/systems/pull/299

## 3.2.5

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | shell-quote | dependency | updated | ^1.9.0 | ^1.10.0 | [#283][#283] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#283]: https://github.com/savvy-web/systems/pull/283

## 3.2.4

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | prettier | dependency | updated | ^3.9.4 | ^3.9.5 | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 3.2.3

### Bug Fixes

- `Changesets.DepsRegen.plan()` no longer deletes a pure dependency changeset it isn't about to recreate (#258). The delete set is now restricted to packages that actually produced a fresh diff in the current run, and a changeset already committed at the merge-base ref — authored by an earlier, already-merged change — is never deleted by an unrelated branch's regen pass. Previously a devDependency-only manifest change silently destroyed the package's existing dependency changeset with nothing to replace it, and running regen on an unrelated branch could wipe out release notes for already-merged work.
- `ConfigInspector` and `ChangesetConfig` gained a `refresh()` method that drops their per-root caches, which otherwise never expire. `DepsRegen.plan()` now calls both up front, so long-lived host processes (for example, an MCP server holding one `DepsRegen` for its whole lifetime) see on-disk `.changeset/config.json` edits — the `ignore` list, `privatePackages.version`, and `baseBranch` — made between calls (#229). [#267][#267]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#267]: https://github.com/savvy-web/systems/pull/267

## 3.2.2

### Bug Fixes

- Replaced the unanchored trailing-slash regex in the workspace analysis `sameRegistry` comparison with a shared index-scan helper (`trimTrailingSlashes`), eliminating a polynomial-time regex (CodeQL `js/polynomial-redos`) that degraded to O(n²) on registry strings containing long interior slash runs. `normalizeDir` in the publishability service now uses the same helper. [#265][#265]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#265]: https://github.com/savvy-web/systems/pull/265

## 3.2.1

### Bug Fixes

- `Changesets.DepsRegen.plan` now refreshes the `WorkspaceDiscovery` cache before any workspace read — the `ConfigInspector` base-branch fallback, the worktree snapshot, and the versionable-package gating — so it diffs the workspace as it is on disk at plan time. Previously, in a process that had already enumerated the workspace before manifests were edited (the natural flow of an updater tool like silk-update-action), those reads were served pre-edit manifests from the discovery layer's lifetime cache, and the plan silently collapsed to zero changesets.

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | [#262][#262] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#262]: https://github.com/savvy-web/systems/pull/262

## 3.2.0

### Features

- ### Refuse to publish a directory the prod `targets.json` binding does not describe
  `SilkPublishability.resolveTargets` now asserts that every surviving target's directory is one of the group directories named by the package's `dist/prod/targets.json`, whenever that binding exists. A directory outside it means publishability detection did not select the prod build output.

  This is the `yaml-effect@0.7.1` shape from #143: silk mode was misdetected, detection fell through to the vanilla `publishConfig.directory` branch and picked `dist/dev/pkg`, and the dev manifest — still carrying `catalog:` specifiers — was packed and published. The published package could not be installed anywhere (`EUNSUPPORTEDPROTOCOL: Unsupported URL Type "catalog:"`).
  - New `PublishTargetBindingError` (exported) carries the package, the directory detection chose, and the directories the binding actually binds.
  - `resolveTargets` gains that error in its error channel; it was previously `never`. Callers must handle or propagate it.
  - Before the prod build writes a binding there is nothing to check, so pre-build placeholder directories are left alone.

  Refs #143, #144. [#257][#257]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#257]: https://github.com/savvy-web/systems/pull/257

## 3.1.0

### Features

- `DepsRegen` gains batch and exclude controls for regenerating dependency changesets across several packages in a single call:
  - `DepsRegenOptions.packages` — restrict a run to a list of workspace packages, unioned with the existing single-package `package` option. Explicit targets bypass the versionable gate but not the ignore list.
  - `DepsRegenOptions.exclude` — drop packages from scope entirely: nothing is written for them, and their existing pure-dependency changesets are left untouched. `exclude` wins over both `package` and `packages`.

  ```ts
  import { Changesets } from "@savvy-web/silk-effects";

  const plan = yield* Changesets.DepsRegen.plan({
  	cwd: process.cwd(),
  	packages: ["@scope/a", "@scope/b"],
  	exclude: ["@scope/c"]
  });
  ```

### Bug Fixes

- `computeWorkspaceDependencyDiffs` no longer reports a dependency reclassified between fields at an unchanged resolved version (e.g. moved from `devDependencies` to `dependencies` with no version bump) as an unrelated removed row plus an added row — the pair now collapses to nothing. A move that also changes the resolved version still produces both rows.
- `BranchAnalyzer.analyzeBranch` no longer reports the branch's own `.changeset/*.md` files in `files[]` / `unmappedFiles` — they are the artifact being reconciled, never a classification question. [#241][#241]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#241]: https://github.com/savvy-web/systems/pull/241

## 3.0.3

### Bug Fixes

- `VersionFiles.updateFile` now performs format-preserving in-place edits via jsonc-effect's `modify`/`applyEdits` (minimal edit spans, requires `jsonc-effect >= 0.3.1`) instead of round-tripping through `JSON.parse`/`JSON.stringify`, so a version bump produces a one-line diff and the rest of the document — inline arrays, comments, indentation — survives byte-for-byte (closes #234)
- JSONC documents (comments, trailing commas) are now supported in versionFiles-managed files; the dry-run preview paths in `processVersionFiles`/`processResolvedVersionFiles` parse via jsonc-effect too, so a commented file previews cleanly instead of throwing
- A wildcard-free JSONPath whose leaf property does not yet exist is now inserted using the document's detected indent, instead of being silently skipped [#235][#235]

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | jsonc-effect | dependency | updated | ^0.3.0 | ^0.3.1 | [#235][#235] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#235]: https://github.com/savvy-web/systems/pull/235

## 3.0.2

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | yaml-effect | dependency | updated | ^0.7.0 | ^0.7.2 |  |
  | workspaces-effect | dependency | updated | ^2.0.1 | ^2.0.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#232]: https://github.com/savvy-web/systems/pull/232

## 3.0.1

### Bug Fixes

- `ChangesetConfigReader` now recognizes the standalone `@savvy-web/changelog` package as a Silk changelog adapter. Configs written by the new `savvy init` (which uses `@savvy-web/changelog` as the canonical `changelog` id) were silently decoded as plain non-Silk configs because the id matched neither legacy marker substring. The two legacy id families (`@savvy-web/changesets` and `@savvy-web/silk/changesets`) remain accepted.

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.0.0

### Breaking Changes

- Migrates the changesets integration from the stable v2 line to the v3 `next` prereleases (`@changesets/apply-release-plan@^8.0.0-next.7`, `@changesets/config@^4.0.0-next.6`, `@changesets/get-release-plan@^5.0.0-next.7`, `@changesets/get-github-info@^1.0.0-next.3`, `@changesets/types@^7.0.0-next.6`). The underlying release-plan engine, config reader, and GitHub info client are all new major versions with their own behavior changes; test upgrades against a real changeset flow before relying on it in CI.
- `ReleasePlanner` now drives the v3 engine directly: config loading uses the non-throwing `readConfig` result (invalid config now surfaces as a description-only failure rather than a thrown parse error) and workspace discovery consumes the manypkg v3 `Packages` shape natively. The v1-shaped compatibility adapter that previously bridged `@manypkg/get-packages@3.x` down to the engine's v1 `Packages` contract has been deleted.

### Features

- ### `changelogModules` option on `ReleasePlanner.apply`
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

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/apply-release-plan | dependency | updated | ^7.1.1 | ^8.0.0-next.7 |  |
  | @changesets/config | dependency | updated | ^3.1.4 | ^4.0.0-next.6 |  |
  | @changesets/get-github-info | dependency | updated | ^0.8.0 | ^1.0.0-next.3 |  |
  | @changesets/get-release-plan | dependency | updated | ^4.0.16 | ^5.0.0-next.7 | [#218][#218] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Major Changes

[#218]: https://github.com/savvy-web/systems/pull/218

## 2.1.0

### Features

- ### Release lines no longer carry commit-link prefixes
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

* ### Maintenance notes for changeset-less releases
  Version-only releases forced by `fixed`/`linked` version groups now get a generated `### Maintenance` note instead of shipping an empty version block. The note names the triggering package (e.g. "Released in lockstep with `@scope/pkg@1.2.3` (fixed version group)."), with a generic fallback sentence when the trigger can't be determined.

  New public API: `MaintenanceNotePlugin`, `deriveMaintenanceReason`, `MaintenanceReasonSchema`, `MaintenanceTriggerSchema`, the derived `MaintenanceReason`/`MaintenanceTrigger` types, and a `maintenance` option on `ChangelogTransformer`'s `TransformOptions`.
  ### Dependency tables under their own heading
  Dependency update tables are now emitted under their own `### Dependencies` heading instead of surfacing beneath the engine's default `### Patch Changes` wrapper.

### Bug Fixes

- `ChangelogTransformer.transformContent` now runs the full `SilkChangesetTransformPreset`, restoring the `AggregateDependencyTablesPlugin` pass that merges duplicate dependency tables.

## 2.0.2

### Dependencies

- [`5ada627`](https://github.com/savvy-web/systems/commit/5ada627c7e8b959036f0a7e1bf9ecaf4978136c8) \| Dependency \| Type \| Action \| From \| To \|
  \| --------------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| @manypkg/get-packages \| dependency \| updated \| ^1.1.3 \| ^3.1.0 \|

## 2.0.1

### Bug Fixes

- [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

- [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) \| Dependency \| Type \| Action \| From \| To \|
  \| ----------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| semver-effect \| dependency \| updated \| ^0.3.0 \| ^0.3.1 \|
  \| workspaces-effect \| dependency \| updated \| ^2.0.0 \| ^2.0.1 \|

## 2.0.0

### Breaking Changes

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) ### `Changesets.DepsRegen` moves to `workspaces-effect`'s point-in-time snapshots

The `Changesets` namespace no longer exports its own git-ref workspace reader. `DepsRegen` now snapshots both sides of a diff through `workspaces-effect`'s `PointInTimeWorkspace` service, which resolves `catalog:`/`workspace:` specifiers per-ref before rows are ever compared.

Removed from `@savvy-web/silk-effects` (`Changesets` namespace):

- `WorkspaceSnapshotReader`, `WorkspaceSnapshotReaderBase`, `WorkspaceSnapshotReaderLive`
- `WorkspaceSnapshot` (type), `WorkspaceSnapshotReaderShape` (type)
- `snapshotFromWorktree`
- `resolveDiffRows`

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

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) ### `DepsRegenDefault` batteries-included layer

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

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) Routed `DepsRegen` and `ReleasePlanner` file I/O through `@effect/platform`'s `FileSystem` instead of `node:fs` (#205, #144). `ReleasePlanner`'s preview path now uses a `Scope`-managed temp directory that is cleaned up automatically. New `ChangesetIOError` tagged error surfaces changeset file read/write/list/delete failures.

### Dependencies

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) \| Dependency \| Type \| Action \| From \| To \|
  \| ----------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| workspaces-effect \| dependency \| updated \| ^1.2.0 \| ^2.0.0 \|

### `DepsRegen` error channels and layer requirements changed

- `plan()` now fails with `GitError | WorkspaceDiscoveryError | ChangesetIOError | PointInTimeReadError` (previously `GitError | WorkspaceDiscoveryError`).
- `execute()` now fails with `ChangesetIOError` — it was previously infallible. Write failures are loud; stale-changeset deletion stays skip-and-continue so an interrupted run stays safely re-runnable.
- `DepsRegenLive` drops its `CatalogResolver` and `WorkspaceSnapshotReader` requirements and now requires `PointInTimeWorkspace`, `ChangesetConfig`, and `FileSystem.FileSystem` in addition to `WorkspaceDiscovery` and `PublishabilityDetector`.
- `ReleasePlannerLive` gains a `FileSystem.FileSystem` requirement (its preview path now writes to a scope-managed temp directory instead of `node:fs`).

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

### Per-ref catalog/workspace specifier resolution before diffing (\#208)

The dependency diff behind `savvy changeset deps regen`/`detect` now resolves `catalog:` and `workspace:` specifiers against each ref's own catalogs and package versions *before* comparing them. A package that merely adopts a `catalog:` specifier without its resolved version changing no longer produces a row; a catalog version bump under a stable specifier now correctly produces an updated row showing the concrete `from`/`to` versions.

### Dependency-changeset gating tightened (\#209)

A package is now in scope for dependency-changeset regeneration and stale-changeset cleanup when it is `publishable OR privatePackages.version` **and** not on the changeset ignore list — the ignore list wins over an explicit `--package` target. Previously only publishability was considered.

## 1.6.0

### Features

- [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) Added `Changesets.DepsRegen`, a `plan()`/`execute()` service that owns dependency-changeset regeneration. `plan()` computes the cumulative dependency diff and returns a complete, side-effect-free plan; `execute()` applies it. Along the way it resolves `catalog:`/`workspace:` specifiers to concrete versions (falling back to the raw specifier when a catalog cannot be resolved, so a commit is never blocked) and drops `devDependency` rows, which never reach a consumer.

`ChangesetLinter` now enforces the dependency-table format: `validateContent` runs the remark `DependencyTableFormatRule`, so `savvy changeset check`/`lint` and the `changeset_validate` MCP tool reject a prose `## Dependencies` section — the same check the pre-commit markdownlint CSH005 rule already ran. The dependency-table version pattern is now a single exported `VERSION_RE`, widened to accept `catalog:`/`workspace:`/`npm:` protocol specifiers.

Closes the changeset validator split-brain behind #193, #199, and #151.

### Dependencies

- [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) \| Dependency \| Type \| Action \| From \| To \|
  \| ------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| jsonc-effect \| dependency \| updated \| ^0.2.1 \| ^0.3.0 \|
  \| semver-effect \| dependency \| updated \| ^0.2.1 \| ^0.3.0 \|
  \| yaml-effect \| dependency \| updated \| ^0.6.0 \| ^0.7.0 \|

## 1.5.2

### Maintenance

- [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.

## 1.5.1

### Dependencies

- | [`689a1aa`](https://github.com/savvy-web/systems/commit/689a1aa25f72a4521ff8e21c3fd610862247a0ce) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | shell-quote | dependency | updated | ^1.8.4 | ^1.9.0 |  |
  | @commitlint/types | devDependency | updated | ^21.0.1 | ^21.1.0 |  |

## 1.5.0

### Features

- [`356ed32`](https://github.com/savvy-web/systems/commit/356ed32ce08bb1e2971e0522ad7db4144cfa8858) The commitlint config types reachable from `CommitlintUserConfig` are now exported flat from the package entry, in addition to the `Commitlint` namespace: `CommitlintPlugin`, `PromptConfig`, `PromptSettings`, `RuleApplicability`, `RuleConfigTuple`, `RuleSeverity`, and `RulesConfig`. This lets a generated `commitlint.config.ts` name them directly for declaration emit.

### Documentation

- [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) Added `@public` release tags across the public surface of all three packages so every exported symbol registers in the generated API model and passes the `ae-missing-release-tag` check. In `github-action-builder`, promoted the `Data.TaggedError` base classes and the `Schema`-derived type sources to `@public` to clear `ae-incompatible-release-tags`. Fixed TSDoc link warnings: unresolvable `{@link}` references (Effect `Context.Tag` service methods, which live in the tag's type argument rather than as class members, plus external symbols) were replaced with backtick code spans, ambiguous references were given member-reference selectors, and the stale `PublishabilityDetector` reference was retargeted to `SilkPublishability`. Removed stray `@packageDocumentation` tags from non-entry modules so only each package entry carries one.

This is a documentation-surface change only — every retagged symbol was already exported, and the build performs no `@internal` trimming, so the shipped type declarations are unchanged.

## 1.4.0

### Features

- [`ec206d3`](https://github.com/savvy-web/systems/commit/ec206d3cb8b0c1687b6e89f0b2a49c866a53fb7f) Adds a Changesets.ReleasePlanner service that drives the genuine changesets
  engine to compute a release plan, render a non-destructive preview of the next
  release, or natively apply a release. Preview runs the real formatter in a
  throwaway directory and reads the result back, so its output matches what ships.

## 1.3.1

### Bug Fixes

- [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### commit-quality reminder no longer fires on every prompt

The silk plugin injected the commit-create skill reminder on every `UserPromptSubmit` whose text mentioned a commit-adjacent verb (`commit`, `ship`, `finalize`, and the like). Because the trigger matched any mention — "look at the last commit", "revert that commit" — rather than an intent to create one, the block appeared on analysis, review, and status turns throughout a session and drowned out the turns where a commit was actually being composed.

The blanket `UserPromptSubmit` injection is removed. The commit-create directive is still delivered once per session by the SessionStart orientation block, and the message validation still runs as a just-in-time PreToolUse check on the actual `git commit` and `gh pr create` commands. The now-unused `savvy commit hook user-prompt-submit` subcommand and the `UserPromptSubmitEnvelope` and `userPromptSubmitContext` hook helpers are removed along with it.

- [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### markdownlint no longer lints files under `.git/`

The default markdownlint-cli2 config globs `**/*.{md,mdx}`, which swept ad-hoc session files under `.git/` (for example `.git/sdd/*.md`) and flagged them in the pre-commit hook. `**/.git` is now part of the default `ignores` list, so those files are excluded.

`savvy init` also reconciles `ignores` on an existing config now. On the silk preset without `--force` it previously synced only `$schema` and compared `config`, never touching `ignores`, so existing repos could not pick up new default excludes on a plain re-init. It now non-destructively appends any template ignores a repo is missing while preserving user-added entries — these are additive safety-excludes that cannot change a lint verdict, so they apply automatically, unlike `config` rules which stay warn-only.

## 1.3.0

### Bug Fixes

- [`2d7893a`](https://github.com/savvy-web/systems/commit/2d7893afbd2f82324f94a2a70eeeac2ee4b28b89) ### npm and GitHub Packages targets opt into provenance by default

`SilkPublishability.detect` now derives `PublishTarget.provenance` from the target registry: `true` for the npm public registry and GitHub Packages, `false` for JSR and custom registries. Previously every resolved target defaulted to `provenance: false`, so a consumer that gates attestation on the flag — such as the release action — never attested a published tarball and left the provenance column of its release summary empty.

The default is registry-derived rather than keyed to the `npm`/`github` target ids, so a custom target key pointed at `registry.npmjs.org` or `npm.pkg.github.com` also opts in.

## 1.2.0

### Features

- [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `Lint.POST_COMMIT_HOOK_PATH` export (#122)

A new constant `Lint.POST_COMMIT_HOOK_PATH` is exported from the `Lint` namespace, resolving to `.husky/post-commit`. It holds the conventional path for the savvy-hooks post-commit hygiene script so callers that create or inspect the hook do not need to hard-code the path themselves.

### `ConfigInspector` augments explicit `packages` records (\#127)

`Changesets.ConfigInspector` now **augments** an explicit `.changeset/config.json` `packages` record with the remaining release-surface workspace packages detected via `SilkPublishability`, rather than treating the record as a closed allow-list.

Previously, a `packages` record that existed only to annotate one package's `versionFiles` caused every other workspace package to be classified as unmapped during branch analysis. With this fix, all publishable workspace packages appear in the attribution map; packages whose annotation (`additionalScopes`, `versionFiles`, etc.) comes entirely from the config record retain their annotation, while unannotated packages are added with default attribution.

### Markdownlint template ignores test-fixture directories (\#123)

The generated `.markdownlint-cli2.jsonc` template now adds `**/__test__/**/fixtures/**` and `**/__fixtures__/**` to its `ignores` list. This brings the markdownlint handler into parity with the Yaml, Biome, and PackageJson handlers, which already excluded these paths.

The template's `MD025` rule is now configured as `{ "front_matter_title": "" }` (previously `true`), matching the `MD024: { "siblings_only": true }` rule it already carried. A regenerated config now allows sibling duplicate headings and treats front-matter titles as `H1`s consistently.

## 1.1.0

### Features

- [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) Exposes the changeset resolved-output result types as Effect `Schema`, so downstream tools can validate them and generate schemas from a single source of truth. New exports from the `Changesets` namespace: `BranchAnalysisSchema`, `BranchFileEntrySchema`, `FileStatusSchema`, `InspectedConfigSchema`, `ResolvedPackageScopeSchema`, `ResolvedVersionFileSchema`, `ClassificationSchema`, and `ClassificationReasonSchema`. The existing `BranchAnalysis`, `InspectedConfig`, and related types are now derived from these schemas, so their shape is unchanged.

### Bug Fixes

- [`5242460`](https://github.com/savvy-web/systems/commit/524246022b19465fad0e7a52de021b9804b1c37b) `ConfigInspector` now attributes changed files to workspace packages even when `.changeset/config.json` declares no explicit `packages` record. It falls back to the discovered workspace packages that are a release surface — those whose `publishConfig` resolves to publish targets — so single-root repos and monorepos with a non-root package directory get correct attribution instead of an empty result. A private package with no `publishConfig` is correctly excluded, and packages in the `ignore` list remain valid changeset targets.
- `silk/body-no-markdown` no longer flags double-underscore identifiers such as `__PACKAGE_VERSION__` as bold. Bold is now detected only in its asterisk form, so identifier tokens written in commit bodies are accepted.

### Dependencies

- | [`e6e3ee4`](https://github.com/savvy-web/systems/commit/e6e3ee464b9e5ae56e45acbf03b583e1bc11d7c3) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | tinyglobby | dependency | updated | ^0.2.16 | ^0.2.17 |  |

## 1.0.1

### Dependencies

- | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | sort-package-json | dependency | updated | ^3.6.1 | ^4.0.0 |  |
  | workspaces-effect | dependency | updated | ^1.1.0 | ^1.2.0 |  |

## 1.0.0

### Breaking Changes

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) ### Publish-target resolution is binding-driven and Record-map only

`SilkPublishability` no longer understands the legacy array form of `publishConfig.targets` — declare targets as the keyed Record-map (`{ npm: true, github: true, … }`). Target resolution now matches the `@savvy-web/bundler` prod layout:

- `SilkPublishability.detect(pkgName, raw, binding)` takes a third argument: the parsed `dist/prod/targets.json` binding (or `null` before the prod build). With a binding it emits one `PublishTarget` per resolved registry target, with `directory` set to the bound group's `dist/prod/<group>/pkg` dir. `npm: true` + `github: true` collapse into one scoped-name byte group deployed to both registries (two targets, one directory). Without a binding it emits one count-accurate placeholder per declared key.
- `access` comes from top-level `publishConfig.access` (default `public`); per-target `access`/`provenance`/`directory` and string shorthands are removed (`provenance` defaults `false`).
- New public API: `readTargetsBinding(fs, pkgPath)` and the binding types `TargetsBinding` / `TargetBinding` / `TargetGroupBinding`. Removed `RawTargetSpec`, replaced by `RawTargetObject` / `RawTargetValue` / `RawPublishTargets`.
- Both `PublishabilityDetector` layers and `SilkWorkspaceAnalyzer` thread the binding through.

### Features

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Adds the `Turbo` read-only Turborepo inspection namespace (`TurboInspector` + `TurboDigest` exposing `diagnoseCache`/`taskGraph`/`affected`, all `--dry`).

### Build System

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`.

## 0.6.1

### Other

- [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

## 0.6.0

### Features

- [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### Changesets namespace

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

- [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) `SilkWorkspaceAnalyzer.analyze(root)` now passes `root` through to `WorkspaceDiscovery.listPackages()`. Previously the call omitted `root`, causing package discovery to resolve from the process working directory rather than the requested workspace root. Topological sort falls back to discovery order when the sort was built against a different root (e.g. in tests).

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

- [`1321cc8`](https://github.com/savvy-web/systems/commit/1321cc8965d0c24bccf5fc783f0bee7934227b16) ### `ManagedSection.syncMany` — ordered multi-section sync

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

- `SavvyBaseSection` + `savvyBasePreamble()` — a package-manager detection preamble that sets `ROOT`, `in_ci`, `PM`, and `pm_exec` shell variables.
- `SavvyHooksSection` + `savvyHooksHygiene()` — a self-guarded repo hygiene section (runs only outside CI).
- `savvyToolSection(toolName, command)` — builds an `in_ci || pm_exec <command>` tool-execution section for any named tool.

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

- | [`846ab73`](https://github.com/savvy-web/systems/commit/846ab73ee6d7dba52822cd7d346fa0c2b66156da) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | workspaces-effect | dependency | updated | ^1.0.0 | ^1.1.0 |  |
  | @savvy-web/rslib-builder | devDependency | updated | ^0.20.4 | ^0.20.6 |  |

## 0.4.0

### Minor Changes

- [`30f6764`](https://github.com/savvy-web/systems/commit/30f6764ead0350128471d09721c4d5df15addb6c) Standardize publishability on workspaces-effect's `PublishTarget` + `PublishabilityDetector` Tag. Adds `SilkPublishability` (the silk `detect` rule plus `expandShorthand`/`resolveTargetAccess` helpers and `resolveTargets`/`listPublishable` resolvers, all as static members), `SilkPublishabilityDetectorLive`, `PublishabilityDetectorAdaptiveLive` (ignore-aware silk/vanilla/none dispatch over the `PublishabilityDetector` Tag), and a `ChangesetConfig` accessor service (`mode`/`versionPrivate`/`ignorePatterns`/`isIgnored`/`fixed`, plus the static `ChangesetConfig.matches` ignore matcher). `SilkWorkspaceAnalyzer` now emits `PublishTarget` and honors `@scope/*` wildcard changeset-ignore patterns.

**Breaking:** removes the bespoke `SilkPublishabilityPlugin`, `TargetResolver`, the `PublishabilitySchemas` exports (`PublishTarget`/`ResolvedTarget`/`PublishProtocol`/`PublishTargetObject`/`PublishTargetShorthand`/`AuthStrategy`), `TargetResolutionError`, and `PublishConfigError`. The changeset-config schema types `ChangesetConfig`/`SilkChangesetConfig` are renamed to `ChangesetConfigFile`/`SilkChangesetConfigFile` — the `ChangesetConfig` name is now the accessor service. `auth`/`tokenEnv` resolution moves consumer-side.

## 0.3.0

### Features

- [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added `SilkWorkspaceAnalyzer` service — composite service that analyzes a workspace root and produces a complete `WorkspaceAnalysis` result. Discovers workspaces via `workspaces-effect`, detects publishability with Silk multi-target support, reads changeset config, computes versioning strategy, and determines release status per workspace.
- Added `AnalyzedWorkspace` and `WorkspaceAnalysis` — `Schema.TaggedClass` data types with instance methods for workspace queries, target lookups, group membership, and filtered views. Includes `Equal`/`Hash` support and `Pretty` printing.
- Added `SilkPublishConfig` schema — extends the upstream `PublishConfig` from `workspaces-effect` with a Silk `targets` field for multi-registry publishing.
- Extended `ChangesetConfig` to cover the full `@changesets/config@3.1.1` specification, including `privatePackages`, `snapshot`, `prettier`, `changedFilePatterns`, and `bumpVersionsWithWorkspaceProtocolOnly`.

### Tests

- [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Added 100+ fixture files across standalone, pnpm, npm, yarn, and bun workspace configurations, with 29 integration tests that exercise the full `SilkWorkspaceAnalyzer` pipeline against real filesystem reads.
- `AnalyzedWorkspace` and `WorkspaceAnalysis` include property-based test coverage via `fast-check`.

### Maintenance

- [`820494f`](https://github.com/savvy-web/systems/commit/820494f2fd61abb45f3a611462221b7886aac42f) Migrated all co-located unit tests from `src/` to `__test__/` for consistent `vitest` auto-discovery.

## 0.2.2

### Bug Fixes

- [`b65d3d2`](https://github.com/savvy-web/systems/commit/b65d3d26fb9da4474b9e39225d8c4b85d35e6eac) ### Fix ManagedSection markers missing newline separators from content

BEGIN/END markers were concatenated directly with managed content, producing malformed output where markers and content appeared on the same line. The service now ensures markers are always on their own lines and handles boundary newlines transparently on read/write round-trips.

## 0.2.1

### Bug Fixes

- [`31824c1`](https://github.com/savvy-web/systems/commit/31824c15a013cf5ce13462c4dfc223785f9e893e) Bumps workspaces-effect dependency for parsing issue fix

## 0.2.0

### Features

- [`0da7c1e`](https://github.com/savvy-web/systems/commit/0da7c1e04fa60ad6745d3dbabf9af9a5b68d780d) ### SectionDefinition and SectionBlock value objects

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

- `SectionDiff` — `Unchanged` or `Changed({ added, removed })` from comparing two `SectionBlock` values
- `SyncResult` — `Created`, `Updated({ diff })`, or `Unchanged` from a write-if-changed operation
- `CheckResult` — `Found({ isUpToDate, diff })` or `NotFound` from a read-only comparison

### ManagedSection service redesigned with sync/check/dual API

`ManagedSection` is a fully redesigned `Context.Tag` service backed by `@effect/platform` `FileSystem`. The previous hook-style API is replaced with five operations, all using the dual pattern:

| Method | Takes | Returns |
| :-- | :-- | :-- |
| `read` | `SectionDefinition` | `SectionBlock \| null` |
| `isManaged` | `SectionDefinition` | `boolean` |
| `write` | `SectionBlock` | `void` |
| `sync` | `SectionBlock` | `SyncResult` |
| `check` | `SectionBlock` | `CheckResult` |

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

- `resolve(definition)` — returns `ResolvedTool` or `ToolResolutionError`
- `require(definition, message?)` — like `resolve` but maps failures to `ToolNotFoundError`
- `isAvailable(definition)` — quick boolean availability check, no caching

Resolution behavior is controlled by three tagged-enum policies on `ToolDefinition`:

- `VersionExtractor` — `Flag({ flag, parse? })`, `Json({ flag, path })`, or `None`
- `ResolutionPolicy` — `Report`, `PreferLocal`, `PreferGlobal`, or `RequireMatch`
- `SourceRequirement` — `Any`, `OnlyLocal`, `OnlyGlobal`, or `Both`

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

- `exec(...args)` — runs the tool through the local package manager (`pnpm exec`, `npx --no`, etc.) or directly if global
- `dlx(...args)` — runs the tool via the package manager's dlx/npx equivalent without requiring a local install

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

- [`d553939`](https://github.com/savvy-web/systems/commit/d5539392f70a56ada8b035313fa2d11c98fa5bde) Introduces `@savvy-web/silk-effects`, a platform-agnostic Effect library that consolidates shared Silk Suite conventions into a single package consumed across the ecosystem. The library is built on `@effect/platform` and requires `effect` as a peer dependency -- consumers supply their own platform layer.

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
