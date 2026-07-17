# @savvy-web/cli

## 2.0.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 4.0.0 | 4.0.1 |

* | Dependency           | Type       | Action  | From   | To     |                                                          |
  | -------------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | @effected/git        | dependency | updated | ^0.3.0 | ^0.4.0 |                                                          |
  | @effected/workspaces | dependency | updated | ^0.3.0 | ^0.3.1 |                                                          |
  | @effected/yaml       | dependency | updated | ^0.2.0 | ^0.3.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.0.0

### Breaking Changes

* The `savvy` binary is rebuilt on the in-core `effect/unstable/cli` framework; the dead `@effect/cli` dependency and eight unused `@effect/*` pins are removed.
* The `repos note` grammar moves the repo name after the operation (`savvy repos note add <name> <text>`), since v4's CLI framework has no parent-positional sharing.

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.3.1 | 4.0.0 |

* | Dependency            | Type       | Action  | From     | To             |                                                                       |
  | --------------------- | ---------- | ------- | -------- | -------------- | --------------------------------------------------------------------- |
  | @effect/cli           | dependency | removed | ^0.75.2  | —              |                                                                       |
  | @effect/cluster       | dependency | removed | ^0.59.0  | —              |                                                                       |
  | @effect/experimental  | dependency | removed | ^0.60.0  | —              |                                                                       |
  | @effect/platform      | dependency | removed | ^0.96.2  | —              |                                                                       |
  | @effect/printer       | dependency | removed | ^0.49.0  | —              |                                                                       |
  | @effect/printer-ansi  | dependency | removed | ^0.49.0  | —              |                                                                       |
  | @effect/rpc           | dependency | removed | ^0.75.1  | —              |                                                                       |
  | @effect/sql           | dependency | removed | ^0.51.1  | —              |                                                                       |
  | @effect/typeclass     | dependency | removed | ^0.40.0  | —              |                                                                       |
  | @effect/workflow      | dependency | removed | ^0.18.2  | —              |                                                                       |
  | jsonc-effect          | dependency | removed | ^0.3.1   | —              |                                                                       |
  | workspaces-effect     | dependency | removed | ^2.1.0   | —              |                                                                       |
  | yaml                  | dependency | removed | ^2.9.0   | —              |                                                                       |
  | @effect/platform-node | dependency | updated | ^0.107.0 | catalog:effect |                                                                       |
  | effect                | dependency | updated | ^3.21.4  | catalog:effect |                                                                       |
  | @effected/git         | dependency | added   | —        | ^0.3.0         |                                                                       |
  | @effected/jsonc       | dependency | added   | —        | ^0.2.0         |                                                                       |
  | @effected/workspaces  | dependency | added   | —        | ^0.3.0         |                                                                       |
  | @effected/yaml        | dependency | added   | —        | ^0.2.0         | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

