# @savvy-web/silk-core

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
