# @savvy-web/silk

## 3.11.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.8.0 | 2.8.1 |
| @savvy-web/mcp | dependency | updated | 2.6.4 | 2.6.5 |

## 3.11.0

### Bug Fixes

- Biome config bugs.

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.10.9

### Bug Fixes

- Fixes biome schema version

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.10.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 2.7.8 | 2.8.0 |

## 3.10.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.8 | 2.7.8 |
| @savvy-web/mcp | dependency | updated | 2.6.4 | 2.6.4 |
| @biomejs/biome | peerDependency | updated | 2.5.9 | 2.5.10 |
| @types/node | peerDependency | updated | ^26.2.0 | ^26.3.0 |
| turbo | peerDependency | updated | ^2.10.11 | ^2.10.12 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.10.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | dependency | updated | ^0.18.2 | ^0.18.3 |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.7 | 2.7.8 |
| @savvy-web/mcp | dependency | updated | 2.6.3 | 2.6.4 |

[#565][#565]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#565]: https://github.com/savvy-web/systems/pull/565

## 3.10.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.6 | 2.7.7 |
| @savvy-web/mcp | dependency | updated | 2.6.3 | 2.6.3 |

## 3.10.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | dependency | updated | ^0.18.1 | ^0.18.2 |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.5 | 2.7.6 |
| @savvy-web/mcp | dependency | updated | 2.6.2 | 2.6.3 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.10.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.4 | 2.7.5 |
| @savvy-web/mcp | dependency | updated | 2.6.1 | 2.6.2 |

## 3.10.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/git | dependency | updated | ^0.9.0 | ^0.10.0 |
| @effected/workspaces | dependency | updated | ^0.18.0 | ^0.18.1 |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.3 | 2.7.4 |
| @savvy-web/mcp | dependency | updated | 2.6.0 | 2.6.1 |

[#550][#550]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#550]: https://github.com/savvy-web/systems/pull/550

## 3.10.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.2 | 2.7.3 |
| @savvy-web/mcp | dependency | updated | 2.5.2 | 2.6.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.17.2 | ^0.18.0 | [#547][#547] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#547]: https://github.com/savvy-web/systems/pull/547

## 3.10.0

### Features

- ### `journal-append.sh --init --ball ours|theirs`
  `--init` now accepts an optional `--ball` override of the role-derived opening ball. The role default (`requested` → upstream's ball) assumes round 1's `request` mail has already been sent; a loop opened before that mail exists — for example from a pre-filed issue — starts with the downstream owing the opening mail instead, inverting the default on both sides at once. Pass `--ball ours` on the side that owes the opening mail and `--ball theirs` on the other to state that explicitly at `--init` time rather than correcting it afterward.
  ```bash
  journal-append.sh <journal> --init --role downstream --ball ours \
    --counterpart-id effected --counterpart-path ../effected --link-type pnpm-overrides
  ```
  ### `override-audit.mjs`
  New warn-only script for the dogfood skill's `--init` and `--adopt` flows: `node scripts/override-audit.mjs`, pointed at the repo's `pnpm-workspace.yaml`, flags every `file:`/`link:` override whose target the registry would already satisfy at a version matching what consumers declare. That shape is exactly an over-derived link closure — an override that never needed to exist. A warning is a prompt to re-check the derivation while the entry is still cheap to remove, not a failure; a deliberate override of a package the upstream hasn't yet published is the normal mid-loop state.

### Documentation

- The dogfood skill's counterpart briefing now states in prose whose ball it is and what the opening move is, cross-referenced from both `--init` step 6 and the `release` mail's per-package registry-probe requirement.
- `--exit` documents its ordering explicitly: the linked-loop safety net (the `file:` override) and the semver check are never both present at once — while linked there is a net and no check, at `--exit` there is a check and no net — which is why a stale declared range passes every gate green until the exact moment the override is removed. `--adopt` step 5 (bump declared ranges while still linked) is reframed around this same distinction.
- `--status` and the upstream side of `--exit` now probe the registry once per package in a release cut, not once for the cut as a whole — multi-package cuts publish staggered, so a green release workflow does not mean every package is installable yet.
- New Discipline rule: a coherent-kit differential probe only proves what its fixture exercises. A fixture that omits the disputed case (e.g. a known divergence between two implementations) proves nothing about it, even when the probe passes. [#541][#541]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.1 | 2.7.2 |
| @savvy-web/mcp | dependency | updated | 2.5.1 | 2.5.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.17.1 | ^0.17.2 | [#542][#542] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#541]: https://github.com/savvy-web/systems/pull/541

[#542]: https://github.com/savvy-web/systems/pull/542

## 3.9.1

### Bug Fixes

- ### Declare the peers silk-effects requires
  `@savvy-web/silk` externalizes `@savvy-web/silk-effects` and re-adds it to its published manifest as a runtime
  dependency, so installing silk resolves silk-effects transitively — and inherits the three peers silk-effects now
  requires. Nothing in the published graph named them.

  Under pnpm's `autoInstallPeers: true` that silently materialized a second copy of each, which is the duplication
  the peer change exists to remove. Under yarn, or pnpm with `autoInstallPeers: false`, `import "@savvy-web/silk/lint"`&#10;failed with `ERR_MODULE_NOT_FOUND`.

  `@effected/commands`, `@effected/git` and `@effected/workspaces` are now declared, so a consumer installing silk
  alone gets a coherent graph.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.7.0 | 2.7.1 |
| @savvy-web/mcp | dependency | updated | 2.5.0 | 2.5.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @types/bun | peerDependency | updated | ^1.3.14 | ^1.4.0 |  |
  | @effected/commands | dependency | added | — | ^0.5.0 |  |
  | @effected/git | dependency | added | — | ^0.9.0 |  |
  | @effected/workspaces | dependency | added | — | ^0.17.1 | [#537][#537] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#537]: https://github.com/savvy-web/systems/pull/537

## 3.9.0

### Features

- ### Sorted keys in more config files
  The preset's key-sorting override (`assist.actions.source.useSortedKeys`) now covers more of a repo's config files. Biome alphabetizes the keys in each of these on a `--write` pass or an editor save with `source.fixAll.biome` enabled:
  - `.claude/settings.json` / `.claude/settings.local.json`
  - `.claude/design/design.config.json`
  - `.changeset/config.json`
  - `**/.markdownlint.json` and `**/.markdownlint-cli2.jsonc`
  - `**/devcontainer.json`
  - `.vscode/*.json`
  - `**/biome.json` / `**/biome.jsonc` / `**/silk.jsonc`
  - `**/.claude-plugin/plugin.json` and `**/.claude-plugin/marketplace.json`

  Expect a one-time reordering diff across these files the first time you run `savvy lint --write` after upgrading. They are hand-maintained, so the diff can be large even though no value changes — review it once and commit it. Drop the override from your own `biome.jsonc` if you would rather keep a hand-ordered file.
  ### Catalog-aware module resolution
  `javascript.resolver.experimentalPnpmCatalogs` is now enabled in the preset. Biome resolves `catalog:` and `catalog:<name>` dependency specs from `package.json`, so dependency-aware rules understand a workspace that keeps its versions in pnpm catalogs instead of treating those specs as unresolvable.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 2.6.9 | 2.7.0 |
| @savvy-web/mcp | dependency | updated | 2.4.10 | 2.5.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @biomejs/biome | peerDependency | updated | 2.5.0 | 2.5.9 | [#534][#534] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Maintenance

- **This preset now requires Biome 2.5 or newer.** `linter.rules.preset` and `javascript.resolver` do not exist in 2.4.x, and Biome rejects unknown configuration keys outright rather than ignoring them, so a repo on 2.4.x must upgrade before taking this release. `savvy init` and the release pipeline move consumers onto the pinned version.
  - `linter.rules.recommended: true` migrated to `linter.rules.preset: "recommended"`, which replaces it as of Biome 2.5. Lint behavior is unchanged.
  - The `$schema` URL moves to 2.5.9 — the version CI reads to install the Biome binary. [#534][#534]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#534]: https://github.com/savvy-web/systems/pull/534

## 3.8.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.8 | 2.6.9 |
| @savvy-web/mcp | dependency | updated | 2.4.9 | 2.4.10 |

## 3.8.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.7 | 2.6.8 |
| @savvy-web/mcp | dependency | updated | 2.4.8 | 2.4.9 |

## 3.8.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.6 | 2.6.7 |
| @savvy-web/mcp | dependency | updated | 2.4.7 | 2.4.8 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/cli | peerDependency | updated | ^3.0.0 | ^3.0.1 |  |
  | @vitest/coverage-istanbul | peerDependency | updated | ^4.1.10 | ^4.1.11 |  |
  | @vitest/coverage-v8 | peerDependency | updated | ^4.1.10 | ^4.1.11 |  |
  | turbo | peerDependency | updated | ^2.10.10 | ^2.10.11 |  |
  | vitest | peerDependency | updated | ^4.1.10 | ^4.1.11 | [#525][#525] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#525]: https://github.com/savvy-web/systems/pull/525

## 3.8.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.5 | 2.6.6 |
| @savvy-web/mcp | dependency | updated | 2.4.6 | 2.4.7 |

## 3.8.0

### Features

- ### watch-issues monitor only reports what it can vouch for
  The `watch-issues` monitor now stays silent unless an artifact clears three provenance gates: `buildOk` is read three-state (`true`/`false`/absent), never collapsed to a pass; the artifact's mtime must be at least as new as the package's newest source file; and the package's working tree must be clean, checked only once a candidate has already cleared the other two gates. The notification no longer suggests dispatching a fixer — it names the count and points at the artifact, framed as reporting an artifact rather than any agent's in-flight work.

  A per-project advisory lock (keyed on a hash of the project root, held in the OS temp directory) now keeps a second resident watcher for the same project from stacking up alongside an existing one; a stale lock from a dead process is taken over automatically.
  ### `journal-append.sh --package` / `--clear-packages`
  The dogfood journal script gained a repeatable `--package '<name>=<override>'` and a `--clear-packages` flag (downstream entries only, mutually exclusive with each other) so a link-lazy loop that starts with an empty package closure can record the real one once it installs mid-round. Each use replaces the whole `packages` array rather than merging into it — a journal snapshot always describes one complete closure.
  ```bash
  journal-append.sh <journal> --event phase-change --phase adopting --ball ours \
    --package "@effected/git=file:../effected/packages/git/dist/prod/npm/pkg" --packages-derived true
  journal-append.sh <journal> --event unlinked --phase unlinked --clear-packages
  ```
  ### "Reading a build as evidence" guidance in the `build` skill
  The `build` skill now explains why a hand-run `node savvy.build.ts --target prod` and a real `build:prod` task can look identical yet mean different things, and gives the one check that tells them apart: `dist/<target>/issues.json`'s `generatedAt` must postdate the newest source edit.

### Bug Fixes

- `biome-direct-deny` hook message now names the known false positive for a consumer repo with its own `node_modules/.bin/biome` on `PATH` — the deny still fires there, but the message frames it as a redirect to the sanctioned lint path rather than a lost capability.

### Tests

- Added `tests/monitor-watch-issues.bats` covering each `watch-issues` provenance gate as a reason to stay silent.
- Replaced residual `better-sqlite3` exemplars in the dogfood journal bats fixtures with `esbuild`. [#517][#517]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#517]: https://github.com/savvy-web/systems/pull/517

## 3.7.12

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.4 | 2.6.5 |
| @savvy-web/mcp | dependency | updated | 2.4.5 | 2.4.6 |

## 3.7.11

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.3 | 2.6.4 |
| @savvy-web/mcp | dependency | updated | 2.4.4 | 2.4.5 |

## 3.7.10

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.2 | 2.6.3 |
| @savvy-web/mcp | dependency | updated | 2.4.3 | 2.4.4 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.3.0 | ^0.4.0 | [#509][#509] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#509]: https://github.com/savvy-web/systems/pull/509

## 3.7.9

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.1 | 2.6.2 |
| @savvy-web/mcp | dependency | updated | 2.4.2 | 2.4.3 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.2.0 | ^0.3.0 |  |
  | effect | dependency | updated | 4.0.0-beta.107 | 4.0.0-rc.109 | [#502][#502] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#502]: https://github.com/savvy-web/systems/pull/502

## 3.7.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 2.4.1 | 2.4.2 |

## 3.7.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.6.0 | 2.6.1 |
| @savvy-web/mcp | dependency | updated | 2.4.0 | 2.4.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @commitlint/cli | peerDependency | updated | ^21.2.1 | ^21.2.2 |  |
  | @commitlint/config-conventional | peerDependency | updated | ^21.2.0 | ^21.2.2 |  |
  | @types/node | peerDependency | updated | ^26.1.2 | ^26.2.0 |  |
  | tsx | peerDependency | updated | ^4.23.4 | ^4.23.12 |  |
  | turbo | peerDependency | updated | ^2.10.8 | ^2.10.10 | [#498][#498] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#498]: https://github.com/savvy-web/systems/pull/498

## 3.7.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.5 | 2.6.0 |
| @savvy-web/mcp | dependency | updated | 2.3.5 | 2.4.0 |

## 3.7.5

### Bug Fixes

- Fix the silk plugin's skill-script repository resolution: `commit.sh`, `validate-message.sh`, and `changeset/list.sh` now resolve the target repository from the caller's working directory first (via a shared `resolve-cli-project-dir.sh` helper), treat `SILK_PROJECT_DIR` as an explicit override with a stderr notice when it diverges, and refuse with both paths named when an inherited `CLAUDE_PROJECT_DIR` points at a genuinely different repository. Previously a stale inherited environment variable silently ran `git commit` against the wrong checkout from worktrees and sibling repos. [#493][#493]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#493]: https://github.com/savvy-web/systems/pull/493

## 3.7.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.4 | 2.5.5 |
| @savvy-web/mcp | dependency | updated | 2.3.4 | 2.3.5 |

## 3.7.3

### Bug Fixes

- Stops the Biome preset's `useImportExtensions` autofix from rewriting correct `.json` (and other asset) imports to `.js`, which broke module resolution. The preset now uses `extensionMappings` (`ts`/`tsx` to `js`, `mts` to `mjs`, `cts` to `cjs`) instead of the legacy `forceJsExtensions: true`, so unmapped extensions like `json` and `css` keep the imported file's real extension. The now-redundant `.tsx` override that partially worked around the same problem is removed.
  - JSON asset imports (including `with { type: "json" }`) are no longer flagged or rewritten
  - Missing-extension TypeScript imports still receive the correct emitted `.js`/`.mjs`/`.cjs` extension
  - Existing `biome-ignore lint/correctness/useImportExtensions` suppressions for asset imports become unnecessary (and will surface as unused-suppression warnings)
  - `.tsx` files are now linted at the base `error` severity: the removed override had pinned them to `on`, this rule's default `warning` level [#478][#478]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.3 | 2.5.4 |
| @savvy-web/mcp | dependency | updated | 2.3.3 | 2.3.4 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#478]: https://github.com/savvy-web/systems/pull/478

## 3.7.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.2 | 2.5.3 |
| @savvy-web/mcp | dependency | updated | 2.3.2 | 2.3.3 |

- | Dependency | Type | Action | From | To |  |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @changesets/cli | dependency | updated | ^3.0.0-next.10 | ^3.0.0 | [#483][#483] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#483]: https://github.com/savvy-web/systems/pull/483

## 3.7.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.1 | 2.5.2 |
| @savvy-web/mcp | dependency | updated | 2.3.1 | 2.3.2 |

## 3.7.0

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

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.5.0 | 2.5.1 |
| @savvy-web/mcp | dependency | updated | 2.3.0 | 2.3.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | prettier | dependency | removed | ^3.9.6 | — |  |
  | semver | dependency | removed | ^7.8.5 | — | [#467][#467] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#467]: https://github.com/savvy-web/systems/pull/467

## 3.6.0

### Features

- Dropping a stale submodule registration is now reachable from Bash: `git config --remove-section submodule.<name>`, `--unset`, `--unset-all`. This is the remedy the drift report names for an orphaned registration, and no tool performs it, so denying it left a detected problem with no sanctioned fix. Narrow by design — removal verbs only, local config only, and every `.repos/`-mentioning token must be a `submodule.<name>` key rather than a path.

### Bug Fixes

- The repos Bash guard classifies `git config`, `git submodule` and `git remote` by their flags and subverb rather than by name, because each is read-or-write depending on how it is invoked and a by-name list cannot express that.

  Reads that were denied now pass: `git config --get`/`--get-regexp`/`--get-all`/`--list`, `git submodule status`/`summary`, and `git remote -v`/`show`/`get-url`. A submodule's config key embeds its own path by construction, so `submodule..repos/<name>.url` looked like a vendored path while actually addressing the superproject's `.git/config` — which meant no submodule config key could be read at all.

  A write that was permitted now denies: `git remote set-url` against a vendored tree. `remote` sat on the by-name read list, so every one of its write forms passed.

  A `sed -i` whose expression mentions `.repos/` is no longer denied when its file operands sit outside it. The expression is not a path, and scanning every token could not tell the two apart; positional parsing cannot resolve it either, since BSD `sed -i ''` takes a backup-suffix argument GNU `sed -i` does not. A `.repos/` file operand still denies, expression or not.

  The `gitmodules-drift` monitor sweeps once at startup. Its watchers only fire on a change to `.gitmodules` or `.repos/config.json`, so drift that already existed when a session opened was invisible — and two drift kinds touch neither file by construction, a stale local registration living in `.git/config` and a diverged nested submodule living inside a vendored tree. The sweep is delayed past the SessionStart hook's own `savvy repos sync` so it never reads a tree mid-unlock.

### Documentation

- The repos skill states the vendored posture directly: a vendored submodule is not yours to fetch, update, or manage from a git client, and `sync` declares that to git rather than leaving a permission error to announce it. It also covers the worktree-only lock scope and what it does and does not prevent, the two new drift kinds, why a re-vendor must carry `orientation` across by hand, and a crash-recovery runbook for `rename`, which has no rollback and does not resume on a blind retry.

  Guard fixtures name the canonical vendored path instead of a gitdir name this repo no longer carries. [#464][#464]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.4.2 | 2.5.0 |
| @savvy-web/mcp | dependency | updated | 2.2.2 | 2.3.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#464]: https://github.com/savvy-web/systems/pull/464

## 3.5.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.4.1 | 2.4.2 |
| @savvy-web/mcp | dependency | updated | 2.2.1 | 2.2.2 |

## 3.5.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.4.0 | 2.4.1 |
| @savvy-web/mcp | dependency | updated | 2.2.0 | 2.2.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.1.1 | ^0.2.0 |  |
  | effect | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#449][#449] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#449]: https://github.com/savvy-web/systems/pull/449

## 3.5.0

### Features

- ### New `gitmodules-drift` monitor
  A background monitor now watches `.gitmodules` and `.repos/config.json` and notifies when `savvy repos status --drift` reports disagreement between the manifest, `.gitmodules`, the worktree, and `git submodule status`. It's notify-only — filesystem and subprocess access only, never mutates anything, and fails open (silently) when the `savvy` CLI isn't available in the project.

### Bug Fixes

- The `repos-bash-guard` hook's lifecycle-operation deny messages now point at the sanctioned tool for each case instead of a single generic message: unvendoring (`git rm`/`git submodule deinit`) points at `repos_manage`/`savvy repos remove`, and renaming (`git mv`) now points at `repos_manage`/`savvy repos rename` now that those primitives exist. The guard also now denies `git reset --hard`/`git clean` against vendored paths, pointing at `repos_manage`/`savvy repos restore` — recovering a dirty vendored tree is a lifecycle operation with its own sanctioned primitive, not a raw git reset.

### Documentation

- The `repos` skill's lifecycle coverage is fully rewritten to document the `remove`/`rename`/`restore` operations and the `status --drift` reconciliation report. [#436][#436]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.3.0 | 2.4.0 |
| @savvy-web/mcp | dependency | updated | 2.1.0 | 2.2.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 2.2.1 | 2.3.0 |  |
  | @savvy-web/mcp | dependency | updated | 2.0.19 | 2.1.0 | [#436][#436] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#436]: https://github.com/savvy-web/systems/pull/436

## 3.4.2

### Bug Fixes

- ### `repos-bash-guard.sh`: stop false-positive denies, name what it's denying
  The repos vendored-tree Bash guard hook now scans a derived `SCAN` string instead of the raw command, stripping heredoc bodies and whitespace-containing quoted segments before matching. This stops it from denying commands that only mention `.repos/` inside prose — a heredoc payload, or a quoted sentence like `--body "run rm -rf .repos/x to reproduce"` — and from denying plain reads (`cat`, `grep`, `rg`, `ls`) of vendored paths, which were never writes.

  The non-git leg's `cp`/`mv` last-operand scan is now clause-scoped, so it no longer misreads an operand from an unrelated `&&`/`;`/`|`-separated command in the same string. `git add`/`git restore` are now allowed when every `.repos/`-mentioning token in the invocation resolves to exactly `.repos/config.json`, so staging the hand-editable manifest no longer trips the guard; a mixed pathspec that also touches vendored content still denies. Deny messages now name the actual operation (`unvendoring a repo is a lifecycle operation...` for `git rm`/`git submodule deinit`) instead of a one-size "re-pin via repos\_manage" message that didn't fit every denied shape.

### Documentation

- The `repos` skill now documents the OS-level read-only boundary: `ReposLockdown` (from `@savvy-web/silk-effects`) is the actual backstop on vendored trees, and this Bash guard hook is early-warning UX ahead of it, not the security boundary itself. [#429][#429]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.2.1 | 2.3.0 |
| @savvy-web/mcp | dependency | updated | 2.0.19 | 2.1.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#429]: https://github.com/savvy-web/systems/pull/429

## 3.4.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.2.0 | 2.2.1 |
| @savvy-web/mcp | dependency | updated | 2.0.18 | 2.0.19 |

## 3.4.0

### Features

- ### Commit messages target a scannable index entry
  `commit-create` now asks for three to five bullets, or one to two short paragraphs — roughly eight body lines. The repo squash-merges, so a long body is discarded at merge after costing real time to write; depth moves to the PR description, which outlives the commit. The skill adds a filter for what earns a line and an explicit cut list for what agents habitually include anyway: test counts, investigation evidence, mechanical carry-along renames, file-by-file walkthroughs.

  Two points are now stated against what the preset actually enforces rather than what the skill previously implied. Dash bullets are legal, because `silk/body-prose-only` is never enabled and the markdown detector defines a bullets pattern it never tests. Multiple issues go on one comma-separated `Closes #a, #b` line instead of a stacked column.
  ### New `pr-body` skill for pull-request descriptions
  Documents the `silk-release` marker contract that lets humans, local agents and cloud agents share one PR description without overwriting each other: which regions an agent owns, which are regenerated wholesale, and which survive. It records the empirical GitHub-linking behavior — only a bare `Closes #N` outside every fence links an issue, and a reference inside a fence is inert — which is why a release body carries the same issues in two spellings and why that duplication must not be normalized.

### Bug Fixes

- ### The message validator measures the trailer across a blank line
  The house format now separates the `Closes` line from the signoff with a blank line. The validator's footer scan stopped at that blank, so an over-long `Closes` line was measured against the body's 300-character cap instead of the footer's 100 — the diagnostic stayed silent and the commit-msg hook rejected the message afterwards, which is the exact failure the script exists to prevent. [#420][#420]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.16 | 2.2.0 |
| @savvy-web/mcp | dependency | updated | 2.0.17 | 2.0.18 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#420]: https://github.com/savvy-web/systems/pull/420

## 3.3.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.15 | 2.1.16 |
| @savvy-web/mcp | dependency | updated | 2.0.16 | 2.0.17 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.1.0 | ^0.1.1 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 3.3.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.15 | 2.1.15 |
| @savvy-web/mcp | dependency | updated | 2.0.16 | 2.0.16 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @biomejs/biome | peerDependency | updated | \~2.5.0 | 2.5.0 |  |
  | @types/node | peerDependency | updated | ^26.1.1 | ^26.1.2 |  |
  | lint-staged | peerDependency | updated | ^17.2.0 | ^17.3.0 |  |
  | markdownlint-cli2 | peerDependency | updated | ^0.23.1 | ^0.23.2 |  |
  | tsx | peerDependency | updated | ^4.23.1 | ^4.23.4 |  |
  | turbo | peerDependency | updated | ^2.10.7 | ^2.10.8 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 3.3.0

### Features

- New `biome-direct-deny.sh` pre-tool-use hook denies direct access to the Biome binary — bare, path-prefixed, `pnpm exec biome`, `npx`/`bunx`/`bun x`/`pnpm dlx`/`yarn dlx`, a scoped package name (`npx @biomejs/biome`, `bunx @biomejs/biome`), and prefix-wrapped forms — since a direct invocation does not resolve the repo's config and lints paths the config excludes (in this repo, that means the `.repos/**` vendored submodules, read-only and corruptible). Package-manager scripts of any name or form — `pnpm lint`, `pnpm --filter @savvy-web/cli lint`, `pnpm -r lint`, `turbo run lint` — are left alone entirely, since a script invocation always resolves `package.json` and therefore the config. Coverage of the direct-access rule is keyed to the script name across all four package managers, not to this repo's own package manager.
- New `journal-append.sh` script for the dogfood mailbox skill appends one complete state snapshot to a loop's journal, carrying forward the prior line's static fields and patching only what's passed, instead of requiring callers to hand-assemble the JSON object themselves.

### Bug Fixes

- The dogfood push guard (`dogfood-guard.sh`) is rekeyed from journal role/phase bookkeeping onto actual tree state: it now denies a `git push`/`gh pr create`/`gh pr edit` only when `pnpm-workspace.yaml`'s `overrides:` block actually carries a `file:`/`link:` path escaping the repo, rather than trusting a journal's last-recorded role. This closes a false-deny where a journal alone (with no override present) blocked a legitimate push (savvy-web/systems#387), without reopening the opposite failure of missing a real override with no journal yet (savvy-web/systems#332).

### Documentation

- Amendments to the dogfood mailbox protocol (`SKILL.md`, `references/jsonl-journal.md`, and `references/mail-kinds.md`) recording process learnings and precision fixes accumulated over the loop's use to date. [#408][#408]

### Refactoring

- `hooks/lib/split-segments.sh` extracts the quote-aware, control-operator command segmenter and prefix peeler shared by `biome-prefer-mcp.sh` and `biome-direct-deny.sh` (widened to also peel `sudo`/`command`/`time` and the `bun x`/`pnpm dlx`/`yarn dlx` runner aliases), so a future fix to the segmentation logic only has to happen once.
- `@savvy-web/silk`'s re-export of `ConfigDiscoveryLive` from `@savvy-web/silk-effects` is removed, following that package's layer-static rename — use `ConfigDiscovery.layer` instead of the removed `ConfigDiscoveryLive` binding.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.14 | 2.1.15 |
| @savvy-web/mcp | dependency | updated | 2.0.15 | 2.0.16 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#408]: https://github.com/savvy-web/systems/pull/408

## 3.2.11

### Bug Fixes

- Corrected the `plugins/silk` build skill's rspress-builder reference doc. The front-door example passed `apiModel`, an option `@savvy-web/rspress-builder` renamed to `meta`; the option table still listed the old `dtsBundledPackages`/`apiModel` names instead of the current `bundledPackages`/`dtsExternals`/`bundleNodeModules`/`meta` surface and the per-bundle `RspressBundleOptions` shape; and the peer contract named `@tsdown/css` as a consumer-supplied peer when it is rspress-builder's own dependency, while omitting the actual `typescript` peer. The doc also gained a section on the package's `./env` ambient-types export. Agents read this file when scaffolding or building an RSPress plugin, so the stale names and contract were being copied into new work. [#398][#398]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.13 | 2.1.14 |
| @savvy-web/mcp | dependency | updated | 2.0.14 | 2.0.15 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#398]: https://github.com/savvy-web/systems/pull/398

## 3.2.10

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.12 | 2.1.13 |
| @savvy-web/mcp | dependency | updated | 2.0.13 | 2.0.14 |

## 3.2.9

### Bug Fixes

- Prevent double import escaping on tsx files

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.2.8

### Refactoring

- Compacts the always-on `silk_capabilities` SessionStart orientation payload (emitted by `plugins/silk/hooks/session-start/orientation.sh`) from a detailed instruction dump into a compact index, cutting the emitted payload from 7,585 to roughly 3,008 characters. The payload re-fires on every session start, resume, and compact, so the reduction lowers the plugin's fixed context footprint per Anthropic's context-engineering guidance for Claude 5.
  - One line per MCP tool, with parameter and mode detail left to the tool's own schema instead of being spelled out in the payload
  - A one-sentence-per-agent index that keeps the proactive-dispatch nudges
  - A compact skill name list that defers to each skill's frontmatter description
  - A three-line Biome note and a prose active-hooks note in place of the longer prior explanations

### CI

- `hook-tests.yml` no longer runs the removed `plugins/github-actions` hook suite or watches its paths for changes [#393][#393]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.11 | 2.1.12 |
| @savvy-web/mcp | dependency | updated | 2.0.12 | 2.0.13 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#393]: https://github.com/savvy-web/systems/pull/393

## 3.2.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.10 | 2.1.11 |
| @savvy-web/mcp | dependency | updated | 2.0.11 | 2.0.12 |

## 3.2.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.9 | 2.1.10 |
| @savvy-web/mcp | dependency | updated | 2.0.10 | 2.0.11 |

## 3.2.5

### Bug Fixes

- Disable import css warnings on CSS file imports in TSX files

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 3.2.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.8 | 2.1.9 |
| @savvy-web/mcp | dependency | updated | 2.0.9 | 2.0.10 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | added | — | ^0.1.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#382]: https://github.com/savvy-web/systems/pull/382

## 3.2.3

### Bug Fixes

- The dogfood mail monitor no longer announces a session's own journal append as an inbound turn — it now surfaces mailbox changes before evaluating journals and suppresses a flip whose triggering mail it had already surfaced on an earlier tick.
- The `repos` pre-tool-use bash guard now recognizes a `git` invocation that names a vendored path within its own clause, instead of requiring an explicit directory flag, so sanctioned `git mv` and `git rm --cached` commands against vendored paths are no longer blocked. A plain `git rm` or a bare `rm` against a vendored path is still denied.

### Documentation

- The dogfood skill states the artifact-verification method — recursive search, citing the module path found, and checking a known-present control symbol before reporting an absence — and adds two protocol rules: a repo that is downstream in one loop and upstream in another owes its downstream a status when its own upstream ships, and a reopened loop may boot from a briefing carrying the current round rather than round zero. The tsdoc skill notes that a verbatim code or type transcription inside a doc comment needs a fenced block, since bare braces and angle brackets are read as TSDoc syntax. [#373][#373]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.7 | 2.1.8 |
| @savvy-web/mcp | dependency | updated | 2.0.8 | 2.0.9 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#373]: https://github.com/savvy-web/systems/pull/373

## 3.2.2

### Bug Fixes

- The dogfood mail monitor no longer replays a finished collaboration's mail as unread.

  New mail is detected by comparing mailbox files against the journal's `lastMail.in` pointer. When that pointer could not be resolved — it is absent on a loop that has received nothing yet, and stale when a hand-authored journal append names a file that does not exist — the watermark fell back to zero, which made every file in the mailbox count as newer. Reopening a loop against an existing journal therefore surfaced the entire archive of the previous collaboration in one burst.

  The fallback is now the current loop's `loop-started` timestamp, so mail predating the collaboration cannot be new to it.
  - `lastMail.in: null` stays honest for a freshly opened loop instead of having to be back-dated to a previous loop's file to silence the noise
  - A dangling pointer degrades to the same bounded watermark rather than to everything
  - A journal with no `loop-started` line keeps the previous behavior and still surfaces mail [#369][#369]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.6 | 2.1.7 |
| @savvy-web/mcp | dependency | updated | 2.0.7 | 2.0.8 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#369]: https://github.com/savvy-web/systems/pull/369

## 3.2.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.5 | 2.1.6 |
| @savvy-web/mcp | dependency | updated | 2.0.6 | 2.0.7 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | effect | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 3.2.0

### Features

- The github-actions plugin now ships an `action-engineer` agent and a
  twelve-skill suite for building Node.js 24 GitHub Actions with&#10;`@savvy-web/github-action-effects` and `@savvy-web/github-action-builder`.
  The `action-engineering` routing skill maps every job to the owning service
  and skill (and lists the capabilities that deliberately do not exist), and
  the topic skills carry the house patterns distilled from the production
  actions built on this stack: scaffolding from the template repo, `action.config.ts` builds and
  the bundler dependency decision guide, entry-point and layer wiring,
  input reading and validation, machine-readable output contracts with
  generated and drift-tested JSON Schemas, GitHub App authentication across
  pre/main/post, the GitHub API client surface, check runs, job summaries and
  sticky PR comments, step-buffered run logging, tagged-error and cross-phase
  state discipline, and testing with the library's test layers. Deep-dive
  material is vendored into per-skill `references/` files with provenance
  banners, verified against the installed package source. Skill content is
  written for a standalone action repo cloned from `github-action-template`:
  rules are stated directly with self-contained generic examples instead of
  citing sibling-repo precedent, library citations resolve under&#10;`node_modules/@savvy-web/…`, and example org/repo names are placeholders.

  The SessionStart orientation hook now advertises the agent, the full skill
  index, and the shared savvy-mcp server (and fails open when `jq` is
  missing), and closes with a dogfood-feedback block: it asks the session to
  keep a running log of rough edges in the plugin's own guidance and, only
  with the user's explicit agreement, open an issue against this repo. The
  plugin also gained a BATS + shellcheck suite wired into `pnpm test:hooks`&#10;and the Hook Tests workflow, covering the orientation payload's skill
  roster and the agent's skill-registration frontmatter. [#355][#355]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#355]: https://github.com/savvy-web/systems/pull/355

## 3.1.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.4 | 2.1.5 |
| @savvy-web/mcp | dependency | updated | 2.0.5 | 2.0.6 |

## 3.1.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.3 | 2.1.4 |
| @savvy-web/mcp | dependency | updated | 2.0.4 | 2.0.5 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | prettier | dependency | updated | ^3.9.5 | ^3.9.6 | [#349][#349] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#349]: https://github.com/savvy-web/systems/pull/349

## 3.1.0

### Features

- Added a `/silk:it2` skill for orchestrating iTerm2 panes and windows when
  running subagents — pinned split-direction semantics, a layout heuristic for
  matching pane geometry, grid recipes, badging, and dismiss-and-close
  discipline for torn-down subagents. It drives the raw `it2` CLI directly and
  does not require the separate `it2-skills` marketplace plugin.

### Bug Fixes

- The SessionStart `<terminal>` orientation block now only renders when the
  session is actually running in iTerm2 with the `it2` CLI on `PATH` (checked
  from environment variables alone, with no `it2` subprocess invoked from the
  hook). Previously the block appeared unconditionally, pointing users at the&#10;`it2` CLI even in terminals where it wasn't installed or usable. When the
  gate passes, the block also now teaches proactive pane orchestration for
  spawned subagents and points to the new `/silk:it2` skill. [#347][#347]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#347]: https://github.com/savvy-web/systems/pull/347

## 3.0.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.2 | 2.1.3 |
| @savvy-web/mcp | dependency | updated | 2.0.3 | 2.0.4 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | lint-staged | peerDependency | updated | ^17.0.8 | ^17.1.0 |  |
  | markdownlint-cli2 | peerDependency | updated | ^0.23.0 | ^0.23.1 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 3.0.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.1 | 2.1.2 |
| @savvy-web/mcp | dependency | updated | 2.0.2 | 2.0.3 |

## 3.0.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.1.0 | 2.1.1 |
| @savvy-web/mcp | dependency | updated | 2.0.1 | 2.0.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | effect | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#326]: https://github.com/savvy-web/systems/pull/326

## 3.0.3

### Bug Fixes

- Hardens the bundled `changeset-manager` agent so it no longer stalls or silently drops files when dispatched without an interactive surface.
  - The `AskUserQuestion` step is now conditional — it asks when the tool is available and otherwise escalates genuinely ambiguous files to the dispatching agent via `SendMessage` instead of silently excluding them.
  - A brand-new workspace package is treated as a first-class content changeset with its own single-package `minor` entry, and the content pass now runs before the dependency pass so a new package is announced before any dependency edge that references it.
  - The report step now enumerates every changed package that received no changeset along with the rationale, so an early stop can never be mistaken for "nothing needed". [#317][#317]

* The dogfood-mail monitor no longer re-fires the "your turn" alert for a finished loop whose journal ends on the terminal `unlinked` phase, so a completed loop stays quiescent across new sessions. Appending a fresh loop line reopens it deliberately. [#317][#317]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 2.0.1 | 2.1.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#317]: https://github.com/savvy-web/systems/pull/317

## 3.0.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.0.1 | 2.0.1 |
| @savvy-web/mcp | dependency | updated | 2.0.1 | 2.0.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | turbo | peerDependency | updated | ^2.10.4 | ^2.10.5 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 3.0.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 2.0.0 | 2.0.1 |
| @savvy-web/mcp | dependency | updated | 2.0.0 | 2.0.1 |

## 3.0.0

### Breaking Changes

- The install target re-exports `@savvy-web/silk-effects`' v4 surface; consumers pick up the v4 `effect` generation and the reshaped service, schema, and error types. [#312][#312]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.6.1 | 2.0.0 |
| @savvy-web/mcp | dependency | updated | 1.8.1 | 2.0.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/platform | dependency | removed | ^0.96.2 | — |  |
  | effect | dependency | updated | ^3.21.4 | catalog:effect | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 2.5.0

### Features

- ### `/silk:dogfood` skill
  A new skill for running a cross-repo "dogfood loop" — requesting, delivering, adopting, and iterating on changes from a sibling repo checkout (e.g. a package consumed via a temporary `file:` override) before anything is released. Supports `--init`, `--send <kind>`, `--status`, `--watch`, `--adopt`, and `--exit`, backed by a mailbox protocol (markdown mail files under `.claude/dogfood/`) and a per-loop JSONL state journal that tracks whose turn it is.
  ### Dogfood guard hook
  A new `PreToolUse` hook denies `git push` and pull-request creation (via `Bash`, the GitKraken MCP, and the GitHub MCP) while a downstream dogfood loop has active `file:` overrides linked in, preventing a branch with unreleased local artifacts from being pushed or opened as a PR.
  ### Dogfood mail monitor
  A new background monitor surfaces incoming `.claude/dogfood/` mail and journal turn-flips as they arrive.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.6.1 | 1.6.1 |
| @savvy-web/mcp | dependency | updated | 1.8.1 | 1.8.1 |

### Maintenance

- Session-start orientation now mentions the new `/silk:dogfood` skill and the two active background monitors, adds an it2 terminal-control hint, and reminds agents to clean up idle sessions/panes they spawned. [#309][#309]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#309]: https://github.com/savvy-web/systems/pull/309

## 2.4.4

### Dependencies

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/cli | peerDependency | updated | ^3.0.0 | ^3.0.0-next.8 |  |
  | @types/node | peerDependency | updated | ^26.1.0 | ^26.1.1 |  |
  | typescript | peerDependency | updated | ^7.0.0 | ^7.0.2 |  |
  | @vitest/coverage-istanbul | peerDependency | added | — | ^4.1.10 |  |
  | @vitest/coverage-v8 | peerDependency | added | — | ^4.1.10 |  |
  | tsx | peerDependency | added | — | ^4.23.1 |  |
  | vitest | peerDependency | added | — | ^4.1.10 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.4.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.6.1 | 1.6.1 |
| @savvy-web/mcp | dependency | updated | 1.8.1 | 1.8.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/cli | peerDependency | updated | ^3.0.0-next.8 | ^3.0.0 |  |
  | @types/bun | peerDependency | added | — | ^1.3.14 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.4.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.6.0 | 1.6.1 |
| @savvy-web/mcp | dependency | updated | 1.8.0 | 1.8.1 |

## 2.4.1

### Bug Fixes

- Bump `@changesets/cli` peer dependency to correct range.

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 2.4.0

### Features

- ### `.repos/` support: Biome exclusion, orientation hook, write guards, and skill
  The Biome preset now excludes `**/.repos` from processing, so vendored repo content stays searchable by other tools without ever being gitignored or reformatted.

  The bundled Claude Code plugin gains full support for the vendored-repos pattern:
  - A session-start hook that runs a best-effort `savvy repos sync` and injects a per-repo orientation block (purpose, layout, key paths, notes) into context on every session start, resume, and compact — budgeted at 2000 characters, with per-repo entries falling back to a one-line summary once the budget is exceeded.
  - Three `PreToolUse` write guards for `.repos/**`: a hard-deny for file-editing tools (with `.repos/config.json` itself exempted), and best-effort tripwires over Bash and MCP git-style tools — enforcing that vendored repos stay read-only-by-convention.
  - A new `/silk:repos` skill covering when to vendor a repo, sparse-checkout discipline, the re-pin-on-dependency-bump rule, and the orientation/notes editorial policy. Auto-loads whenever `.repos/config.json` is present. [#292][#292]

* ### Consolidated `silk_capabilities` orientation
  The always-on SessionStart hook now emits a single `<silk_capabilities>` block instead of the old fragmented `workspace_info`/`turbo_inspect`/Biome/changesets-plugin sections: the full ten-tool savvy-mcp index, the three-agent index, the eight-skill index, the Biome LSP/`biome_check`/Bash division of labor, and an active-hooks map (commit guards, the Biome nudge, the `.repos/**` write guards, changeset validation, the missing-changeset note). It's a net reduction in context size while adding coverage for `savvy commit`, `tsdoctor`, `/silk:build`, and the vendored-repos pattern that the old payload didn't mention.
  ### `tsdoctor` and `turborepo` agents gain direct Biome access
  Both agents now carry `mcp__plugin_silk_savvy-mcp__biome_check` in their tool allowlist, so they can run structured Biome checks and fixes directly instead of shelling out to Bash.
  ### `/silk:repos` pointer in vendored-repos orientation
  The per-session vendored-repos block now points at the `/silk:repos` skill for the judgment layer — when to vendor, sparse-checkout discipline, the re-pin rule, and notes editorial policy.

### Bug Fixes

- ### SessionStart producer now resolves the working tree worktree-correctly
  The always-on SessionStart hook — the producer of `SILK_PROJECT_DIR` and `SILK_PACKAGE_MANAGER` for every reader hook — previously ranked `CLAUDE_PROJECT_DIR` above the hook envelope's `cwd`, pinning a git-worktree session to the primary checkout's path and package manager for its whole life. It now resolves through the shared `resolve_project_dir` (envelope `cwd` first), and package-manager detection is deduplicated into the shared hook library with a uniform fail-open-to-npm posture across both SessionStart hooks.
  ### Corrected pre-commit and tool-preference guidance
  The startup context's tool-preference guidance previously taught Bash `biome check` as the primary path and wrongly claimed the root `typecheck` script runs `tsgo` directly. It now states the correct order — Biome LSP first (automatic diagnostics on edit), `biome_check` second (structured, can fix), Bash as the escape hatch — and adds a `pre_commit_pipeline` block enumerating every lint-staged autofix that runs on commit, including the intentional exec-bit strip on `.sh` files, so agents stop mistaking that mode flip for damage. [#299][#299]

### Documentation

- Documents that plugin hook scripts intentionally commit without an executable bit (`100644`). The lint-staged `ShellScripts` handler strips the exec bit from staged `.sh` files, and every hook is invoked as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."`, so the bit is never exercised. Prevents mistaking a `644` mode on a hook script for accidental permission drift during review. [#299][#299]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.10 | 1.6.0 |
| @savvy-web/mcp | dependency | updated | 1.7.6 | 1.8.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/cli | peerDependency | updated | ^3.0.0-next.8 | ^3.0.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

[#299]: https://github.com/savvy-web/systems/pull/299

## 2.3.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.9 | 1.5.10 |
| @savvy-web/mcp | dependency | updated | 1.7.5 | 1.7.6 |

## 2.3.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.8 | 1.5.9 |
| @savvy-web/mcp | dependency | updated | 1.7.4 | 1.7.5 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @typescript/native-preview | peerDependency | removed | ^7.0.0-dev.20260612.1 | — |  |
  | commitizen | peerDependency | removed | ^4.3.2 | — |  |
  | prettier | dependency | updated | ^3.9.4 | ^3.9.5 |  |
  | @commitlint/cli | peerDependency | updated | ^21.2.0 | ^21.2.1 |  |
  | turbo | peerDependency | updated | ^2.10.2 | ^2.10.4 |  |
  | typescript | peerDependency | updated | ^6.0.0 | ^7.0.0 | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 2.3.0

### Breaking Changes

- The `changeset-push-guard` PreToolUse hook is removed. No hook blocks a commit or a push for a missing changeset any more. Whether a change needs a changeset is a human judgement — a hook can only see "commits exist, no changeset file", which cannot distinguish a user-facing fix from a docs-only branch, so blocking on that signal was wrong for a large and legitimate class of branches. Enforcement belongs in CI on the pull request, where the full diff is available and an override is an explicit, reviewable human act. The `SILK_SKIP_PUSH_CHECK` environment variable is retired with it and no longer does anything.

### Features

- The `commit-create` skill now ships two bundled scripts. `scripts/validate-message.sh` measures every line of a candidate commit message against the real thresholds (reporting exact line numbers and lengths) and then gates on the actual commitlint preset, so it cannot drift from the rules the `commit-msg` hook enforces. `scripts/commit.sh` validates and, only on success, execs `git commit` in the same process — there is no separate step to skip, and it refuses `--no-verify`. The skill now mandates the wrapper as the only commit path.
- The `build` skill now auto-loads on `**/package.json` and `**/turbo.json` as well as `**/savvy.build.ts`. Because those globs fire on files that have nothing to do with the bundler, it opens with a concrete check for whether the file belongs to a `@savvy-web/bundler` or `@savvy-web/rspress-builder` package and tells the agent to move on if not. It documents the package.json script contract, the `prepare` rule, and what `turbo.json`'s `dependsOn` does and does not order.

* New `Stop` hook `stop/changeset-nudge.sh` replaces the push guard with a non-blocking reminder. When a main-agent turn ends on a branch that has commits but no changeset, it emits a top-level `systemMessage` — shown to the user, not injected into the model's context. It emits no decision and no `additionalContext`, so it cannot block the turn and does not instruct the agent. It is debounced on `HEAD`, so it speaks once per commit state rather than once per turn, and because `SubagentStop` is a separate event, a subagent making many commits never triggers it. Set `SILK_SKIP_CHANGESET_NUDGE=1` to opt out.
* SessionStart orientation now directs the agent to the MCP tools as the source of truth for release state — `changeset_inspect` for the classified branch diff, `changeset_preview` for the rendered CHANGELOG, `changeset_deps_detect` and `workspace_info` — instead of inferring it from the file tree. It also no longer claims a commit-time changeset reminder exists, which was never implemented.

### Bug Fixes

- Hooks now resolve the working tree from the hook envelope's `cwd` rather than `CLAUDE_PROJECT_DIR`, via a new shared `hooks/lib/hook-env.sh`. `CLAUDE_PROJECT_DIR` is pinned to the session's primary checkout and does not track the directory a tool call runs in, so any hook reasoning about git state from it inspected the wrong tree whenever an agent worked in a git worktree. This affected `commit-fs` and the changeset-validate post-tool hook. Note that `SILK_PROJECT_DIR` is derived from `CLAUDE_PROJECT_DIR` and carries the same limitation, so it ranks below `cwd` in the new resolution order.
- All jq-parsing hooks now fail open on invalid JSON from stdin instead of aborting under `set -euo pipefail` with jq's exit 5. Previously only a missing jq binary was guarded.
- `commit-fs.sh` no longer aborts with an unbound-variable error when `CLAUDE_PROJECT_DIR` is unset; it fails open like every other hook.
- The force-push exclusion in `match-safe-bash.sh` now anchors its `-f` match as a whole token. The unanchored version substring-matched inside other arguments, so `git push --follow-tags` and any push to a branch whose name contains `-f` (`my-feature`, `add-fix`) were knocked off the auto-allow hot path and prompted unnecessarily. Genuine force-pushes, including `--force-with-lease` and `--force-if-includes`, remain excluded.
- Every hook in `hooks.json` now declares an explicit `timeout`; four previously fell back to the 60s default. [#276][#276]

* The `commit-create` skill told agents to write each body paragraph as one continuous line because "the 300-character-per-line limit makes wrapping unnecessary". That guidance walked agents straight into `body-max-line-length` rejections, which surface only after a full lint-staged cycle. It now gives a safe target well below the ceiling and points at the validator rather than asking agents to eyeball a 300-character limit.
* The `commit-create` skill claimed subject case was enforced. It is not — `subject-case` is explicitly disabled in the Silk preset. Corrected to a style preference.
* The `commit-create` skill never documented `footer-max-line-length` (100 characters), which applies to trailer lines including `Signed-off-by` and `Closes`, and can reject a commit on its own.
* The plugin's test harness now shellchecks skill scripts under `skills/`, not just `hooks/`, `bin/`, and `tests/`. The bundled `skills/changeset/scripts/list.sh` had never been linted by the harness. [#276][#276]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.5.7 | 1.5.8 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#276]: https://github.com/savvy-web/systems/pull/276

## 2.2.4

### Bug Fixes

- The GitKraken MCP auto-allow matcher in `hooks.json` only ever matched `mcp__gk__*`, a prefix no real GitKraken MCP server registers under — the allowlist never fired and every GitKraken read op prompted for permission. The matcher now also covers `mcp__gitkraken__*` and `mcp__GitKraken__*`, so read-only ops (`git_status`, `git_log_or_diff`, and friends) are auto-allowed. `git_add_or_commit` and `git_push` are deliberately left off the auto-allow list so MCP-driven commits and pushes still prompt — auto-allowing them would bypass commit-message validation and the changeset-push-guard.
- `allowed-tools` in the `commit-create`, `config`, and `dependencies` skills is normalized from space-separated to comma-separated, fixing a grant that risked being mis-parsed. `config` also drops an unused `changeset_validate` grant, and the `turborepo` agent drops its dead `ListMcpResourcesTool`/`ReadMcpResourceTool` grants now that `savvy-mcp` is tools-only.
- The `status` skill no longer references `/silk:update`, `/silk:merge`, or `/silk:delete` — those are internal mechanics invoked by the changeset-manager agent, not user-facing commands. It now points at `/silk:changeset --create` and `/silk:changeset --squash` instead. [#273][#273]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.6 | 1.5.7 |
| @savvy-web/mcp | dependency | updated | 1.7.3 | 1.7.4 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#273]: https://github.com/savvy-web/systems/pull/273

## 2.2.3

### Bug Fixes

- The `changeset-manager`, `tsdoctor`, and `turborepo` plugin agents now include `SendMessage` in their `tools:` frontmatter, so when dispatched as teammates they can report results back to the orchestrator and answer a `shutdown_request` instead of idle-looping until the session ends. [#265][#265]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.5 | 1.5.6 |
| @savvy-web/mcp | dependency | updated | 1.7.2 | 1.7.3 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#265]: https://github.com/savvy-web/systems/pull/265

## 2.2.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.4 | 1.5.5 |
| @savvy-web/mcp | dependency | updated | 1.7.1 | 1.7.2 |

## 2.2.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.1 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.3 | 1.5.4 |
| @savvy-web/mcp | dependency | updated | 1.7.0 | 1.7.1 |

## 2.2.0

### Breaking Changes

- ### Changeset commands consolidated into a single `/silk:changeset` router
  The five separate changeset slash commands are removed and replaced by one flag-driven command. Anyone with muscle memory or scripts invoking the old command names must switch to the new form:

  | Old command | New command |
  | --- | --- |
  | `/silk:changeset-create [--require] [--package N] [--bump LVL] [--dry-run]` | `/silk:changeset --create [--require] [--package N] [--bump LVL] [--dry-run]` |
  | `/silk:changeset-squash [branch\|all] [--package N] [--dry-run]` | `/silk:changeset --squash [branch\|all] [--package N] [--dry-run]` |
  | `/silk:changeset-check` | `/silk:changeset --check` |
  | `/silk:changeset-list` | `/silk:changeset --list` |
  | `/silk:changeset-preview` | `/silk:changeset --preview` |

  A bare `/silk:changeset` (no flag) defaults to create/reconcile. `/silk:changeset-style` is unaffected and keeps its own name.

### Features

- ### New `build` skill
  `/silk:build` documents configuring and running `@savvy-web/bundler` (and its `rspress-builder` sibling) from a `savvy.build.ts` — the `build()` front door, the full `BuildConfig` option surface, `build:dev`/`build:prod`/`types:check`/`prepare` workspace and Turborepo wiring, SEA executables, and the API Extractor meta pass. It auto-loads whenever `savvy.build.ts` is opened.
  ### New `changeset-config` skill
  `/silk:changeset-config` documents `.changeset/config.json` in a Silk repo — the two-element `changelog` tuple, the standard `@changesets/config` fields, and the Silk-custom per-package `versionFiles` and `additionalScopes` options. It auto-loads whenever `.changeset/config.json` is opened. [#253][#253]

### Bug Fixes

- Hardens the silk plugin's Biome nudge hook and tsdoc monitor so they stop pointing agents at actions they cannot take, or should not take yet.
  - The `biome_check` nudge no longer fires inside subagents. Subagents run with a curated `tools:` allowlist and often cannot call the MCP tool the nudge recommends, so the reminder was a dead end.
  - The nudge now matches Biome only when it is the invoked binary, not when the word "biome" merely appears as an argument — for example inside a `gh issue create --body` text.
  - The tsdoc monitor debounces: it waits for a package's ae-\*/tsdoc- count to hold steady across a short quiet period before notifying, so an agent actively fixing diagnostics no longer triggers churn. The notification also tells the reader to let an in-flight fix finish before dispatching another. [#250][#250]

* Hardens the `tsdoctor` agent so a multi-step run (build → read `issues.json` → edit → rebuild) reliably finishes in a single dispatch and catches two header-comment mistakes the diagnostic-driven loop was missing.
  - Turn-discipline contract: the agent no longer ends a turn on a statement of intent — it must run the final verifying build, confirm the filtered `ae-*`/`tsdoc-*` arrays are empty, and deliver the report as its last message.
  - Proactive `@packageDocumentation` sweep: greps the package `src` and confirms every occurrence sits in an `exports`-entry file, since a stray tag on a non-entry file raises no diagnostic.
  - Comment-style rule: module-header narration on non-entry files (especially `internal/*`) must use `//` line comments, not `/** */` doc blocks, which API Extractor parses and can misattribute. [#249][#249]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#249]: https://github.com/savvy-web/systems/pull/249

[#250]: https://github.com/savvy-web/systems/pull/250

[#253]: https://github.com/savvy-web/systems/pull/253

## 2.1.3

### Bug Fixes

- The published manifest no longer promotes `@savvy-web/changelog`, `@savvy-web/cli`, and `@savvy-web/mcp` from `dependencies` to `peerDependencies`. Promoting them to peers let pnpm's `autoInstallPeers` propagate their Effect dependency graph into consuming repos at versions `@savvy-web/silk` didn't control. They now ship as regular, exact-pinned `dependencies` instead — the exact-version coupling via `workspace:*` is unchanged, only the manifest field. `@savvy-web/pnpm-plugin-silk` already hoists all three publicly, so their bins remain available to consumers either way. [#245][#245]

### Documentation

- The `changeset-manager` agent gains a sixth exclusion category, cross-package documentation drift, and a new rule requiring code examples in changesets to match the real API surface. The `config` skill's exclusion-category list is updated to match (five categories → six).
- The `tsdoc` skill's `ae-forgotten-export` guidance now distinguishes an in-package unexported type from an externally-inlined dependency type — each needs a different fix. The `ae-missing-release-tag` guidance now documents the `export * as NS` / `_d_exports` limitation and its sanctioned `suppressWarnings` workaround. [#238][#238]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.1 |
| @savvy-web/cli | dependency | updated | 1.5.2 | 1.5.3 |
| @savvy-web/mcp | dependency | updated | 1.6.7 | 1.7.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#238]: https://github.com/savvy-web/systems/pull/238

[#245]: https://github.com/savvy-web/systems/pull/245

## 2.1.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 1.5.1 | 1.5.2 |
| @savvy-web/mcp | dependency | updated | 1.6.6 | 1.6.7 |

## 2.1.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.1.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 1.5.0 | 1.5.1 |
| @savvy-web/mcp | dependency | updated | 1.6.5 | 1.6.6 |

## 2.1.0

### Features

- ### @savvy-web/changelog ships as a peer companion
  `@savvy-web/silk` now declares `@savvy-web/changelog` as a peer dependency alongside `@savvy-web/cli` and `@savvy-web/mcp` — installing `@savvy-web/silk` brings in the standalone changesets changelog generator as part of the same peer group.

### Bug Fixes

- The `./changesets/changelog` and `./changesets/markdownlint` subpath artifacts are now genuinely self-contained ESM builds (via the `@savvy-web/tsdown-plugins` fix) — the previously-published ESM variants of these subpaths silently broke once packed with `npm pack`.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/changelog | dependency | updated | 0.0.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 1.4.4 | 1.5.0 |
| @savvy-web/mcp | dependency | updated | 1.6.4 | 1.6.5 |

- | Dependency | Type | Action | From | To |  |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @savvy-web/changelog | workspace | added | — | 0.1.0 | [#223][#223] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#223]: https://github.com/savvy-web/systems/pull/223

## 2.0.0

### Breaking Changes

- Ships `@changesets/cli@^3.0.0-next.8` to consumers (was `^2.31.0`) as both a `devDependency` and `peerDependency`. The v3 CLI is a significant contract change for anyone consuming this package:
  - **ESM-only.** The CLI no longer ships a CommonJS build — projects invoking it programmatically must be able to `import` it.
  - **Node \>=22.11 required.** Consumers on older Node LTS lines will need to upgrade before adopting this version.
  - **`changeset tag` is renamed `changeset git-tag`.** Any script or CI step invoking `changeset tag` must be updated to the new subcommand name.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.4.3 | 1.4.4 |
| @savvy-web/mcp | dependency | updated | 1.6.3 | 1.6.4 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @changesets/cli | peerDependency | updated | ^2.31.0 | ^3.0.0-next.8 | [#218][#218] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Maintenance

- The force-bundled CJS entries (`./changesets/changelog`, `./changesets/markdownlint`) now steer `jsonc-parser` — pulled in transitively by the v3 engine — to its ESM build at bundle time. Its UMD `main` entry survives rolldown's single-file CJS output with unresolvable relative `require("./impl/*")` calls, which made both entries throw `Cannot find module` at load.

### Patch Changes

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.3.11

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.4.2 | 1.4.3 |
| @savvy-web/mcp | dependency | updated | 1.6.2 | 1.6.3 |
| @commitlint/cli | peerDependency | updated | ^21.1.0 | ^21.2.0 |
| @commitlint/config-conventional | peerDependency | updated | ^21.1.0 | ^21.2.0 |
| @types/node | peerDependency | updated | ^26.0.0 | ^26.1.0 |
| commitizen | peerDependency | updated | ^4.3.0 | ^4.3.2 |
| lint-staged | peerDependency | updated | ^17.0.7 | ^17.0.8 |
| markdownlint-cli2 | peerDependency | updated | ^0.22.1 | ^0.23.0 |
| turbo | peerDependency | updated | ^2.10.0 | ^2.10.2 |

## 1.3.10

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.4.1 | 1.4.2 |
| @savvy-web/mcp | dependency | updated | 1.6.1 | 1.6.2 |

## 1.3.9

### Bug Fixes

- [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/mcp | dependency | updated | 1.6.0 | 1.6.1 |
  | @savvy-web/cli | dependency | updated | 1.4.0 | 1.4.1 |

## 1.3.8

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 1.5.0 | 1.6.0 |
| @savvy-web/cli | dependency | updated | 1.3.6 | 1.4.0 |

## 1.3.7

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.3.5 | 1.3.6 |
| @savvy-web/mcp | dependency | updated | 1.4.0 | 1.5.0 |

## 1.3.6

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 1.3.5 | 1.4.0 |

## 1.3.5

### Maintenance

- [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 1.3.4 | 1.3.5 |
  | @savvy-web/mcp | dependency | updated | 1.3.4 | 1.3.5 |

## 1.3.4

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 1.3.3 | 1.3.4 |
| @savvy-web/cli | dependency | updated | 1.3.3 | 1.3.4 |

## 1.3.3

### Bug Fixes

- [`6a6591c`](https://github.com/savvy-web/systems/commit/6a6591c6385e49ebc8ad60a5a89f66e646c756e6) Updated the shipped Biome asset (`@savvy-web/silk/biome`) to Biome 2.5.1 and broadened the `noUndeclaredDependencies` suppression override.

* `$schema` URL updated to `https://biomejs.dev/schemas/2.5.1/schema.json`
* `noUndeclaredDependencies` is now suppressed for `**/__test__/**`, `**/*.spec.*`, `**/vitest.config.*`, `**/vitest.setup.*`, `**/vitest.env.*`, `**/vitest.globals.*`, and `**/vite.config.*` — previously only `**/*.test.ts` was covered
* the optional `@biomejs/biome` peer dependency range loosened from an exact `2.4.16` pin to `~2.5.0` (the 2.5 minor line)

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 1.3.2 | 1.3.3 |
  | @savvy-web/mcp | dependency | updated | 1.3.2 | 1.3.3 |

## 1.3.2

### Documentation

- [`d7fd974`](https://github.com/savvy-web/systems/commit/d7fd9740ee58347e0c2c92af66edb8289016dd80) The `/silk:tsdoc` skill's guidance on locating `ae-*` and `tsdoc-*` diagnostics has been updated to reflect that `file`/`line`/`column` fields in `issues.json` are now accurate.

* The previous guidance (systems#154) advised locating diagnostics by the symbol name quoted in `text`, because location fields were suppressed as misleading. That guidance is reverted.
* The current guidance: navigate to the `file:line` reported in the diagnostic. Most entries resolve to `src/*.ts` (accurate). The exception is Effect `Data.TaggedError` / service classes whose synthesized `_base` declaration is not source-mapped by rolldown-plugin-dts — those may report a path inside `dist/prod/<id>/declarations/*.d.ts`. In that case, use the symbol name in `text` to find the matching `src/*.ts` declaration.

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 1.3.1 | 1.3.2 |
  | @savvy-web/mcp | dependency | updated | 1.3.1 | 1.3.2 |

## 1.3.1

### Documentation

- [`ce970c8`](https://github.com/savvy-web/systems/commit/ce970c8cf390533aab259294c5be38629964ac23) ### `/silk:tsdoc` and `tsdoctor` — sharper authoring guidance

Three clarifications to the `silk:tsdoc` skill and the `tsdoctor` agent, from a large real-world sweep:

- `@packageDocumentation` belongs only in entry-point files — one per `exports` entry, not one per package (a multi-entry package tags each entry module) — never on a non-entry leaf file.
- Every export carrying `@public` or `@internal` needs a one-line summary, not just the release tag. A bare tag that clears `ae-missing-release-tag` but leaves the block empty is only half the fix.
- Barrel files that re-export values or types are flagged as a documentation footgun. Refactoring the export structure is outside the agent's mechanical loop, so the agent now flags a barrel re-export and asks before changing it rather than reshaping exports unilaterally.

### `/silk:tsdoc` — locate diagnostics by symbol name

The `silk:tsdoc` skill now tells you to find an `ae-*` / `tsdoc-*` diagnostic's declaration by the symbol name quoted in the entry's `text`, not by `file`/`line`. Those location fields are no longer emitted for API Extractor diagnostics because the bundled-`.d.ts` analysis reported them against the wrong file. This matches the paired change in `@savvy-web/tsdown-plugins` that drops the misleading location.

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.3.0 | 1.3.1 |
| @savvy-web/mcp | dependency | updated | 1.3.0 | 1.3.1 |

## 1.3.0

### Features

- [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) ### `/silk:tsdoc` skill

A new `silk:tsdoc` skill is available in the Silk plugin. It provides toolchain-accurate TSDoc authoring guidance tuned for the `@savvy-web/bundler` API Extractor pass, which fails CI on forgotten exports and undefined tags.

The skill covers:

- A quick-fix map for the common `ae-*` and `tsdoc-*` diagnostic codes (`ae-missing-release-tag`, `ae-forgotten-export`, `ae-incompatible-release-tags`, `ae-unresolved-link`, `tsdoc-undefined-tag`, and others)
- Release-tag policy: when to choose `@public`, `@internal`, `@beta`, or `@alpha`
- How to register a custom TSDoc tag in `savvy.build.ts`
- The complete set of supported standard tags
- Common JSDoc habits that break the TSDoc parser (brace-typed `@param`, missing hyphens, `@class`/`@module`)
- Documentation-depth guidance: structuring `@remarks`, `@example`, and prose for the RSPress API Extractor renderer so generated docs display rich narrative sections rather than bare type signatures

The skill auto-loads when editing `savvy.build.ts` and is user-invokable on demand via `/silk:tsdoc`.

### Dependencies

- | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @effect/platform | dependency | updated | ^0.96.1 | ^0.96.2 |  |
  | effect | dependency | updated | ^3.21.3 | ^3.21.4 |  |
  | @typescript/native-preview | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |  |
  | @types/node | devDependency | updated | ^25.9.0 | ^26.0.0 |  |
  | Dependency | Type | Action | From | To |  |
  | -------------- | ---------- | ------- | ----- | ----- |  |
  | @savvy-web/mcp | dependency | updated | 1.2.0 | 1.3.0 |  |
  | @savvy-web/cli | dependency | updated | 1.2.0 | 1.3.0 |  |

### `tsdoctor` agent

A new `tsdoctor` agent drives TSDoc diagnostics to zero end-to-end. It builds the target package (prod), reads `dist/prod/issues.json`, applies the `tsdoc` skill's fix recipes for every `ae-*` and `tsdoc-*` diagnostic, and rebuilds to confirm the artifact is clean. The agent does not add `suppressWarnings` entries — suppression is a human escape hatch. Invoke via `/tsdoctor` or by asking Claude to fix TSDoc issues for a package.

### Issues monitor

A new background monitor (`watch-issues`) surfaces `ae-*` and `tsdoc-*` diagnostics from `dist/*/issues.json` as Claude Code notifications during development. The monitor watches for `issues.json` changes written by the build and reports new warnings or errors without requiring a manual log scan.

## 1.2.0

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 1.1.2 | 1.2.0 |
| @savvy-web/cli | dependency | updated | 1.1.2 | 1.2.0 |

## 1.1.2

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.1.1 | 1.1.2 |
| @savvy-web/mcp | dependency | updated | 1.1.1 | 1.1.2 |

## 1.1.1

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.1.0 | 1.1.1 |
| @savvy-web/mcp | dependency | updated | 1.1.0 | 1.1.1 |

## 1.1.0

### Features

- [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `savvy lint init` and `savvy commit init` manage a post-commit hook (#122)

`savvy lint init` and `savvy commit init` now create and manage a `.husky/post-commit` hook that restores the executable bit on shell scripts after each commit. This mirrors the existing post-checkout and post-merge hygiene hooks, closing the gap where a commit could strip the execute permission from the very hooks that `post-checkout`/`post-merge` maintained.

- [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) ### Shipped TSConfig presets

`@savvy-web/silk` now ships two ready-to-use TSConfig presets under the `tsconfig/` export namespace, for projects that follow Silk conventions but do not depend on a Silk build tool at the relevant package:

- `@savvy-web/silk/tsconfig/node/root.json` — a monorepo root that runs under Node.js (`module: nodenext`, `target: es2025`, composite/declaration, `types: ["node"]`). Use it where `@savvy-web/bundler` is not a dependency of the root `package.json`.
- `@savvy-web/silk/tsconfig/rspress/website.json` — a standard RSPress site, aligned with RSPress's official website config (`module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit`, `isolatedModules`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noUnusedLocals`/`noUnusedParameters`, `mdx.checkMdx`, `lib: ["dom", "es2023"]`, react/react-dom types), targeting the browser rather than Node.

Reference either from a package's `tsconfig.json` via `"extends": "@savvy-web/silk/tsconfig/node/root.json"`.

### Bug Fixes

- [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash the `savvy` CLI or `savvy-mcp` server at load (#126)

`@savvy-web/cli` and `@savvy-web/mcp` now declare `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies. The `@effect/platform-node` root barrel eagerly links these clustering submodules at import time. Without these declarations, a fresh install that did not already provide them indirectly would fail with `ERR_MODULE_NOT_FOUND` before any command could run.

### Build System

- [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) The shipped Biome config (`@savvy-web/silk/biome`) now:

* Excludes `.claude/worktrees` from linting, so nested Claude Code worktrees that carry their own root config no longer trigger Biome's nested-root abort and break the pre-commit hook. Every consumer inherits this automatically rather than re-discovering it.
* Broadens the test-fixtures exclusion to `**/__test__/**/fixtures` (any nesting depth).
* Formats shipped TSConfig presets under `**/public/tsconfig/**/*.json` with the standard tsconfig key-sorting rules.

### Changeset push-guard no longer blocks tag and delete pushes (\#124)

The `changeset-push-guard` plugin hook no longer triggers on `git push --tags`, `git push --delete`/`-d`, or refspec-deletion pushes (`git push origin :branch`). These push forms cannot introduce unreleased commits, so blocking them on an unreleased-changeset check was a false positive.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 1.0.0 | 1.1.0 |
| @savvy-web/mcp | dependency | updated | 1.0.0 | 1.1.0 |

## 1.0.0

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 0.5.0 | 1.0.0 |
| @savvy-web/cli | dependency | updated | 0.5.0 | 1.0.0 |

## 0.5.0

### Features

- [`111241c`](https://github.com/savvy-web/systems/commit/111241cefd5d91163871c02d2372a2dfae7cac5c) The silk plugin now integrates Biome two ways. A Biome language server (`biome lsp-proxy`, launched through a global-first resolver that falls back to a project-local install) surfaces lint and format diagnostics automatically after edits across JavaScript, TypeScript, JSON, CSS, and GraphQL files. A new `PreToolUse` hook nudges toward the `biome_check` MCP tool whenever Biome is run via Bash — directly or through a package.json script — without ever blocking the command, so Bash stays a valid escape hatch. A `<biome_capability>` SessionStart block documents the division of labor between the LSP (automatic, read-only), the `biome_check` tool (on-demand, structured, can fix), and Bash.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 0.4.2 | 0.5.0 |
| @savvy-web/cli | dependency | updated | 0.4.2 | 0.5.0 |

## 0.4.2

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 0.4.1 | 0.4.2 |
| @savvy-web/cli | dependency | updated | 0.4.1 | 0.4.2 |

## 0.4.1

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 0.4.0 | 0.4.1 |
| @savvy-web/mcp | dependency | updated | 0.4.0 | 0.4.1 |

## 0.4.0

### Bug Fixes

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) The `./changesets/markdownlint` entry stays dual-format CJS (markdownlint-cli2 `require()`s it) via a per-entry format override.

### Build System

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/cli` and `@savvy-web/mcp` (fixed release group).

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 0.3.1 | 0.4.0 |
| @savvy-web/mcp | dependency | updated | 0.3.1 | 0.4.0 |

## 0.3.1

### Other

- [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 0.3.0 | 0.3.1 |
  | @savvy-web/mcp | dependency | updated | 0.3.0 | 0.3.1 |

## 0.3.0

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/cli | dependency | updated | 0.2.1 | 0.3.0 |
| @savvy-web/mcp | dependency | updated | 0.2.1 | 0.3.0 |

## 0.2.1

### Bug Fixes

- [`29ea5bb`](https://github.com/savvy-web/systems/commit/29ea5bb049ba469e5d44282fd1ae8fbf78b78dba) Fixed a portability error in the config-integration shims. Consumer config files that infer a factory's return type — `export default CommitlintConfig.silk()` from `@savvy-web/silk/commitlint`, or `Preset.silk()` / `Preset.minimal()` / `Preset.standard()` / `Preset.get(...)` from `@savvy-web/silk/lint` — failed to type-check under pnpm with TS2883, because the inferred type's canonical home was `@savvy-web/silk-effects`, a transitive dependency the consumer could not name. The shims now wrap these factories in silk-local facades with silk-owned return types, so consumer declaration emit is portable and no type annotation is needed. The public API is unchanged and consumers require no code changes.

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/cli | dependency | updated | 0.2.0 | 0.2.1 |
  | @savvy-web/mcp | dependency | updated | 0.2.0 | 0.2.1 |

### Documentation

- [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

### Features

- [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

- `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
- `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
- `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
- `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
- `@savvy-web/silk/commitlint` — commitlint config factory
- `@savvy-web/silk/commitlint/static` — static commitlint config
- `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
- `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
- `@savvy-web/silk/lint` — lint-staged configuration factory
- `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 0.1.0 | 0.2.0 |
| @savvy-web/cli | dependency | updated | 0.1.0 | 0.2.0 |

## 0.1.0

### Features

- [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### Single install target for Silk Suite dev tooling

`@savvy-web/silk` is the unified install package for the Silk Suite. It replaces the previous pattern of installing `@savvy-web/changesets`, `@savvy-web/commitlint`, and `@savvy-web/lint-staged` separately. Config-integration shims re-export the relevant `@savvy-web/silk-effects` logic at drop-in entry points compatible with each toolchain's require/import resolution.

Exported entry points:

- `@savvy-web/silk/changesets` — changeset formatter (default export: `{ getReleaseLine, getDependencyReleaseLine }`)
- `@savvy-web/silk/changesets/changelog` — changelog formatter re-export
- `@savvy-web/silk/changesets/markdownlint` — markdownlint custom rules for changeset validation
- `@savvy-web/silk/changesets/remark` — remark plugins for changelog post-processing
- `@savvy-web/silk/commitlint` — commitlint config factory
- `@savvy-web/silk/commitlint/static` — static commitlint config
- `@savvy-web/silk/commitlint/prompt` — commitizen prompt configuration
- `@savvy-web/silk/commitlint/formatter` — custom commitlint output formatter
- `@savvy-web/silk/lint` — lint-staged configuration factory
- `@savvy-web/silk/biome` — Biome preset JSON asset

```typescript
// commitlint.config.ts
export { default } from "@savvy-web/silk/commitlint";

// .markdownlint-cli2.jsonc
{ "customRules": ["@savvy-web/silk/changesets/markdownlint"] }

// .changeset/config.json
{ "changelog": "@savvy-web/silk/changesets/changelog" }
```

### MCP server integration

The bundled `silk@savvy-web-systems` Claude Code plugin now ships an MCP server entry point. A `start-mcp.sh` launcher wires the plugin into Claude Code's MCP layer, and an `mcp-orientation` session-start hook surfaces relevant context at the start of each session.

### Catalog-first MCP orientation and docs-search skill

The bundled silk Claude Code plugin now steers sessions toward the shared savvy MCP corpus more firmly. The SessionStart orientation hook is strengthened so the agent searches `silk://catalog` and the `silk_docs_search` tool before guessing, reading source, or running grep, and reserves shell workspace commands for git state and cases the `workspace_info` tool does not cover.

A new on-demand docs-search skill documents how to query the corpus well: start at `silk://catalog`, search by concept rather than filename, scope by tier, and read ranked results instead of enumerating the whole corpus. The agent loads it when it needs query technique without paying for it in every session's base context.

### Unified SessionStart hooks and a dogfood-feedback prompt

The plugin's SessionStart hooks are consolidated into two — an always-on `orientation.sh` that persists the session environment and emits the combined orientation, and a `startup-only.sh` that runs the per-session `savvy commit` setup and startup orientation. The session environment variables and the push-guard bypass now use the `SILK_` namespace; set `SILK_SKIP_PUSH_CHECK=1` on a `git push` to bypass the changeset push guard.

Because this is an early release, the orientation now asks the agent to note any rough edges it hits — wrong, unhelpful, or confusing results from a skill, hook, the `savvy` CLI, or an agent — and to surface them at the end of a session. With your explicit agreement, the agent can open an issue in `savvy-web/systems`; it will never file one on its own.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/mcp | dependency | updated | 0.0.0 | 0.1.0 |
| @savvy-web/cli | dependency | updated | 0.0.0 | 0.1.0 |