* Git introspection in the commit and changeset hooks adopts `@effected/git` (`repoRoot`, `commitInfo`, `remoteUrl`). [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 1.6.1

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.3.0 | 3.3.1 |

* | Dependency        | Type       | Action  | From   | To     |                                                                              |
  | ----------------- | ---------- | ------- | ------ | ------ | ---------------------------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 1.6.0

### Features

* ### `savvy repos` command group

  Adds a `savvy repos` command group for managing vendored reference repos under `.repos/`:

  ```bash
  savvy repos status [--json]
  savvy repos sync
  savvy repos pin <name> <ref>
  savvy repos add <url> --ref <ref> --purpose <text> [--name <name>] [--sparse <path>...]
  savvy repos note <name> add <text>
  savvy repos note <name> remove <id>
  savvy repos note <name> promote <id> --into layout|startHere
  ```

  * `status` prints a drift report (gitlink vs. manifest ref, dirty and unsynced submodules); `--json` emits the structured report.
  * `sync` reconciles the working tree with the manifest, self-healing stale submodule locks.
  * `pin` and `add` stage their changes (manifest, gitlink, `.gitmodules`) and print a ready-made commit message rather than committing on the caller's behalf — review and commit is a separate, deliberate step.
  * `add` requires `--purpose`, documenting why the repo is vendored.

  A missing `.repos/config.json` is treated as the common, friendly case — a plain message (or an empty JSON report) and exit code 0. A manifest that exists but is corrupt or unreadable is a real failure and exits 1. [#292][#292]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.5 | 3.3.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

## 1.5.10

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.4 | 3.2.5 |

## 1.5.9

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.3 | 3.2.4 |

## 1.5.8

### Bug Fixes

* `savvy commit hook post-commit-verify` no longer reports a signing problem when a signature merely cannot be verified. Git's `%G?` reports `E` for "signature cannot be checked (e.g. missing key)" — the commit is signed, but the checking process cannot reach the keyring or gpg-agent, which is routine inside a hook subprocess. The hook treated `E` as a defect alongside `B` (bad), `R` (revoked), and `X`/`Y` (expired), and told the user to investigate their signing setup and amend. In practice it fired on correctly signed commits: the same commit that reports `E` from the hook reports `G` from an interactive shell. Failure to verify is not evidence of a bad signature, and amending would not have fixed anything. Genuinely defective signatures are still reported, and an unsigned commit under `commit.gpgsign=true` still is too. [#276][#276]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#276]: https://github.com/savvy-web/systems/pull/276

## 1.5.7

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.2 | 3.2.3 |

## 1.5.6

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.1 | 3.2.2 |

## 1.5.5

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.2.0 | 3.2.1 |

* | Dependency        | Type       | Action  | From   | To     |                                                          |
  | ----------------- | ---------- | ------- | ------ | ------ | -------------------------------------------------------- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.5.4

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.1.0 | 3.2.0 |

## 1.5.3

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.3 | 3.1.0 |

## 1.5.2

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.2 | 3.0.3 |

* | Dependency   | Type       | Action  | From   | To     |                                                                       |
  | ------------ | ---------- | ------- | ------ | ------ | --------------------------------------------------------------------- |
  | jsonc-effect | dependency | updated | ^0.3.0 | ^0.3.1 | [#235][#235] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#235]: https://github.com/savvy-web/systems/pull/235

## 1.5.1

### Bug Fixes

* Declared `@effect/experimental`, `@effect/workflow`, `@effect/printer`, `@effect/printer-ansi`, and `@effect/typeclass` as regular dependencies, completing the Effect peer-dependency closure. All five were required peers of already-declared packages (`@effect/sql`, `@effect/cluster`, `@effect/cli`, and the printer pair), so pnpm auto-installed them at the consumer's importer level, where a consumer depending on a different major of `effect` could bind them against an incompatible `effect` instance (#228) [#232][#232]

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

## 1.5.0

### Features

* `savvy init` now writes `@savvy-web/changelog` as the canonical `changelog` id in fresh and patched `.changeset/config.json` files. The prior `@savvy-web/silk/changesets/changelog` shim id and the pre-merge `@savvy-web/changesets/changelog` id are still accepted by `init --check`, so existing repos migrate lazily on their next `savvy init`. [#223][#223]

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 3.0.0 | 3.0.1 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#223]: https://github.com/savvy-web/systems/pull/223

## 1.4.4

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.1.0 | 3.0.0 |

### Maintenance

* `savvy init` now writes the `$schema` URL `https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json` in generated `.changeset/config.json` files (was `@changesets/config@3.1.1`), keeping generated scaffolding in sync with the v3 config schema. [#218][#218]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.4.3

### Dependencies

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.0.2 | 2.1.0 |

## 1.4.2

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 2.0.1 | 2.0.2 |

## 1.4.1

### Bug Fixes

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

* [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^2.0.0 | ^2.0.1 |
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 2.0.0 | 2.0.1 |

## 1.4.0

### Features

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) `savvy changeset deps regen`/`deps detect` now report catalog-aware dependency rows: a stable `catalog:` specifier whose resolved version changed shows the concrete `from`/`to` versions, and a package that only adopted a `catalog:` specifier without a version change no longer produces noise.
* Dependency-changeset gating now follows the `publishable OR privatePackages.version` (minus ignored) rule, matching the rest of the changeset tooling.
* Both commands now also handle `GitReadError` alongside `GitError`, so snapshot-read failures exit with a clear error instead of an unhandled rejection.

### Refactoring

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) Internal layer composition for `deps regen`/`deps detect` moved from `CatalogResolverLive`/`WorkspaceSnapshotReaderLive` to `workspaces-effect`'s `PointInTimeWorkspaceLive`.

### Dependencies

* [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) | Dependency | Type | Action | From | To |
  \| ----------------- | ---------- | ------- | ------ | ------ |
  \| workspaces-effect | dependency | updated | ^1.2.0 | ^2.0.0 |
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.6.0 | 2.0.0 |

## 1.3.6

### Bug Fixes

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) `savvy changeset deps regen`/`deps detect` now route through silk-effects' `Changesets.DepsRegen`, so regenerated dependency changesets resolve `catalog:`/`workspace:` specifiers to concrete versions (#199) and omit `devDependency` rows that never reach a consumer (#151). The emitted `## Dependencies` tables are now CSH005-valid and pass pre-commit, instead of passing the CLI checks but failing at commit time.

### Dependencies

* [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) | Dependency | Type | Action | From | To |
  \| ------------ | ---------- | ------- | ------ | ------ |
  \| jsonc-effect | dependency | updated | ^0.2.1 | ^0.3.0 |
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.5.2 | 1.6.0 |

## 1.3.5

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 1.5.1 | 1.5.2 |

## 1.3.4

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.1 |

## 1.3.3

### Bug Fixes

* [`6a6591c`](https://github.com/savvy-web/systems/commit/6a6591c6385e49ebc8ad60a5a89f66e646c756e6) Fixed `savvy init` and `savvy check` not writing or validating Biome `$schema` URLs.

The commands read a `BIOME_VERSION` constant (now `2.5.1`) from a dedicated internal module. Previously they read `__BIOME_PEER_VERSION__`, an env var that was never populated at runtime, so the schema-sync path was silently inert. Running `savvy init` now writes the correct `$schema` URL into consumer `biome.json`/`biome.jsonc` files, and `savvy check` now reports when those URLs are stale.

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

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @effect/platform                                                                                  | dependency    | updated | ^0.96.1               | ^0.96.2               |    |
  | effect                                                                                            | dependency    | updated | ^3.21.3               | ^3.21.4               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |
  | Dependency                                                                                        | Type          | Action  | From                  | To                    |    |
  | -----------------------                                                                           | ----------    | ------- | -----                 | -----                 |    |
  | @savvy-web/silk-effects                                                                           | dependency    | updated | 1.4.0                 | 1.5.0                 |    |

## 1.2.0

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.3.1 | 1.4.0 |

## 1.1.2

### Bug Fixes

* [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### commit-quality reminder no longer fires on every prompt

The silk plugin injected the commit-create skill reminder on every `UserPromptSubmit` whose text mentioned a commit-adjacent verb (`commit`, `ship`, `finalize`, and the like). Because the trigger matched any mention — "look at the last commit", "revert that commit" — rather than an intent to create one, the block appeared on analysis, review, and status turns throughout a session and drowned out the turns where a commit was actually being composed.

The blanket `UserPromptSubmit` injection is removed. The commit-create directive is still delivered once per session by the SessionStart orientation block, and the message validation still runs as a just-in-time PreToolUse check on the actual `git commit` and `gh pr create` commands. The now-unused `savvy commit hook user-prompt-submit` subcommand and the `UserPromptSubmitEnvelope` and `userPromptSubmitContext` hook helpers are removed along with it.

* [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### markdownlint no longer lints files under `.git/`

The default markdownlint-cli2 config globs `**/*.{md,mdx}`, which swept ad-hoc session files under `.git/` (for example `.git/sdd/*.md`) and flagged them in the pre-commit hook. `**/.git` is now part of the default `ignores` list, so those files are excluded.

`savvy init` also reconciles `ignores` on an existing config now. On the silk preset without `--force` it previously synced only `$schema` and compared `config`, never touching `ignores`, so existing repos could not pick up new default excludes on a plain re-init. It now non-destructively appends any template ignores a repo is missing while preserving user-added entries — these are additive safety-excludes that cannot change a lint verdict, so they apply automatically, unlike `config` rules which stay warn-only.

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

### Breaking Changes

* [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) ### Removed changeset inspection subcommands

The following `savvy changeset` subcommands have been removed. They duplicated functionality now provided directly by the `changeset_inspect` MCP tool (modes `branch`, `config`, and `classify`) and the new `changeset_validate` MCP tool:

* `savvy changeset analyze-branch`
* `savvy changeset config show`
* `savvy changeset classify`
* `savvy changeset release-surface`

**Migration:** Use the `changeset_inspect` MCP tool instead. The `branch` mode replaces `analyze-branch`, the `config` mode replaces `config show` and `release-surface`, and the `classify` mode replaces `classify`.

The `savvy changeset config` group now exposes only `savvy changeset config validate`.

### Features

* [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) Registered the `savvy changeset check` subcommand, which was previously implemented but not wired into the command tree.

### Bug Fixes

* [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) `savvy changeset lint --json` and `savvy changeset deps detect --json` / `deps regen --json` now emit clean JSON to stdout without Effect.log timestamp prefixes.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.1.0 | 1.1.0 |

## 0.5.0

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 1.0.1 | 1.1.0 |

## 0.4.2

## 0.4.1

### Dependencies

* | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type    | Action | From   | To |
  | :------------------------------------------------------------------------------------------------ | :--------- | :------ | :----- | :----- | -- |
  | workspaces-effect                                                                                 | dependency | updated | ^1.1.0 | ^1.2.0 |    |
  | Dependency                                                                                        | Type       | Action  | From   | To     |    |
  | -----------------------                                                                           | ---------- | ------- | -----  | -----  |    |
  | @savvy-web/silk-effects                                                                           | dependency | updated | 1.0.0  | 1.0.1  |    |

## 0.4.0

### Build System

* [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/silk` and `@savvy-web/mcp` (fixed release group).

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

### Breaking Changes

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) The per-tool `init` and `check` subcommands were removed from the `changeset`, `commit`, and `lint` groups. `savvy init` and `savvy check` are now the only setup and validation entry points — run those instead of `savvy changeset init`, `savvy commit check`, `savvy lint init`, and the like. The groups keep their other subcommands (for example `savvy changeset version` and `savvy lint fmt`).

### Features

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) Added `savvy clean`, which removes build and cache artifacts across an entire silk workspace. Run from anywhere inside the workspace, it globs the configured patterns (default `dist`, `.turbo`, `coverage`, `node_modules`, `.rslib`) at the top level of every workspace package — leaves first, the repo root last — and deletes the matches. Patterns are configurable with `--globs`, and `--dry-run` previews what would be removed without touching disk.

- `clean` added to the root command tree alongside `init` and `check`
- top-level glob matching by default, with `**` opt-in that skips descent into `node_modules` and `.git`
- path-containment safety so a match can never escape its workspace root

### Bug Fixes

* [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) `savvy changeset init` now writes the `@savvy-web/silk/changesets/changelog` and `@savvy-web/silk/changesets/markdownlint` shim paths into a consumer's `.changeset/config.json` and markdownlint config, matching what `@savvy-web/silk` actually installs, instead of the pre-merge standalone `@savvy-web/changesets` specifiers. `savvy check` accepts both the silk and legacy paths, and `init` migrates a legacy markdownlint entry rather than duplicating it.

## 0.2.1

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

## 0.1.0

### Features

* [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### savvy binary — unified Silk Suite CLI

`@savvy-web/cli` provides the `savvy` binary, replacing the three standalone bins (`savvy-changesets`, `savvy-commit`, and `savvy-lint`) with a single entry point.

Top-level commands:

* `savvy init` — set up Silk Suite tooling in a new or existing workspace
* `savvy check` — run all configured checks (changeset, commit, lint) in one pass

Subcommand groups:

**`savvy changeset`**

* `analyze-branch` — diff the current branch against the base and classify changed files by package
* `check` — validate all pending changeset files against the style rules
* `classify` — classify a single file path to its owning package
* `config show` / `config validate` — inspect and validate `.changeset/config.json`
* `deps detect` / `deps regen` — detect dependency changes and regenerate dependency changesets
* `init` — scaffold a `.changeset/` directory with Silk conventions
* `lint` — lint a single changeset file
* `release-surface` — print the computed release surface for a package
* `transform` — run the changelog post-processing pipeline on a markdown input
* `validate-file` — validate a changeset file path and frontmatter
* `version` — print the savvy changeset schema version

**`savvy commit`**

* `check` — validate a commit message against the Silk commitlint rules
* `hook` — run the pre-commit-message, post-commit-verify, session-start, and user-prompt-submit Claude Code hooks
* `init` — install husky hooks and Claude Code hook files

**`savvy lint`**

* `check` — run Biome, markdownlint, and other configured linters
* `init` — scaffold lint configuration files

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.5.0 | 0.6.0 |
