# Service dependency graph

> Distilled from `@savvy-web/github-action-effects@3.0.4` source (`src/layers/`)
> and production actions built on this stack, 2026-07-23. On version skew the
> installed source wins — re-verify before relying on this.

`FileSystem` comes from `@effect/platform-node`'s `NodeFileSystem.layer`;
`HttpClient` from `effect/unstable/http`'s `FetchHttpClient.layer`. Both are
already inside `ActionsRuntime.Default`, so a program run through `Action.run`
only wires the tiers below.

## Construction conventions

- `Layer.succeed` — layers with no service dependencies talking directly to
  `process.env`/stdout/Node built-ins (`ActionLoggerLive`,
  `ActionEnvironmentLive`, `CommandRunnerLive`, `ToolInstallerLive`, `GlobLive`,
  `OctokitAuthAppLive`, `OidcTokenIssuerLive`).
- `Layer.effect` — every layer that yields other services (all Tier 2 GitHub-API
  layers yield `GitHubClient`).
- Namespace object — only `GitHubClientLive`, because construction chooses the
  client identity: `fromEnv()` (ambient `GITHUB_TOKEN`, fails when unset — note
  it is a **function**), `fromToken(token)` (no failure channel),
  `fromApp({ clientId, privateKey, installationId? })` (scoped; revokes on
  scope close). For a token shared across pre/main/post use the `GitHubToken`
  namespace instead.
- Two Live layers are **functions returning layers** because they take
  construction input: `DryRunLive(enabled: boolean)` and
  `TokenPermissionCheckerLive(permissions)`.

## The graph

```text
Tier 0 — No service dependencies (Node.js built-ins / native APIs):
  ActionLogger, ActionEnvironment, CommandRunner, ToolInstaller, DryRun,
  OidcTokenIssuer, Glob,
  GithubMarkdown, SemverResolver, ErrorAccumulator, ReportBuilder,
  RegistryClassifier                      (pure namespaces, no layer at all)

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
  PackagePublish            <- CommandRunner + NpmRegistry + ActionOutputs
  AutoMerge (utility)       <- GitHubGraphQL
```

Test layers for every Tier 2 service do NOT depend on `GitHubClient` — they
operate entirely in-memory.

## Load-bearing layer behavior

- **`ActionLoggerLive`** — active buffer lives in a module-level
  `FiberRef<BufferState | null>` shared by `withBuffer` and `group`.
  `withBuffer` flushes on *every* exit (success, failure, interruption) via
  `Effect.onExit`; a failing group flushes its buffered diagnostics inside the
  group before `::endgroup::` and clears them, so each buffered chunk prints
  exactly once. Buffering is bypassed entirely when
  `process.env.RUNNER_DEBUG === "1"`.
- **`RateLimiterLive`** — reads rate-limit headers cached in a shared internal
  `RateLimitState` `Ref` written by `GitHubClient` on each response; no
  pre-flight `GET /rate_limit`. `RateLimitState` is not in the public barrel.
- **`ActionCacheLive`** — V2 Twirp cache protocol + Azure Blob upload/download;
  Twirp calls retry with backoff on 5xx/network.
- **`CommandRunnerLive` / `ToolInstallerLive`** — carry Windows-specific
  hardening (cmd.exe arg escaping, PowerShell zip extraction); read the files
  before changing exec behavior.

## Attestation stack composition

```typescript
const AttestationLayer = Layer.provide(
 AttestLive,
 Layer.mergeAll(SigstoreSignerLive, OidcTokenIssuerLive, GitHubClientLive.fromEnv(), SbomLive),
);
```
