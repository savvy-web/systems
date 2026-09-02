# @savvy-web/cli

## 2.9.0

### Features

#### Package-manager toolchain drift warning in hooks

- `savvy init` now writes a `SAVVY-TOOLCHAIN` section into `.husky/post-checkout` and `.husky/post-merge`, warning when the local package manager's version has drifted off the repo's `devEngines.packageManager` pin. It is not added to `post-commit`, which fires on every commit and would be noisier than the drift warrants.

- `savvy check` reports the section's presence and freshness for both `lint` and `commit` checks, prompting a re-run of `savvy init` when the section is missing or outdated.

### Build System

- Bump the pinned Biome version `savvy init` / `savvy check` sync into consumer `biome.json` `$schema` URLs to 2.5.11 [#589][#589]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 7.2.0 | 7.3.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#589]: https://github.com/savvy-web/systems/pull/589

## 2.8.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 7.1.4 | 7.2.0 |

## 2.8.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/jsonc | dependency | updated | ^0.8.0 | ^0.8.1 |
| @savvy-web/silk-effects | dependency | updated | 7.1.3 | 7.1.4 |

[#572][#572]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#572]: https://github.com/savvy-web/systems/pull/572

## 2.8.0

### Features

- Bumpe biome schemas to 2.4.10

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 2.7.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | dependency | updated | ^0.18.2 | ^0.18.3 |
| @savvy-web/silk-effects | dependency | updated | 7.1.2 | 7.1.3 |

[#565][#565]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#565]: https://github.com/savvy-web/systems/pull/565

## 2.7.7

### Bug Fixes

- `savvy init` now syncs the biome `$schema` URL in every workspace package, not just the workspace root. A monorepo where a leaf package carries its own `biome.json` or `biome.jsonc` previously left those files pinned to whatever Biome version they were written against, while the root config was updated.

- Workspace package roots are enumerated with `@effected/workspaces`, and each one carrying a biome config is synced in the same pass

- A repo with no workspace root (a plain single-package project) is unaffected: the current directory is still scanned exactly as before

- A config that cannot be read or parsed is now reported and skipped rather than aborting the remaining packages [#556][#556]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 7.1.2 | 7.1.2 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#556]: https://github.com/savvy-web/systems/pull/556

## 2.7.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | dependency | updated | ^0.18.1 | ^0.18.2 |
| @savvy-web/silk-effects | dependency | updated | 7.1.2 | 7.1.2 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 2.7.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/jsonc | dependency | updated | ^0.7.0 | ^0.8.0 |
| @effected/yaml | dependency | updated | ^0.11.0 | ^0.12.0 |
| @savvy-web/silk-effects | dependency | updated | 7.1.1 | 7.1.2 |

[#552][#552]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#552]: https://github.com/savvy-web/systems/pull/552

## 2.7.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/git | dependency | updated | ^0.9.0 | ^0.10.0 |
| @effected/workspaces | dependency | updated | ^0.18.0 | ^0.18.1 |
| @savvy-web/silk-effects | dependency | updated | 7.1.0 | 7.1.1 |

[#550][#550]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#550]: https://github.com/savvy-web/systems/pull/550

## 2.7.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 7.0.1 | 7.1.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.17.2 | ^0.18.0 | [#547][#547] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#547]: https://github.com/savvy-web/systems/pull/547

## 2.7.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 7.0.0 | 7.0.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.17.1 | ^0.17.2 |  |
  | @effected/yaml | dependency | updated | ^0.10.0 | ^0.11.0 | [#542][#542] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#542]: https://github.com/savvy-web/systems/pull/542

## 2.7.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.5 | 7.0.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.17.0 | ^0.17.1 | [#537][#537] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#537]: https://github.com/savvy-web/systems/pull/537

## 2.7.0

### Maintenance

- `BIOME_VERSION` moves to `2.5.9`, the release the suite now pins. `savvy init` and `savvy check` write and validate consumer `biome.json`/`biome.jsonc` `$schema` URLs against it, so both commands now carry repos onto 2.5.9 — which is also what the shared `silk.jsonc` preset requires. [#534][#534]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#534]: https://github.com/savvy-web/systems/pull/534

## 2.6.9

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.4 | 6.0.5 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.16.0 | ^0.17.0 | [#532][#532] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#532]: https://github.com/savvy-web/systems/pull/532

## 2.6.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.3 | 6.0.4 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.15.1 | ^0.16.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.6.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.2 | 6.0.3 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.15.0 | ^0.15.1 | [#525][#525] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#525]: https://github.com/savvy-web/systems/pull/525

## 2.6.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.1 | 6.0.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.14.2 | ^0.15.0 | [#522][#522] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#522]: https://github.com/savvy-web/systems/pull/522

## 2.6.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 6.0.0 | 6.0.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.14.1 | ^0.14.2 | [#513][#513] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#513]: https://github.com/savvy-web/systems/pull/513

## 2.6.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.9.3 | 6.0.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.14.0 | ^0.14.1 | [#511][#511] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#511]: https://github.com/savvy-web/systems/pull/511

## 2.6.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.9.2 | 5.9.3 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/templates | dependency | updated | ^0.3.0 | ^0.4.0 | [#509][#509] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#509]: https://github.com/savvy-web/systems/pull/509

## 2.6.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.9.1 | 5.9.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.107 | 4.0.0-rc.109 |  |
  | @effected/commands | dependency | updated | ^0.4.0 | ^0.5.0 |  |
  | @effected/git | dependency | updated | ^0.8.0 | ^0.9.0 |  |
  | @effected/jsonc | dependency | updated | ^0.6.0 | ^0.7.0 |  |
  | @effected/templates | dependency | updated | ^0.2.0 | ^0.3.0 |  |
  | @effected/workspaces | dependency | updated | ^0.13.1 | ^0.14.0 |  |
  | @effected/yaml | dependency | updated | ^0.9.0 | ^0.10.0 |  |
  | effect | dependency | updated | 4.0.0-beta.107 | 4.0.0-rc.109 | [#502][#502] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#502]: https://github.com/savvy-web/systems/pull/502

## 2.6.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.9.0 | 5.9.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.13.0 | ^0.13.1 |  |
  | @effected/yaml | dependency | updated | ^0.8.0 | ^0.9.0 | [#498][#498] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#498]: https://github.com/savvy-web/systems/pull/498

## 2.6.0

### Features

- ### savvy repos deregister
  New `savvy repos deregister <section>` subcommand clearing a stale `submodule.<section>` registration from the local git config — the orphan case `savvy repos status --drift` reports, whose stated remedy previously required a raw `git config --remove-section`. Every failure is real (exit 1): a section still backing a live manifest entry is refused, and an unregistered section fails typed as nothing-to-deregister. Nothing is staged afterwards, since the local config is unversioned. [#494][#494]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.8.1 | 5.9.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#494]: https://github.com/savvy-web/systems/pull/494

## 2.5.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.8.0 | 5.8.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.7.0 | ^0.8.0 |  |
  | @effected/workspaces | dependency | updated | ^0.12.0 | ^0.13.0 | [#490][#490] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#490]: https://github.com/savvy-web/systems/pull/490

## 2.5.4

### Bug Fixes

- `savvy lint check` now probes `tsc` before `tsgo` when reporting TypeScript availability, matching the lint-staged handler's tsc-first compiler preference [#477][#477]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.7.2 | 5.8.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#477]: https://github.com/savvy-web/systems/pull/477

## 2.5.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.7.1 | 5.7.2 |

### Maintenance

- `savvy changeset init` now generates `.changeset/config.json` pointing at the stable `@changesets/config@4.0.0` schema instead of the `4.0.0-next.6` prerelease [#483][#483]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#483]: https://github.com/savvy-web/systems/pull/483

## 2.5.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.7.0 | 5.7.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.11.2 | ^0.12.0 | [#475][#475] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#475]: https://github.com/savvy-web/systems/pull/475

## 2.5.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.6.0 | 5.7.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.11.1 | ^0.11.2 |  |
  | @effected/yaml | dependency | updated | ^0.7.0 | ^0.8.0 | [#467][#467] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#467]: https://github.com/savvy-web/systems/pull/467

## 2.5.0

### Breaking Changes

- `savvy repos status --json` no longer includes a `commit` field per repo. The payload already reported the gitlink as a staged/committed/checked-out triple; only the deprecated alias is gone. Read `stagedCommit` instead — a script that parsed `.repos[].commit` out of the JSON output needs to switch to `.repos[].stagedCommit`.

### Features

- `savvy repos remove` prints the removed entry's orientation block when it has one. `savvy repos add` does not restore it on its own, so a re-vendor loses it unless it is captured at removal time. [#464][#464]

### Bug Fixes

- `savvy repos restore` reports any repo whose worktree is still dirty after the reset and exits 1, rather than reporting a reset that achieved nothing as success.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.5.2 | 5.6.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#464]: https://github.com/savvy-web/systems/pull/464

## 2.4.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.5.1 | 5.5.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.11.0 | ^0.11.1 | [#453][#453] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#453]: https://github.com/savvy-web/systems/pull/453

## 2.4.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.5.0 | 5.5.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 |  |
  | @effected/commands | dependency | updated | ^0.3.1 | ^0.4.0 |  |
  | @effected/git | dependency | updated | ^0.6.0 | ^0.7.0 |  |
  | @effected/jsonc | dependency | updated | ^0.5.2 | ^0.6.0 |  |
  | @effected/templates | dependency | updated | ^0.1.1 | ^0.2.0 |  |
  | @effected/workspaces | dependency | updated | ^0.10.2 | ^0.11.0 |  |
  | @effected/yaml | dependency | updated | ^0.6.1 | ^0.7.0 |  |
  | effect | dependency | updated | 4.0.0-beta.101 | 4.0.0-beta.107 | [#449][#449] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#449]: https://github.com/savvy-web/systems/pull/449

## 2.4.0

### Features

- `savvy repos` gains three new subcommands matching `ReposManager`'s new lifecycle operations:
  - `savvy repos remove <name>` — unvendors a repo (gitlink, module gitdir, `.gitmodules` section, manifest entry).
  - `savvy repos rename <old> <new>` — renames a vendored repo's worktree, git config, and manifest key.
  - `savvy repos restore [names...]` — hard-resets dirty vendored repos back to their pinned commit; called with no names, restores every dirty repo and reports which were already clean.

  `savvy repos status` gains a `--drift` flag that runs the new four-authority reconciliation (manifest, `.gitmodules`, worktree, `git submodule status`) and reports every disagreement found. [#436][#436]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.4.0 | 5.5.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.5.2 | ^0.6.0 |  |
  | @effected/workspaces | dependency | updated | ^0.10.0 | ^0.10.2 |  |
  | @savvy-web/silk-effects | dependency | updated | 5.3.1 | 5.4.0 | [#436][#436] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#436]: https://github.com/savvy-web/systems/pull/436

## 2.3.0

### Features

- Both `savvy repos` (cli) and `repos_manage` (mcp) now provide `Repos.ReposLockdown.layer` alongside `Repos.ReposConfigStore.layer` when assembling `Repos.ReposManager.layer`, matching the vendored-repos read-only permissions enforcement added to `@savvy-web/silk-effects`. The exported `reposCommand` (cli) and `reposManage` (mcp) error unions each widen to include `Repos.ReposLockdownError`, surfaced if a lock/unlock chmod fails around a `sync`/`add`/`pin` operation. [#429][#429]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.3.1 | 5.4.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.2.1 | ^0.3.1 |  |
  | @effected/workspaces | dependency | updated | ^0.9.5 | ^0.10.0 | [#429][#429] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#429]: https://github.com/savvy-web/systems/pull/429

## 2.2.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.3.0 | 5.3.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.9.4 | ^0.9.5 | [#427][#427] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#427]: https://github.com/savvy-web/systems/pull/427

## 2.2.0

### Bug Fixes

- ### Pull-request bodies are no longer held to the commit-message rules
  `savvy commit hook pre-commit-message` applied every commit-body rule to a `gh pr create`/`gh pr edit` body. The load-bearing consequence was `forbidden-content`, which denies any line opening with a markdown header or a code fence: the release PR body this ecosystem generates carries a `proposed-squash-commit` fence by design, so posting the canonical body through `gh` was blocked outright.

  `forbidden-content`, `verbosity` and `soft-wrap` now run only for `git commit` and `git commit --amend`. A PR summary is a markdown document that is supposed to be long, and a soft-wrapped bullet is ordinary markdown there.

  `plan-leakage` and `closes-trailer` still run for both. A public PR body should no more cite an internal design doc than a commit should, and both documents want their issues linked. [#420][#420]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.2.1 | 5.3.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#420]: https://github.com/savvy-web/systems/pull/420

## 2.1.16

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.2.0 | 5.2.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.2.0 | ^0.2.1 |  |
  | @effected/git | dependency | updated | ^0.5.1 | ^0.5.2 |  |
  | @effected/jsonc | dependency | updated | ^0.5.1 | ^0.5.2 |  |
  | @effected/templates | dependency | updated | ^0.1.0 | ^0.1.1 |  |
  | @effected/workspaces | dependency | updated | ^0.9.3 | ^0.9.4 |  |
  | @effected/yaml | dependency | updated | ^0.6.0 | ^0.6.1 | [#416][#416] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#416]: https://github.com/savvy-web/systems/pull/416

## 2.1.15

### Refactoring

- Internal layer composition in the CLI's root command updated to consume `@savvy-web/silk-effects`'s renamed service statics (`ChangesetConfigReader.layer`, `SilkPublishability.layer`, `BiomeSchemaSync.layer`, `ConfigDiscovery.layer`, `Changesets.ConfigInspector.layer`, `Changesets.ReleasePlanner.layer`, `Changesets.BranchAnalyzer.layer`, `Repos.ReposManager.layer`, `Repos.ReposConfigStore.layer`) in place of the removed `XLive` exports. No change to CLI commands or behavior. [#408][#408]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.1.3 | 5.2.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.9.1 | ^0.9.3 | [#400][#400] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#400]: https://github.com/savvy-web/systems/pull/400

[#408]: https://github.com/savvy-web/systems/pull/408

## 2.1.14

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.1.2 | 5.1.3 |

## 2.1.13

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.1.1 | 5.1.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/commands | dependency | updated | ^0.1.0 | ^0.2.0 |  |
  | @effected/workspaces | dependency | updated | ^0.9.0 | ^0.9.1 | [#396][#396] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#396]: https://github.com/savvy-web/systems/pull/396

## 2.1.12

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.1.0 | 5.1.1 |

## 2.1.11

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.0.1 | 5.1.0 |

## 2.1.10

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 5.0.0 | 5.0.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.5.0 | ^0.5.1 | [#385][#385] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#385]: https://github.com/savvy-web/systems/pull/385

## 2.1.9

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.6 | 5.0.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.8.0 | ^0.9.0 |  |
  | @effected/commands | dependency | added | — | ^0.1.0 |  |
  | @effected/templates | dependency | added | — | ^0.1.0 | [#382][#382] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#382]: https://github.com/savvy-web/systems/pull/382

## 2.1.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.5 | 4.2.6 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.4.2 | ^0.5.0 |  |
  | @effected/workspaces | dependency | updated | ^0.7.0 | ^0.8.0 |  |
  | @effected/yaml | dependency | updated | ^0.5.1 | ^0.6.0 | [#375][#375] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#375]: https://github.com/savvy-web/systems/pull/375

## 2.1.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.4 | 4.2.5 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.6.2 | ^0.7.0 | [#369][#369] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#369]: https://github.com/savvy-web/systems/pull/369

## 2.1.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.3 | 4.2.4 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 |  |
  | @effected/git | dependency | updated | ^0.4.1 | ^0.4.2 |  |
  | @effected/jsonc | dependency | updated | ^0.5.0 | ^0.5.1 |  |
  | @effected/workspaces | dependency | updated | ^0.6.1 | ^0.6.2 |  |
  | @effected/yaml | dependency | updated | ^0.5.0 | ^0.5.1 |  |
  | effect | dependency | updated | 4.0.0-beta.99 | 4.0.0-beta.101 | [#364][#364] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#364]: https://github.com/savvy-web/systems/pull/364

## 2.1.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.2 | 4.2.3 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.6.0 | ^0.6.1 | [#351][#351] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#351]: https://github.com/savvy-web/systems/pull/351

## 2.1.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.1 | 4.2.2 |

## 2.1.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.2.0 | 4.2.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/workspaces | dependency | updated | ^0.5.2 | ^0.6.0 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 2.1.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.1.0 | 4.2.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/jsonc | dependency | updated | ^0.4.0 | ^0.5.0 |  |
  | @effected/workspaces | dependency | updated | ^0.4.1 | ^0.5.2 |  |
  | @effected/yaml | dependency | updated | ^0.4.0 | ^0.5.0 | [#336][#336] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#336]: https://github.com/savvy-web/systems/pull/336

## 2.1.1

### Bug Fixes

- Fixed `savvy lint fmt pnpm-workspace` writing raw `@effected/yaml` output directly instead of routing through the same Prettier normalization the lint-staged handler applies. Running the subcommand (directly, or via the pre-commit hook) previously rewrote `pnpm-workspace.yaml` with unindented block sequences and single-quoted scalars. The subcommand now calls `Lint.PnpmWorkspace.formatContent` from `@savvy-web/silk-effects`, so both paths produce identical, idempotent output.

  Corrected the requirements type parameter on the exported `changesetCommand` and `reposCommand`, which declared `never` while the commands actually required services. Effect 4.0.0-beta.99 propagates subcommand requirements into a parent group's type, so the annotations now name the real services. Runtime behavior is unchanged. Code that composes these commands and provides their services already type-checks; code that relied on the inaccurate `never` to skip providing a layer now fails at compile time instead of at runtime. [#328][#328]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.0.1 | 4.1.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/platform-node | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 |  |
  | @effected/git | dependency | updated | ^0.4.0 | ^0.4.1 |  |
  | @effected/jsonc | dependency | updated | ^0.3.0 | ^0.4.0 |  |
  | @effected/workspaces | dependency | updated | ^0.4.0 | ^0.4.1 |  |
  | @effected/yaml | dependency | updated | ^0.3.1 | ^0.4.0 |  |
  | effect | dependency | updated | 4.0.0-beta.98 | 4.0.0-beta.99 | [#326][#326] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#326]: https://github.com/savvy-web/systems/pull/326

[#328]: https://github.com/savvy-web/systems/pull/328

## 2.1.0

### Features

- Adds `savvy commit lint <file>`, which validates a candidate commit-message file against the real Silk commitlint preset — the same rule engine the `commit-msg` hook enforces — before the commit is created.
  - Runs `commitlint --edit <file>` via the detected package manager, so rejecting rules (`header-max-length`, `body-max-line-length`, `type-enum`, `subject-full-stop`, `signed-off-by`) actually gate the message, unlike the advisory heuristics in `commit hook pre-commit-message`.
  - Exits non-zero when the message is rejected and 0 when it passes, surfacing commitlint's own output so you see the exact violations.
  - Fills the gap between `hook pre-commit-message` (advisory only) and `hook post-commit-verify` (runs the real engine, but only after a commit already exists): there is now a CLI path to answer "would this message pass?" up front. [#320][#320]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#320]: https://github.com/savvy-web/systems/pull/320

## 2.0.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 4.0.0 | 4.0.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effected/git | dependency | updated | ^0.3.0 | ^0.4.0 |  |
  | @effected/workspaces | dependency | updated | ^0.3.0 | ^0.3.1 |  |
  | @effected/yaml | dependency | updated | ^0.2.0 | ^0.3.0 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 2.0.0

### Breaking Changes

- The `savvy` binary is rebuilt on the in-core `effect/unstable/cli` framework; the dead `@effect/cli` dependency and eight unused `@effect/*` pins are removed.
- The `repos note` grammar moves the repo name after the operation (`savvy repos note add <name> <text>`), since v4's CLI framework has no parent-positional sharing.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.3.1 | 4.0.0 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | @effect/cli | dependency | removed | ^0.75.2 | — |  |
  | @effect/cluster | dependency | removed | ^0.59.0 | — |  |
  | @effect/experimental | dependency | removed | ^0.60.0 | — |  |
  | @effect/platform | dependency | removed | ^0.96.2 | — |  |
  | @effect/printer | dependency | removed | ^0.49.0 | — |  |
  | @effect/printer-ansi | dependency | removed | ^0.49.0 | — |  |
  | @effect/rpc | dependency | removed | ^0.75.1 | — |  |
  | @effect/sql | dependency | removed | ^0.51.1 | — |  |
  | @effect/typeclass | dependency | removed | ^0.40.0 | — |  |
  | @effect/workflow | dependency | removed | ^0.18.2 | — |  |
  | jsonc-effect | dependency | removed | ^0.3.1 | — |  |
  | workspaces-effect | dependency | removed | ^2.1.0 | — |  |
  | yaml | dependency | removed | ^2.9.0 | — |  |
  | @effect/platform-node | dependency | updated | ^0.107.0 | catalog:effect |  |
  | effect | dependency | updated | ^3.21.4 | catalog:effect |  |
  | @effected/git | dependency | added | — | ^0.3.0 |  |
  | @effected/jsonc | dependency | added | — | ^0.2.0 |  |
  | @effected/workspaces | dependency | added | — | ^0.3.0 |  |
  | @effected/yaml | dependency | added | — | ^0.2.0 | [#312][#312] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Other

- Git introspection in the commit and changeset hooks adopts `@effected/git` (`repoRoot`, `commitInfo`, `remoteUrl`). [#312][#312]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#312]: https://github.com/savvy-web/systems/pull/312

## 1.6.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.3.0 | 3.3.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | workspaces-effect | dependency | updated | ^2.0.3 | ^2.1.0 | [#304][#304] Thanks [@savvy-web-bot](https://github.com/apps/savvy-web-bot)! |

### Patch Changes

[#304]: https://github.com/savvy-web/systems/pull/304

## 1.6.0

### Features

- ### `savvy repos` command group
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
  - `status` prints a drift report (gitlink vs. manifest ref, dirty and unsynced submodules); `--json` emits the structured report.
  - `sync` reconciles the working tree with the manifest, self-healing stale submodule locks.
  - `pin` and `add` stage their changes (manifest, gitlink, `.gitmodules`) and print a ready-made commit message rather than committing on the caller's behalf — review and commit is a separate, deliberate step.
  - `add` requires `--purpose`, documenting why the repo is vendored.

  A missing `.repos/config.json` is treated as the common, friendly case — a plain message (or an empty JSON report) and exit code 0. A manifest that exists but is corrupt or unreadable is a real failure and exits 1. [#292][#292]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.5 | 3.3.0 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#292]: https://github.com/savvy-web/systems/pull/292

## 1.5.10

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.4 | 3.2.5 |

## 1.5.9

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.3 | 3.2.4 |

## 1.5.8

### Bug Fixes

- `savvy commit hook post-commit-verify` no longer reports a signing problem when a signature merely cannot be verified. Git's `%G?` reports `E` for "signature cannot be checked (e.g. missing key)" — the commit is signed, but the checking process cannot reach the keyring or gpg-agent, which is routine inside a hook subprocess. The hook treated `E` as a defect alongside `B` (bad), `R` (revoked), and `X`/`Y` (expired), and told the user to investigate their signing setup and amend. In practice it fired on correctly signed commits: the same commit that reports `E` from the hook reports `G` from an interactive shell. Failure to verify is not evidence of a bad signature, and amending would not have fixed anything. Genuinely defective signatures are still reported, and an unsigned commit under `commit.gpgsign=true` still is too. [#276][#276]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#276]: https://github.com/savvy-web/systems/pull/276

## 1.5.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.2 | 3.2.3 |

## 1.5.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.1 | 3.2.2 |

## 1.5.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.2.0 | 3.2.1 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | workspaces-effect | dependency | updated | ^2.0.2 | ^2.0.3 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.5.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.1.0 | 3.2.0 |

## 1.5.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.0.3 | 3.1.0 |

## 1.5.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.0.2 | 3.0.3 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | jsonc-effect | dependency | updated | ^0.3.0 | ^0.3.1 | [#235][#235] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#235]: https://github.com/savvy-web/systems/pull/235

## 1.5.1

### Bug Fixes

- Declared `@effect/experimental`, `@effect/workflow`, `@effect/printer`, `@effect/printer-ansi`, and `@effect/typeclass` as regular dependencies, completing the Effect peer-dependency closure. All five were required peers of already-declared packages (`@effect/sql`, `@effect/cluster`, `@effect/cli`, and the printer pair), so pnpm auto-installed them at the consumer's importer level, where a consumer depending on a different major of `effect` could bind them against an incompatible `effect` instance (#228) [#232][#232]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.0.1 | 3.0.2 |

- | Dependency | Type | Action | From | To |  |
  | --- | --- | --- | --- | --- | --- |
  | workspaces-effect | dependency | updated | ^2.0.1 | ^2.0.2 | [#232][#232] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#232]: https://github.com/savvy-web/systems/pull/232

## 1.5.0

### Features

- `savvy init` now writes `@savvy-web/changelog` as the canonical `changelog` id in fresh and patched `.changeset/config.json` files. The prior `@savvy-web/silk/changesets/changelog` shim id and the pre-merge `@savvy-web/changesets/changelog` id are still accepted by `init --check`, so existing repos migrate lazily on their next `savvy init`. [#223][#223]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 3.0.0 | 3.0.1 |

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#223]: https://github.com/savvy-web/systems/pull/223

## 1.4.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 2.1.0 | 3.0.0 |

### Maintenance

- `savvy init` now writes the `$schema` URL `https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json` in generated `.changeset/config.json` files (was `@changesets/config@3.1.1`), keeping generated scaffolding in sync with the v3 config schema. [#218][#218]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#218]: https://github.com/savvy-web/systems/pull/218

## 1.4.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 2.0.2 | 2.1.0 |

## 1.4.2

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 2.0.1 | 2.0.2 |

## 1.4.1

### Bug Fixes

- [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) Upgrade transient semver-effect library to correct side effect issues in bundles.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 2.0.0 | 2.0.1 |

- [`03356b7`](https://github.com/savvy-web/systems/commit/03356b70bb3fa2a89aa0b931d58377ae4f0f0d77) \| Dependency \| Type \| Action \| From \| To \|
  \| ----------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| workspaces-effect \| dependency \| updated \| ^2.0.0 \| ^2.0.1 \|

## 1.4.0

### Features

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) `savvy changeset deps regen`/`deps detect` now report catalog-aware dependency rows: a stable `catalog:` specifier whose resolved version changed shows the concrete `from`/`to` versions, and a package that only adopted a `catalog:` specifier without a version change no longer produces noise.
- Dependency-changeset gating now follows the `publishable OR privatePackages.version` (minus ignored) rule, matching the rest of the changeset tooling.
- Both commands now also handle `GitReadError` alongside `GitError`, so snapshot-read failures exit with a clear error instead of an unhandled rejection.

### Refactoring

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) Internal layer composition for `deps regen`/`deps detect` moved from `CatalogResolverLive`/`WorkspaceSnapshotReaderLive` to `workspaces-effect`'s `PointInTimeWorkspaceLive`.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.6.0 | 2.0.0 |

- [`63b3987`](https://github.com/savvy-web/systems/commit/63b39876114f20621540e8b0131b79bcac0a2428) \| Dependency \| Type \| Action \| From \| To \|
  \| ----------------- \| ---------- \| ------- \| ------ \| ------ \|
  \| workspaces-effect \| dependency \| updated \| ^1.2.0 \| ^2.0.0 \|

## 1.3.6

### Bug Fixes

- [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) `savvy changeset deps regen`/`deps detect` now route through silk-effects' `Changesets.DepsRegen`, so regenerated dependency changesets resolve `catalog:`/`workspace:` specifiers to concrete versions (#199) and omit `devDependency` rows that never reach a consumer (#151). The emitted `## Dependencies` tables are now CSH005-valid and pass pre-commit, instead of passing the CLI checks but failing at commit time.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.5.2 | 1.6.0 |

- [`efca0aa`](https://github.com/savvy-web/systems/commit/efca0aa73461e5d769ee1521f99316e64312faa4) \| Dependency \| Type \| Action \| From \| To \|
  \| ------------ \| ---------- \| ------- \| ------ \| ------ \|
  \| jsonc-effect \| dependency \| updated \| ^0.2.1 \| ^0.3.0 \|

## 1.3.5

### Maintenance

- [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so these packages pick up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds `LICENSE` files and applies minor manifest and `tsconfig.json` corrections across the three packages in the fixed release group, including moving `@savvy-web/silk-effects` to `devDependencies` in `@savvy-web/silk` (it is build-time only). No runtime behavior changes.

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/silk-effects | dependency | updated | 1.5.1 | 1.5.2 |

## 1.3.4

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.1 |

## 1.3.3

### Bug Fixes

- [`6a6591c`](https://github.com/savvy-web/systems/commit/6a6591c6385e49ebc8ad60a5a89f66e646c756e6) Fixed `savvy init` and `savvy check` not writing or validating Biome `$schema` URLs.

The commands read a `BIOME_VERSION` constant (now `2.5.1`) from a dedicated internal module. Previously they read `__BIOME_PEER_VERSION__`, an env var that was never populated at runtime, so the schema-sync path was silently inert. Running `savvy init` now writes the correct `$schema` URL into consumer `biome.json`/`biome.jsonc` files, and `savvy check` now reports when those URLs are stale.

## 1.3.2

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.0 |

## 1.3.1

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.5.0 | 1.5.0 |

## 1.3.0

### Dependencies

- | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | @effect/platform | dependency | updated | ^0.96.1 | ^0.96.2 |  |
  | effect | dependency | updated | ^3.21.3 | ^3.21.4 |  |
  | @typescript/native-preview | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |  |
  | @types/node | devDependency | updated | ^25.9.0 | ^26.0.0 |  |
  | Dependency | Type | Action | From | To |  |
  | ----------------------- | ---------- | ------- | ----- | ----- |  |
  | @savvy-web/silk-effects | dependency | updated | 1.4.0 | 1.5.0 |  |

## 1.2.0

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.3.1 | 1.4.0 |

## 1.1.2

### Bug Fixes

- [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### commit-quality reminder no longer fires on every prompt

The silk plugin injected the commit-create skill reminder on every `UserPromptSubmit` whose text mentioned a commit-adjacent verb (`commit`, `ship`, `finalize`, and the like). Because the trigger matched any mention — "look at the last commit", "revert that commit" — rather than an intent to create one, the block appeared on analysis, review, and status turns throughout a session and drowned out the turns where a commit was actually being composed.

The blanket `UserPromptSubmit` injection is removed. The commit-create directive is still delivered once per session by the SessionStart orientation block, and the message validation still runs as a just-in-time PreToolUse check on the actual `git commit` and `gh pr create` commands. The now-unused `savvy commit hook user-prompt-submit` subcommand and the `UserPromptSubmitEnvelope` and `userPromptSubmitContext` hook helpers are removed along with it.

- [`df6e04a`](https://github.com/savvy-web/systems/commit/df6e04a39768dc0829a9359c439773d9216847e4) ### markdownlint no longer lints files under `.git/`

The default markdownlint-cli2 config globs `**/*.{md,mdx}`, which swept ad-hoc session files under `.git/` (for example `.git/sdd/*.md`) and flagged them in the pre-commit hook. `**/.git` is now part of the default `ignores` list, so those files are excluded.

`savvy init` also reconciles `ignores` on an existing config now. On the silk preset without `--force` it previously synced only `$schema` and compared `config`, never touching `ignores`, so existing repos could not pick up new default excludes on a plain re-init. It now non-destructively appends any template ignores a repo is missing while preserving user-added entries — these are additive safety-excludes that cannot change a lint verdict, so they apply automatically, unlike `config` rules which stay warn-only.

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.3.0 | 1.3.1 |

## 1.1.1

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.2.0 | 1.3.0 |

## 1.1.0

### Features

- [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### `savvy lint init` and `savvy commit init` manage a post-commit hook (#122)

`savvy lint init` and `savvy commit init` now create and manage a `.husky/post-commit` hook that restores the executable bit on shell scripts after each commit. This mirrors the existing post-checkout and post-merge hygiene hooks, closing the gap where a commit could strip the execute permission from the very hooks that `post-checkout`/`post-merge` maintained.

### Bug Fixes

- [`71e4948`](https://github.com/savvy-web/systems/commit/71e4948f861424345b0bb44844f7acc0b3d31a80) ### Missing `@effect/*` peers no longer crash the `savvy` CLI or `savvy-mcp` server at load (#126)

`@savvy-web/cli` and `@savvy-web/mcp` now declare `@effect/cluster`, `@effect/rpc`, and `@effect/sql` as direct dependencies. The `@effect/platform-node` root barrel eagerly links these clustering submodules at import time. Without these declarations, a fresh install that did not already provide them indirectly would fail with `ERR_MODULE_NOT_FOUND` before any command could run.

### Changeset push-guard no longer blocks tag and delete pushes (\#124)

The `changeset-push-guard` plugin hook no longer triggers on `git push --tags`, `git push --delete`/`-d`, or refspec-deletion pushes (`git push origin :branch`). These push forms cannot introduce unreleased commits, so blocking them on an unreleased-changeset check was a false positive.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.1.0 | 1.2.0 |

## 1.0.0

### Breaking Changes

- [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) ### Removed changeset inspection subcommands

The following `savvy changeset` subcommands have been removed. They duplicated functionality now provided directly by the `changeset_inspect` MCP tool (modes `branch`, `config`, and `classify`) and the new `changeset_validate` MCP tool:

- `savvy changeset analyze-branch`
- `savvy changeset config show`
- `savvy changeset classify`
- `savvy changeset release-surface`

**Migration:** Use the `changeset_inspect` MCP tool instead. The `branch` mode replaces `analyze-branch`, the `config` mode replaces `config show` and `release-surface`, and the `classify` mode replaces `classify`.

The `savvy changeset config` group now exposes only `savvy changeset config validate`.

### Features

- [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) Registered the `savvy changeset check` subcommand, which was previously implemented but not wired into the command tree.

### Bug Fixes

- [`eac6587`](https://github.com/savvy-web/systems/commit/eac6587a9db1f2936703699b9d55134f80b8868e) `savvy changeset lint --json` and `savvy changeset deps detect --json` / `deps regen --json` now emit clean JSON to stdout without Effect.log timestamp prefixes.

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.1.0 | 1.1.0 |

## 0.5.0

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 1.0.1 | 1.1.0 |

## 0.4.2

## 0.4.1

### Dependencies

- | [`c96306d`](https://github.com/savvy-web/systems/commit/c96306d0a7c09b4263dd02358d2dc60ede84ef99) | Dependency | Type | Action | From | To |
  | :-- | :-- | :-- | :-- | :-- | --- |
  | workspaces-effect | dependency | updated | ^1.1.0 | ^1.2.0 |  |
  | Dependency | Type | Action | From | To |  |
  | ----------------------- | ---------- | ------- | ----- | ----- |  |
  | @savvy-web/silk-effects | dependency | updated | 1.0.0 | 1.0.1 |  |

## 0.4.0

### Build System

- [`8543348`](https://github.com/savvy-web/systems/commit/85433481b31cfa35ddfe2669dc6217efde327b9e) Now built with `@savvy-web/bundler`. Versioned in lockstep with `@savvy-web/silk` and `@savvy-web/mcp` (fixed release group).

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 0.6.1 | 1.0.0 |

## 0.3.1

### Other

- [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments

  | Dependency | Type | Action | From | To |
  | --- | --- | --- | --- | --- |
  | @savvy-web/silk-effects | dependency | updated | 0.6.0 | 0.6.1 |

## 0.3.0

### Breaking Changes

- [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) The per-tool `init` and `check` subcommands were removed from the `changeset`, `commit`, and `lint` groups. `savvy init` and `savvy check` are now the only setup and validation entry points — run those instead of `savvy changeset init`, `savvy commit check`, `savvy lint init`, and the like. The groups keep their other subcommands (for example `savvy changeset version` and `savvy lint fmt`).

### Features

- [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) Added `savvy clean`, which removes build and cache artifacts across an entire silk workspace. Run from anywhere inside the workspace, it globs the configured patterns (default `dist`, `.turbo`, `coverage`, `node_modules`, `.rslib`) at the top level of every workspace package — leaves first, the repo root last — and deletes the matches. Patterns are configurable with `--globs`, and `--dry-run` previews what would be removed without touching disk.

* `clean` added to the root command tree alongside `init` and `check`
* top-level glob matching by default, with `**` opt-in that skips descent into `node_modules` and `.git`
* path-containment safety so a match can never escape its workspace root

### Bug Fixes

- [`9de8951`](https://github.com/savvy-web/systems/commit/9de8951a79a7f02f35d91e3bef6c1d994f9f6645) `savvy changeset init` now writes the `@savvy-web/silk/changesets/changelog` and `@savvy-web/silk/changesets/markdownlint` shim paths into a consumer's `.changeset/config.json` and markdownlint config, matching what `@savvy-web/silk` actually installs, instead of the pre-merge standalone `@savvy-web/changesets` specifiers. `savvy check` accepts both the silk and legacy paths, and `init` migrates a legacy markdownlint entry rather than duplicating it.

## 0.2.1

### Documentation

- [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

## 0.1.0

### Features

- [`210a7fd`](https://github.com/savvy-web/systems/commit/210a7fd0bb22c7175276f9b72ddd35bc518573a5) ### savvy binary — unified Silk Suite CLI

`@savvy-web/cli` provides the `savvy` binary, replacing the three standalone bins (`savvy-changesets`, `savvy-commit`, and `savvy-lint`) with a single entry point.

Top-level commands:

- `savvy init` — set up Silk Suite tooling in a new or existing workspace
- `savvy check` — run all configured checks (changeset, commit, lint) in one pass

Subcommand groups:

**`savvy changeset`**

- `analyze-branch` — diff the current branch against the base and classify changed files by package
- `check` — validate all pending changeset files against the style rules
- `classify` — classify a single file path to its owning package
- `config show` / `config validate` — inspect and validate `.changeset/config.json`
- `deps detect` / `deps regen` — detect dependency changes and regenerate dependency changesets
- `init` — scaffold a `.changeset/` directory with Silk conventions
- `lint` — lint a single changeset file
- `release-surface` — print the computed release surface for a package
- `transform` — run the changelog post-processing pipeline on a markdown input
- `validate-file` — validate a changeset file path and frontmatter
- `version` — print the savvy changeset schema version

**`savvy commit`**

- `check` — validate a commit message against the Silk commitlint rules
- `hook` — run the pre-commit-message, post-commit-verify, session-start, and user-prompt-submit Claude Code hooks
- `init` — install husky hooks and Claude Code hook files

**`savvy lint`**

- `check` — run Biome, markdownlint, and other configured linters
- `init` — scaffold lint configuration files

### Patch Changes

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @savvy-web/silk-effects | dependency | updated | 0.5.0 | 0.6.0 |
