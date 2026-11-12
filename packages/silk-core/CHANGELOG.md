# @savvy-web/silk-core

## 0.6.5

### Bug Fixes

- The `savvy` and `savvy-mcp` tools now pin their whole dependency closure exactly. A fresh install runs the same `effect`, `@effected/*` and in-repo package versions they were tested with, so a later Effect or kit patch can no longer change their behaviour or break them at import without a new release. `@savvy-web/silk`, `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/changelog` publish plain versions for every kit dependency and for `@savvy-web/silk-effects`. `@savvy-web/silk-effects` does the same for `@savvy-web/silk-core` and its regular kit dependencies.

- `@savvy-web/silk-effects` and `@savvy-web/silk-core` keep their `peerDependencies` as ranges, so code that imports them as libraries still shares one copy of `effect` and the kit with its host. `@savvy-web/mcp`, `@savvy-web/silk` and `@savvy-web/changelog` now also declare `@effected/jsonc`, `@effected/toml` and `@effected/yaml`, which `@effected/markdown` needs to read changeset front matter.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.15.0 | 0.15.0 |
| @effected/workspaces | peerDependency | updated | ^0.46.0 | ^0.47.0 |

## 0.6.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.45.0 | ^0.46.0 |

## 0.6.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.14.0 | ^0.15.0 |
| @effected/templates | peerDependency | updated | ^0.18.0 | ^0.20.0 |
| @effected/workspaces | peerDependency | updated | ^0.43.0 | ^0.45.0 |
| effect | peerDependency | updated | ~4.1.2 | ~4.1.0 |

