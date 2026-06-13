---
status: current
module: github-action-effects
category: architecture
created: 2026-03-06
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 92
related:
  - ./index.md
  - ./services.md
  - ./layers.md
dependencies: []
---

# Integration Points

## Overview

Dependencies, external integrations and how services compose in
`@savvy-web/github-action-effects`.

See [index.md](./index.md) for architecture overview.
See [layers.md](./layers.md) for layer dependency graph.

---

## Dependencies

### Required peers

**effect** -- Core dependency. Services use `Context.Tag`, `Layer`,
`Schema`, `Data.TaggedError`, `FiberRef`, `Logger`, `Config`, and
`ConfigProvider`.

**@effect/platform and @effect/platform-node** -- `ActionsRuntime.Default`
provides `NodeFileSystem.layer` from `@effect/platform-node`, giving
programs access to `FileSystem`. Several services (ActionOutputs,
ActionState, ConfigLoader, ChangesetAnalyzer, WorkspaceDetector,
PackagePublish) depend on `FileSystem` from `@effect/platform`.

### Direct dependencies

| Package | Purpose | Used By |
| --- | --- | --- |
| `@octokit/rest` | GitHub REST + GraphQL API client | `GitHubClientLive` |
| `@octokit/auth-app` | GitHub App JWT authentication | `OctokitAuthAppLive` |
| `@azure/storage-blob` | Azure Blob Storage upload/download for cache | `ActionCacheLive` |
| `@sigstore/sign` | Sigstore DSSE signing (Fulcio + Rekor) | `SigstoreSignerLive` |
| `@sigstore/bundle` | Sigstore bundle construction/validation | `SigstoreSignerLive` |
| `@cyclonedx/cyclonedx-library` | CycloneDX 1.5 BOM model + JSON serialization | `SbomLive` |
| `jsonc-effect` | JSONC parsing with Effect | `ConfigLoaderLive` |
| `semver-effect` | Semver operations with Effect | `SemverResolver` |
| `yaml-effect` | YAML parsing with Effect | `ConfigLoaderLive` |

These are direct dependencies (not peers), bundled with the library. The current set is authoritative in `packages/github-action-effects/package.json`.

### No @actions/* dependencies

All `@actions/*` packages have been removed. The library implements the
GitHub Actions runtime protocol natively:

| Previously | Now |
| --- | --- |
| `@actions/core` getInput | `ActionsConfigProvider` reading `INPUT_*` env vars |
| `@actions/core` setOutput | `RuntimeFile.append("GITHUB_OUTPUT", ...)` |
| `@actions/core` saveState | `RuntimeFile.append("GITHUB_STATE", ...)` |
| `@actions/core` exportVariable | `RuntimeFile.append("GITHUB_ENV", ...)` |
| `@actions/core` addPath | Append to `GITHUB_PATH` file |
| `@actions/core` debug/warning/error | `WorkflowCommand.issue("debug"/"warning"/"error", ...)` |
| `@actions/core` group/endgroup | `WorkflowCommand.issue("group"/"endgroup", ...)` |
| `@actions/core` setSecret | `WorkflowCommand.issue("add-mask", ...)` |
| `@actions/core` setFailed | `WorkflowCommand.issue("error", ...) + process.exitCode = 1` |
| `@actions/core` summary | Direct write to `$GITHUB_STEP_SUMMARY` file |
| `@actions/exec` | `node:child_process` spawn |
| `@actions/github` getOctokit | Direct `@octokit/rest` instantiation |
| `@actions/cache` | V2 Twirp RPC protocol + `@azure/storage-blob` at ACTIONS_RESULTS_URL |
| `@actions/tool-cache` | Native `fetch` + `node:child_process` + `node:fs/promises` |

---

## GitHub Actions runtime protocol

The library interacts with the GitHub Actions runtime through:

### Workflow commands (stdout)

Format: `::command key=value,key=value::message`

Used for: debug, warning, error, group/endgroup, add-mask and other
workflow commands. Implemented in `packages/github-action-effects/src/runtime/WorkflowCommand.ts`.

### Environment files

Append key-value pairs to files specified by environment variables:

| Env Var | Purpose |
| --- | --- |
| `GITHUB_OUTPUT` | Set step outputs |
| `GITHUB_ENV` | Export environment variables |
| `GITHUB_STATE` | Save state across phases |
| `GITHUB_PATH` | Add to PATH |
| `GITHUB_STEP_SUMMARY` | Write step summary markdown |

Implemented in `packages/github-action-effects/src/runtime/RuntimeFile.ts`. Supports multiline values
via the delimiter protocol (`key<<delimiter\nvalue\ndelimiter`).

### Input variables

Action inputs are available as `INPUT_*` environment variables with the
name uppercased and spaces replaced by underscores. Hyphens are preserved.

Implemented in `packages/github-action-effects/src/runtime/ActionsConfigProvider.ts` as an Effect
`ConfigProvider`.

### Cache protocol (V2 Twirp)

