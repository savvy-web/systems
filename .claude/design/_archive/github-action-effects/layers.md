---
status: archived
module: github-action-effects
category: architecture
created: 2026-03-06
updated: 2026-07-25
last-synced: 2026-07-25
archived: 2026-07-25
archived-reason: package deleted in the @effected github-split adoption; superseded by @effected/github-actions, @effected/github, @effected/sbom, @effected/npm, @effected/commands
completeness: 90
related:
  - ./index.md
  - ./services.md
  - ./testing-strategy.md
dependencies: []
---

# Layers

> **ARCHIVED 2026-07-25 — describes a package that no longer exists.**
> `@savvy-web/github-action-effects` was deleted from this repo wholesale in the `@effected` github-split
> adoption. Its 40 services and 87 layers moved into the `@effected` kit, which action repos now consume
> directly: `@effected/github-actions` (Actions runtime protocol), `@effected/github` (API client),
> `@effected/sbom`, `@effected/npm` and `@effected/commands`. Savvy-specific action business logic routes
> through `@savvy-web/silk-effects` instead — see [`../../silk-effects/architecture.md`](../../silk-effects/architecture.md).
> Everything below is preserved for historical reference (why the split was worth doing, and what the
> pre-split conventions were). Do not read it as current behavior, and do not cite its `packages/github-action-effects/*`
> paths — none of them resolve.

Layer patterns, the live-vs-test split and the canonical service dependency graph for `@savvy-web/github-action-effects`.

See [index.md](./index.md) for the architecture overview and [services.md](./services.md) for the service interfaces.

---

## Overview

Every domain service ships a `Live` layer (real platform calls) and a `Test` layer (in-memory state for unit tests), named `<Service>Live` / `<Service>Test` in `packages/github-action-effects/src/layers/`. The runtime layer in `src/runtime/` provides native implementations of the GitHub Actions protocol — there is no `@actions/*` wrapper tier.

This doc records the wiring conventions and the dependency graph. The exact `Layer` signatures live in each layer file; read those rather than expecting the design doc to mirror every requirement channel.

---

## Construction conventions

Most Live layers are built one of three ways:

- `Layer.succeed` when the layer has no service dependencies and talks directly to `process.env`, stdout or Node.js built-ins (e.g. `ActionLoggerLive`, `ActionEnvironmentLive`, `CommandRunnerLive`, `ToolInstallerLive`, `GlobLive`, `OctokitAuthAppLive`, `OidcTokenIssuerLive`).
- `Layer.effect` yielding the services it depends on (every Tier 2 GitHub-API layer yields `GitHubClient`, etc.).
- A namespace object when there is more than one way to build the layer — only `GitHubClientLive` qualifies, with its three construction modes. Test layers also use the namespace-object shape (`.empty()` / `.layer(state)`) for ergonomic setup while staying api-extractor compatible.

### Layers that import external packages directly

A handful of Live layers import a runtime package at the top of the file; everything else is pure Effect or Node.js built-ins:

- `GitHubClientLive` → `@octokit/rest`
- `OctokitAuthAppLive` → `@octokit/auth-app`
- `ActionCacheLive`, `ArtifactLive` and `GitHubBlobStoreLive` → `@azure/storage-blob`
- `SigstoreSignerLive` → `@sigstore/sign` (+ `@sigstore/bundle`)
- `SbomLive` → `@cyclonedx/cyclonedx-library`

The runtime modules (`WorkflowCommand`, `RuntimeFile`, `ActionsConfigProvider`, `ActionsLogger`) use only Node.js built-ins and Effect APIs.

---

## ActionsRuntime.Default

The single convenience layer for action I/O. It merges the `INPUT_*` ConfigProvider, the workflow-command Logger, `ActionEnvironmentLive`, `ActionLoggerLive`, `ActionOutputsLive`, `ActionStateLive` and `FetchHttpClient.layer`, then provides `NodeFileSystem.layer` underneath to satisfy the `FileSystem` dependency of outputs and state. `FetchHttpClient.layer` supplies the `HttpClient` that `OidcTokenIssuerLive`, `GitHubAppLive`, `ActionCacheLive` and `ArtifactLive` require. See `src/runtime/ActionsRuntime.ts`.

---

## Load-bearing layer notes