[#871][#871]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#871]: https://github.com/savvy-web/systems/pull/871

## 0.6.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/templates | peerDependency | updated | ^0.17.0 | ^0.18.0 |
| @effected/workspaces | peerDependency | updated | ^0.42.0 | ^0.43.0 |

[#865][#865]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#865]: https://github.com/savvy-web/systems/pull/865

## 0.6.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.13.0 | ^0.14.0 |
| @effected/templates | peerDependency | updated | ^0.16.0 | ^0.17.0 |
| @effected/workspaces | peerDependency | updated | ^0.41.0 | ^0.42.0 |
| effect | peerDependency | updated | ~4.1.1 | ~4.1.2 |

[#862][#862]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#862]: https://github.com/savvy-web/systems/pull/862

## 0.6.0

### Breaking Changes

- Peer dependency ranges tightened: `effect` is now `~4.1.1` (previously `^4.0.0`), and the `@effected/*` kit peers moved to their current minors (for example `@effected/workspaces` `^0.41.0`, previously `^0.40.0`). Consumers on `effect` 4.0.x no longer satisfy the peer range and must upgrade to `effect` 4.1.x. [#855][#855]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.12.0 | ^0.13.0 |
| @effected/templates | peerDependency | updated | ^0.15.0 | ^0.16.0 |
| @effected/workspaces | peerDependency | updated | ^0.40.0 | ^0.41.0 |
| effect | peerDependency | updated | ^4.0.0 | ~4.1.1 |

[#855][#855]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#855]: https://github.com/savvy-web/systems/pull/855

## 0.5.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.11.0 | ^0.12.0 |
| @effected/templates | peerDependency | updated | ^0.14.0 | ^0.15.0 |
| @effected/workspaces | peerDependency | updated | ^0.39.0 | ^0.40.0 |

[#841][#841]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#841]: https://github.com/savvy-web/systems/pull/841

## 0.5.2

### Bug Fixes

- The SAVVY-OKF pre-commit section now keeps okfit's log mode on when the bundle has unstaged or untracked work, running `okfit sync --staged --only generated --only log` and dropping only index mode. With okfit 0.14.0, a commit that touches a concept now carries its own `log.md` entry in both cases, instead of leaving it for a follow-up commit. Closes #796 [#825][#825]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.38.0 | ^0.39.0 |

[#825][#825]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#825]: https://github.com/savvy-web/systems/pull/825

## 0.5.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.36.0 | ^0.38.0 |

[#815][#815]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#815]: https://github.com/savvy-web/systems/pull/815

## 0.5.0

### Features

- New `ReleaseChannelError` tagged error (`pkg`, `id`, `value`), raised when a publish target declares a `releases` value that is not `"all"`, `"stable"` or `"prerelease"`. [#809][#809]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.10.0 | ^0.11.0 |
| @effected/templates | peerDependency | updated | ^0.13.0 | ^0.14.0 |
| @effected/workspaces | peerDependency | updated | ^0.35.0 | ^0.36.0 |

[#809][#809]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#809]: https://github.com/savvy-web/systems/pull/809

## 0.4.14

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.9.0 | ^0.10.0 |
| @effected/templates | peerDependency | updated | ^0.12.0 | ^0.13.0 |
| @effected/workspaces | peerDependency | updated | ^0.34.0 | ^0.35.0 |

[#797][#797]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#797]: https://github.com/savvy-web/systems/pull/797

## 0.4.13

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.8.0 | ^0.9.0 |
| @effected/templates | peerDependency | updated | ^0.11.0 | ^0.12.0 |
| @effected/workspaces | peerDependency | updated | ^0.33.0 | ^0.34.0 |

[#791][#791]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#791]: https://github.com/savvy-web/systems/pull/791

## 0.4.12

### Bug Fixes

- The `SAVVY-OKF` pre-commit section no longer passes the project root to `okfit sync` as a positional argument, which `@okfit/cli` 0.13.0 refuses and which failed every commit. The sync now runs from `$ROOT` in a subshell, so the CLI's default root applies on okfit versions before and after 0.13.0 without a version probe. Run `savvy init` to regenerate the section in an existing hook. Closes #788. [#789][#789]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#789]: https://github.com/savvy-web/systems/pull/789

## 0.4.11

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.7.0 | ^0.8.0 |
| @effected/templates | peerDependency | updated | ^0.10.0 | ^0.11.0 |
| @effected/workspaces | peerDependency | updated | ^0.32.0 | ^0.33.0 |

[#783][#783]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#783]: https://github.com/savvy-web/systems/pull/783

## 0.4.10

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.31.0 | ^0.32.0 |

[#746][#746]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#746]: https://github.com/savvy-web/systems/pull/746

## 0.4.9

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.6.0 | ^0.7.0 |
| @effected/templates | peerDependency | updated | ^0.9.0 | ^0.10.0 |
| @effected/workspaces | peerDependency | updated | ^0.30.0 | ^0.31.0 |
| effect | peerDependency | updated | 4.0.0-rc.118 | ^4.0.0 |

[#736][#736]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#736]: https://github.com/savvy-web/systems/pull/736

## 0.4.8

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.5.0 | ^0.6.0 |
| @effected/templates | peerDependency | updated | ^0.8.0 | ^0.9.0 |
| @effected/workspaces | peerDependency | updated | ^0.28.0 | ^0.30.0 |
| effect | peerDependency | updated | 4.0.0-rc.117 | 4.0.0-rc.118 |

[#711][#711]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#711]: https://github.com/savvy-web/systems/pull/711

## 0.4.7

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.27.0 | ^0.28.0 |

[#703][#703]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#703]: https://github.com/savvy-web/systems/pull/703

## 0.4.6

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.26.0 | ^0.27.0 |

[#701][#701]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#701]: https://github.com/savvy-web/systems/pull/701

## 0.4.5

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.25.0 | ^0.26.0 |

[#694][#694]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#694]: https://github.com/savvy-web/systems/pull/694

## 0.4.4

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.4.0 | ^0.5.0 |
| @effected/templates | peerDependency | updated | ^0.7.0 | ^0.8.0 |
| @effected/workspaces | peerDependency | updated | ^0.24.0 | ^0.25.0 |
| effect | peerDependency | updated | 4.0.0-rc.116 | 4.0.0-rc.117 |

[#689][#689]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#689]: https://github.com/savvy-web/systems/pull/689

## 0.4.3

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.23.0 | ^0.24.0 |

[#681][#681]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#681]: https://github.com/savvy-web/systems/pull/681

## 0.4.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.3.1 | ^0.4.0 |
| @effected/templates | peerDependency | updated | ^0.6.0 | ^0.7.0 |
| @effected/workspaces | peerDependency | updated | ^0.22.0 | ^0.23.0 |
| effect | peerDependency | updated | 4.0.0-rc.115 | 4.0.0-rc.116 |

[#672][#672]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#672]: https://github.com/savvy-web/systems/pull/672

## 0.4.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | updated | ^0.3.0 | ^0.3.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 0.4.0

### Breaking Changes

- `@effected/templates` is now a required peer dependency instead of a regular dependency. Its `Section`, `CommentStyle`, and `SectionId` classes are nominal and appear in the exported `SavvySections`, `SavvyOkfSection`, and `SavvyInstallSection` schemas, so a consumer's own copy has to be the same one silk-core builds on — exactly like the existing `@effected/workspaces` peer.

- If your project installs `@savvy-web/silk-core` directly and previously relied on `@effected/templates` arriving transitively, add it explicitly:

```bash
pnpm add @effected/templates
```

- The peer ranges for `@effected/templates`, `@effected/workspaces`, and `effect` also widened to accept any compatible minor release rather than only the current patch.

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/templates | peerDependency | added | — | ^0.6.0 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 0.3.1

### Maintenance

- Republished with no source change; the suite is now uniformly ESM-only. [#664][#664]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#664]: https://github.com/savvy-web/systems/pull/664

## 0.3.0

### Bug Fixes

- Force releasing all packages to fix pnpm v12 flakiness.

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 0.2.0

### Features

- `SavvyOkfSection` — the `SectionId` for a `SAVVY-OKF` managed section (hash-comment style), pairing with `savvyOkfSync`
- `savvyOkfSync()` / `savvyOkfBlock()` — the OKF bundle sync block for `pre-commit`, running `okfit sync --staged` so a staged concept's `generated.at` stamp lands in the same commit as the edit that moved it
  - Silent no-op in CI, when the repo carries no `okf/` bundle, or when no local `okfit` binary is installed
  - A non-zero `okfit` exit fails the commit
  - Regenerates the derived `index.md` files in the same commit while the bundle is clean apart from what is staged; with untracked or unstaged concepts present it narrows to `--only generated`, so an unrelated commit never links a concept it does not contain [#659][#659]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#659]: https://github.com/savvy-web/systems/pull/659

## 0.1.3

### Bug Fixes

- Force bumping all public packages due to npm flakiness in releasing tooling. [#651][#651]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#651]: https://github.com/savvy-web/systems/pull/651

## 0.1.2

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.21.1 | ^0.22.0 |

[#647][#647]

### Thanks

Thanks to [@savvy-web-bot](https://github.com/apps/savvy-web-bot) for their contributions!

[#647]: https://github.com/savvy-web/systems/pull/647

## 0.1.1

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/workspaces | peerDependency | updated | ^0.21.0 | ^0.21.1 |

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

## 0.1.0

### Features

#### Initial release

- `@savvy-web/silk-core` is the platform-free domain core of the Silk Suite, extracted from `@savvy-web/silk-effects`. It carries the pieces every Silk front end shares without pulling in any Node platform services: the tagged errors, the workspace and config schemas, the `PrBody` contract, and the `trimTrailingSlashes` helper.

```ts
import { ConfigNotFoundError, PrBody, WorkspaceAnalysis } from "@savvy-web/silk-core";
```

- **Errors** — `BiomeSyncError`, `ChangesetConfigError`, `ConfigNotFoundError`, `PublishTargetBindingError`, `WorkspaceAnalysisError`

- **Schemas** — `AnalyzedWorkspace`, `WorkspaceAnalysis`, `SilkPublishConfig`, the `Savvy*Section` schemas and their section builders, `ConfigLocation`/`ConfigSource`, `ChangesetConfigFile`/`SilkChangesetConfigFile`, `BiomeSyncOptions`/`BiomeSyncResult`

- **`PrBody`** — the frozen `silk-release` marker grammar, managed-region carry-through and closing-reference parsing

- **Utilities** — `trimTrailingSlashes`

- `@savvy-web/silk-effects` depends on this package and re-exports the same names, so existing imports keep working; reach for `@savvy-web/silk-core` directly when you want the schemas and errors without the Effect engine. [#638][#638]

### Dependencies

| Dependency | Type | Action | From | To |
| --- | --- | --- | --- | --- |
| @effected/github-references | dependency | added | — | ^0.3.0 |
| @effected/templates | dependency | added | — | ^0.6.0 |
| @effected/workspaces | peerDependency | added | — | ^0.21.0 |
| effect | peerDependency | added | — | 4.0.0-rc.115 |

[#638][#638]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#638]: https://github.com/savvy-web/systems/pull/638
