---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### `ConfigDiscovery` and `BiomeSchemaSync` require an explicit `cwd`

Engine code no longer reads `process.cwd()`. `ConfigDiscovery.find`/`findAll` and `BiomeSchemaSync.sync`/`check` now take a required `{ cwd }` option — the front end that owns the process supplies it.

```ts
// before
const location = yield* discovery.find("biome.json");
const result = yield* syncer.sync("^1.9.3");

// after
const location = yield* discovery.find("biome.json", { cwd: "/path/to/repo" });
const result = yield* syncer.sync("^1.9.3", { cwd: "/path/to/repo" });
```

### `Changesets.changelogFunctions` no longer sniffs the environment

The changelog engine used to decide how to emit warnings by reading `VITEST` and `GITHUB_ACTIONS` from `process.env`. It no longer reads the environment at all: `changelogFunctions` always warns to stderr. A host that runs under GitHub Actions or a test runner builds its own functions with the new factory and passes the mode explicitly:

```ts
import { Changesets } from "@savvy-web/silk-effects";

const logMode = process.env.GITHUB_ACTIONS === "true" ? "github" : "stderr";
export default Changesets.makeChangelogFunctions({ logMode });
```

`@savvy-web/changelog` and `@savvy-web/silk`'s `./changesets/changelog` shim already do this, so `.changeset/config.json` users see no difference.

## Features

### Changelog warning mode as a `Context.Reference`

* `Changesets.ChangesetLogMode` — a `Context.Reference<ChangesetLogModeValue>` (default `"stderr"`) that selects how changelog warnings are emitted; provide `"github"` for `::warning::` annotations or `"silent"` to discard them
* `Changesets.ChangesetLogModeValue` — `"silent" | "github" | "stderr"`
* `Changesets.makeChangelogFunctions(options?)` and `MakeChangelogFunctionsOptions` — build a `ChangelogFunctions` object bound to a `logMode`
* `Changelog.formatReleaseLine` and `Changelog.formatDependencyReleaseLine` accept an optional trailing `logMode` argument

### Domain core split into `@savvy-web/silk-core`

The errors, schemas, `PrBody` contract and `trimTrailingSlashes` now live in the new `@savvy-web/silk-core` package. `@savvy-web/silk-effects` depends on it and re-exports every one of those names, so no import changes are required.
