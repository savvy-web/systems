# @savvy-web/silk-core

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