Most layers are unremarkable Effect plumbing. These few carry behavior a first-time editor needs to know:

- **`ActionLoggerLive`** holds the active buffer in a module-level `FiberRef<BufferState | null>` so `withBuffer` and `group` share one fiber-scoped buffer. `withBuffer` flushes the buffered transcript on *every* exit (success, failure or interruption) via `Effect.onExit`, not only on failure. A failing group still flushes its buffered diagnostics *inside* the group (before `::endgroup::`) and clears them, so each buffered chunk prints exactly once — the innermost failing boundary wins and the outer `withBuffer` exit flush is a no-op for already-flushed entries. `withBuffer` also bypasses buffering entirely when `process.env.RUNNER_DEBUG === "1"` (read at run time, since the ambient `MinimumLogLevel` Debug check is unreachable for consumers who provide their log level inside the wrapped program — either signal bypasses). See `src/layers/ActionLoggerLive.ts`.
- **`ActionCacheLive`** drives the V2 Twirp cache protocol: `tar -P` (absolute-names) for archives (tolerating tar exit 1, failing on 2+), `CreateCacheEntry` → Azure Blob upload → `FinalizeCacheEntryUpload` to save, `GetCacheEntryDownloadURL` → Azure Blob download to restore. Twirp calls retry with exponential backoff on 5xx/network; the Azure SDK retries internally. See `src/layers/ActionCacheLive.ts`.
- **`GitHubClientLive`** is the namespace object with the three construction modes (below) and the `retryable` error-mapping logic.
- **`RateLimiterLive`** reads rate-limit headers cached in a shared `RateLimitState` `Ref` (written by `GitHubClient` on each response) rather than issuing a pre-flight `GET /rate_limit`. `RateLimitState` is an internal service tag, not part of the public barrel.
- **`CommandRunnerLive`** and **`ToolInstallerLive`** carry the Windows-specific hardening (cmd.exe arg escaping, PowerShell zip extraction, redirect-following downloads). See their files.

### GitHubClientLive construction modes

`GitHubClientLive` is a namespace object because the construction surface chooses the client's identity. All three modes resolve a token, then call a shared internal `makeClient(token)` over `@octokit/rest`. See `src/layers/GitHubClientLive.ts`.