The V2 cache API at `ACTIONS_RESULTS_URL` with `ACTIONS_RUNTIME_TOKEN`
authentication. Uses the Twirp RPC service at
`/twirp/github.actions.results.api.v1.CacheService/`. Three-step save
(`CreateCacheEntry`, Azure Blob upload, `FinalizeCacheEntryUpload`) and
`GetCacheEntryDownloadURL`-based restore via Azure Blob download.

Implemented in `packages/github-action-effects/src/layers/ActionCacheLive.ts` using native `fetch` for
Twirp RPC calls and `@azure/storage-blob` for Azure Blob Storage transfers.

---

## Service dependency graph

The full tier-by-tier dependency graph (which service consumes which) is maintained once, in [layers.md](./layers.md#service-dependency-graph). The two integration facts that matter for wiring are below.

### ActionsRuntime.Default as the integration point

`ActionsRuntime.Default` is the single integration point for wiring the runtime layer into user programs. It provides everything needed for basic action I/O — the `INPUT_*` ConfigProvider, the workflow-command Logger, `ActionLogger`, `ActionOutputs`, `ActionState`, `ActionEnvironment`, `NodeFileSystem.layer` (the `FileSystem` for outputs/state) and `FetchHttpClient.layer` (the `HttpClient` that `OidcTokenIssuer`, `GitHubApp` and `ActionCache` require). See `packages/github-action-effects/src/runtime/ActionsRuntime.ts`.

### Layer provision for Tier 2+

Every GitHub-API service requires a `GitHubClient` in context. Provide one of the three `GitHubClientLive` construction modes (`fromEnv` reads ambient `GITHUB_TOKEN`; `fromToken`/`fromApp` select other identities), then merge the Tier 2 services that consume it. Test layers for these services do not depend on `GitHubClient` — they operate entirely in-memory.

---

## Consumer patterns

### Basic action (inputs + outputs)

```typescript
import { Effect, Config } from "effect"
import { Action } from "@savvy-web/github-action-effects"

const program = Effect.gen(function* () {
  const name = yield* Config.string("name")
  yield* Effect.log(`Hello, ${name}!`)
})

Action.run(program)
```

### Action with the GitHub API

```typescript
import { Effect, Config, Layer } from "effect"
import { Action, GitHubClientLive, CheckRunLive }
  from "@savvy-web/github-action-effects"

const program = Effect.gen(function* () {
  // ...
})

Action.run(program, {
  layer: Layer.mergeAll(CheckRunLive).pipe(
    Layer.provideMerge(GitHubClientLive.fromEnv),
  ),
})
```

### Manual layer composition

```typescript
import { Effect, Layer } from "effect"
import { ActionsRuntime, GitHubClientLive, CheckRunLive }
  from "@savvy-web/github-action-effects"

const MyLayer = Layer.mergeAll(
  ActionsRuntime.Default,
  CheckRunLive,
).pipe(Layer.provideMerge(GitHubClientLive.fromEnv))

Effect.runPromise(program.pipe(Effect.provide(MyLayer)))
```

### Multi-phase action with a GitHub App token

The `GitHubToken` namespace wires the App installation-token lifecycle across
the pre/main/post phases — `provision` in `pre.ts`, `client` in `main.ts`,
`dispose` in `post.ts` — communicating through an internal `ActionState` key.
See [services.md](./services.md#githubtoken-lifecycle) for the full data flow.

`provision` and `dispose` require a `GitHubApp` layer in context — provide `GitHubAppLive` composed with `OctokitAuthAppLive` in production (or `GitHubAppTest` when unit-testing the phases). `client` requires `ActionState`, supplied by the runtime.

```typescript
import { Layer } from "effect"
import { Action, GitHubToken, CheckRunLive, GitHubAppLive, OctokitAuthAppLive }
  from "@savvy-web/github-action-effects"

// GitHubApp layer required by provision/dispose
const GitHubAppLayer = GitHubAppLive.pipe(Layer.provide(OctokitAuthAppLive))

// pre.ts
Action.run(GitHubToken.provision({ permissions: { checks: "write" } }), {
  layer: GitHubAppLayer,
})

// main.ts
Action.run(program, {
  layer: CheckRunLive.pipe(Layer.provideMerge(GitHubToken.client())),
})

// post.ts
Action.run(GitHubToken.dispose(), { layer: GitHubAppLayer })
```

---

## Optional integrations

### @savvy-web/github-action-builder

Actions built with the builder benefit from this library but it is not required. Any Node.js 24 action can use these services. The builder bundles each action entry into a single self-contained ESM file with `@rsbuild/core` — see [github-action-builder/architecture.md](../github-action-builder/architecture.md).

## Current State

The `@actions/*` packages are fully replaced with native implementations, so the only external runtime dependencies are the ones in the Direct Dependencies table above (plus the Effect peers). `ActionsRuntime.Default` is the single integration point for wiring the runtime layer.

## Rationale

Removing `@actions/*` packages eliminates CJS dependencies, simplifies the layer graph (no platform wrapper tier) and gives the library full control over the runtime protocol implementation. The tiered dependency graph makes layer composition predictable and testable at each level.

## Related Documentation

- [Architecture Index](./index.md) -- overall architecture and design overview
- [Services](./services.md) -- service interface definitions
- [Layers](./layers.md) -- layer dependency graph and composition
