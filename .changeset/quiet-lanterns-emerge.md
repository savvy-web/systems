---
"@savvy-web/silk-core": minor
---

## Features

### Initial release

`@savvy-web/silk-core` is the platform-free domain core of the Silk Suite, extracted from `@savvy-web/silk-effects`. It carries the pieces every Silk front end shares without pulling in any Node platform services: the tagged errors, the workspace and config schemas, the `PrBody` contract, and the `trimTrailingSlashes` helper.

```ts
import { ConfigNotFoundError, PrBody, WorkspaceAnalysis } from "@savvy-web/silk-core";
```

* **Errors** — `BiomeSyncError`, `ChangesetConfigError`, `ConfigNotFoundError`, `PublishTargetBindingError`, `WorkspaceAnalysisError`
* **Schemas** — `AnalyzedWorkspace`, `WorkspaceAnalysis`, `SilkPublishConfig`, the `Savvy*Section` schemas and their section builders, `ConfigLocation`/`ConfigSource`, `ChangesetConfigFile`/`SilkChangesetConfigFile`, `BiomeSyncOptions`/`BiomeSyncResult`
* **`PrBody`** — the frozen `silk-release` marker grammar, managed-region carry-through and closing-reference parsing
* **Utilities** — `trimTrailingSlashes`

`@savvy-web/silk-effects` depends on this package and re-exports the same names, so existing imports keep working; reach for `@savvy-web/silk-core` directly when you want the schemas and errors without the Effect engine.