- `fromEnv` — reads ambient `process.env.GITHUB_TOKEN` (the weak repo-scoped default) and fails when it is unset. The self-describing call site is the explicit opt-in to ambient credentials.
- `fromToken(token)` — builds from an explicit `string | Redacted<string>`; no `process.env` dependency and no failure channel.
- `fromApp({ clientId, privateKey, installationId? })` — generates a fresh App installation token, composing `OctokitAuthAppLive` + `GitHubAppLive` internally. For a token shared across pre/main/post phases, use the `GitHubToken` namespace instead — see [services.md](./services.md#githubtoken-lifecycle).

The `repo` accessor resolves `GITHUB_REPOSITORY` at call time regardless of construction mode.

---

## BlobStore backends

`BlobStore` (see [services.md](./services.md)) ships two production backends and one test layer. Both Live backends require `HttpClient` and map every transport failure to `BlobStoreError`. Pick the backend that matches where the cache lives; the service interface is identical.

- **`GitHubBlobStoreLive`** (`src/layers/GitHubBlobStoreLive.ts`) — stores one cache entry per blob key on the GitHub Actions V2 cache protocol (Twirp + Azure Blob), reusing the shared `src/layers/internal/twirp.ts` client that also backs `ActionCacheLive`. Its version hash is a fixed marker (not path-derived like `ActionCacheLive`) because the key is already content-addressed by the caller. Only usable inside a GitHub Actions runner (needs `ACTIONS_RESULTS_URL` / `ACTIONS_RUNTIME_TOKEN`).
- **`S3BlobStoreLive`** (`src/layers/S3BlobStoreLive.ts`) — stores each blob as one S3 object via path-style addressing against any S3-compatible endpoint (AWS S3, R2, MinIO, Spaces). It carries no aws-sdk: requests are signed by a hand-rolled AWS SigV4 signer in `src/layers/internal/sigv4.ts` (its single consumer) over `node:crypto`, so the only runtime import is `@effect/platform` `HttpClient`. Configured via `S3BlobStoreConfig`; secret material (`secretAccessKey`, `sessionToken`) is held as `Redacted` and unwrapped only inside the signer. A 404 on `get` maps to `Option.none()` rather than an error.
- **`BlobStoreTest`** (`src/layers/BlobStoreTest.ts`) — in-memory `Map`-backed layer with an observable `BlobStoreTestState`, following the `.empty()` / `.layer(state)` namespace-object pattern.

---

## Service dependency graph

This is the canonical graph; [integration-points.md](./integration-points.md) points here. `FileSystem` and `HttpClient` come from `@effect/platform` / `ActionsRuntime.Default`.

```text
Tier 0 — No service dependencies (Node.js built-ins / native APIs):
  ActionLogger, ActionEnvironment, CommandRunner, ToolInstaller, DryRun,
  OidcTokenIssuer, Glob,
  GithubMarkdown, SemverResolver, ErrorAccumulator, ReportBuilder, RegistryClassifier

Tier 0 — External package import (no service dependencies):
  OctokitAuthApp            <- imports @octokit/auth-app
  GitHubClient              <- imports @octokit/rest; fromEnv/fromToken have no
                               service deps, fromApp composes GitHubAppLive +
                               OctokitAuthAppLive internally
  ActionCache               <- imports @azure/storage-blob; needs HttpClient

Tier 0.5 — Depends on FileSystem (and/or HttpClient):
  ActionOutputs             <- FileSystem
  ActionState               <- FileSystem
  Sbom                      <- FileSystem (for save)
  Artifact                  <- HttpClient (Twirp); imports @azure/storage-blob
  GitHubBlobStore           <- HttpClient (Twirp); imports @azure/storage-blob
  S3BlobStore               <- HttpClient (SigV4 over node:crypto, no aws-sdk)

Tier 1 — Single service dependency:
  GitHubApp                 <- OctokitAuthApp (+ HttpClient)
  NpmRegistry               <- CommandRunner
  ChangesetAnalyzer         <- FileSystem
  ConfigLoader              <- FileSystem
  TokenPermissionChecker    <- GitHubApp
  SigstoreSigner            <- OidcTokenIssuer

Tier 2 — GitHubClient dependents:
  GitHubGraphQL, GitBranch, GitCommit, GitTag, GitHubRelease, CheckRun,
  PullRequestComment, RateLimiter, WorkflowDispatch, GitHubContent,
  GitHubCommit, GitHubArtifactMetadata, Attest   <- GitHubClient
  GitHubIssue, PullRequest                        <- GitHubClient + GitHubGraphQL

Tier 2 — Multi-service (non-GitHubClient):
  PackageManagerAdapter     <- CommandRunner + FileSystem
  WorkspaceDetector         <- FileSystem + CommandRunner

Tier 3 — Composed dependencies:
  PackagePublish            <- CommandRunner + NpmRegistry + FileSystem
  AutoMerge (utility)       <- GitHubGraphQL
```

Test layers for every Tier 2 service do NOT depend on `GitHubClient` — they operate entirely in-memory.

---

## Composition example

`Action.run()` provides `ActionsRuntime.Default` automatically; extra layers go through the `layer` option:

```typescript
import { Action, GitHubClientLive, CheckRunLive }
  from "@savvy-web/github-action-effects"

Action.run(program, {
  layer: Layer.mergeAll(CheckRunLive, GitHubClientLive.fromEnv),
})
```

For manual composition outside `Action.run()`, merge `ActionsRuntime.Default` with the services and provide a `GitHubClientLive` identity via `Layer.provideMerge`.

---

## Current State

Every domain service has both a live and a test layer. The dependency graph above is the single source of truth for service wiring. The runtime layer provides the native GitHub Actions protocol implementation, so many Live layers have zero service dependencies.

## Rationale

Separating live and test layers lets services be tested entirely in-memory without touching real GitHub APIs or workflow commands. The namespace-object pattern for test layers (`.empty()` / `.layer(state)`) gives ergonomic setup while staying api-extractor compatible. Removing the `@actions/*` wrapper tier simplified the graph significantly.

## Related Documentation

- [index.md](./index.md) — architecture overview and design decisions
- [services.md](./services.md) — service interface descriptions
- [testing-strategy.md](./testing-strategy.md) — testing approach using test layers
