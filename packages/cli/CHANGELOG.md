# @savvy-web/cli

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
