# Service catalog — @savvy-web/github-action-effects

> Distilled from `@savvy-web/github-action-effects@3.0.4` source (barrel:
> `src/index.ts`, shapes: `src/services/*.ts`, layers: `src/layers/*.ts`) and
> production actions built on this stack, 2026-07-23. On version skew the
> installed source wins — the barrel `src/index.ts` is the authoritative
> inventory; re-verify before relying on this.

Two entry points only: the root (everything) and `./testing` (everything
minus runtime-only symbols — see `testing-actions`). 39 public services,
each `class X extends Context.Service<X, XShape>()("github-action-effects/X")`
with a companion `XShape` interface, a `XLive` layer and (almost always) a
`XTest` layer.

**Auto-provided by `Action.run` / `ActionsRuntime.Default`:** ActionLogger,
ActionOutputs, ActionEnvironment, ActionState, plus the `ActionsConfigProvider`
ConfigProvider, the `ActionsLogger` Logger, `FetchHttpClient.layer` (from
`effect/unstable/http`) and `NodeFileSystem.layer`. Everything else you wire
via `Action.run(program, { layer })`.

## Core runtime services

| Service | Provides | Reach for it when | Key APIs | Error | Live requires |
| --- | --- | --- | --- | --- | --- |
| `ActionLogger` | groups, buffered transcripts, notices | structured logging beyond `Effect.log*` | `group(name, effect)`, `withBuffer(label, effect)`, `notice(message, props?)` | — | none |
| `ActionOutputs` | outputs, step summary, env, PATH, masking, failure | writing anything back to the workflow | `set`, `setJson(name, value, schema)`, `summary(md)` (appends to `GITHUB_STEP_SUMMARY`), `exportVariable`, `addPath`, `setFailed`, `setSecret` | `ActionOutputError` | `FileSystem` |
| `ActionState` | Schema-serialized pre/main/post state | cross-phase data | `save(key, value, schema)`, `get(key, schema)`, `getOptional(key, schema) → Option` | `ActionStateError` | `FileSystem` |
| `ActionEnvironment` | typed env + webhook context | reading `GITHUB_*`/`RUNNER_*`/event payload | `get`, `getOptional`, `github`, `runner`, `isDebug`, `payload`, `repo`, `issue` | `ActionEnvironmentError` | none (`payload`/`repo`/`issue` need `FileSystem` in R) |

## GitHub API services

| Service | Provides | Reach for it when | Key APIs | Error | Live requires |
| --- | --- | --- | --- | --- | --- |
| `GitHubClient` | Octokit REST/GraphQL + pagination + retry/resilience | any raw GitHub API call | `rest(op, fn)`, `graphql(query, vars?)`, `paginate(op, fn, opts?)`, `paginateStream(...) → Stream`, `repo` | `GitHubClientError` | constructors: `GitHubClientLive.fromEnv()` (reads `GITHUB_TOKEN` — call it, it's a function), `.fromToken(Redacted, res?)`, `.fromApp({clientId, privateKey, installationId?}, res?)` (scoped; revokes on close; needs `HttpClient`) |
| `GitHubApp` | App auth lifecycle | minting/revoking installation tokens directly | `generateToken(appId, pk, installationId?)`, `revokeToken`, `resolveAppIdentity`, `botIdentity(source?)` (pure), `withToken` (bracket) | `GitHubAppError` | `OctokitAuthApp` + `HttpClient` |
| `OctokitAuthApp` | `@octokit/auth-app` wrapper | only as the layer under `GitHubAppLive` | `createAppAuth({appId, privateKey})` | — | none |
| `CheckRun` | check-run CRUD + annotations | inline PR feedback / status checks | `create(name, headSha)`, `get`, `update(id, output)`, `complete(id, conclusion, output?)`, `withCheckRun(name, sha, fn)` (bracket: success/failure auto-complete) | `CheckRunError` | `GitHubClient` |
| `PullRequest` | full PR lifecycle | creating/merging/labeling PRs | `get`, `list`, `listFiles`, `listAssociatedWithCommit`, `create`, `update`, `getOrCreate`, `merge`, `addLabels`, `requestReviewers` | `PullRequestError` | `GitHubClient` + `GitHubGraphQL` |
| `PullRequestComment` | sticky/upsert PR comments | bot comment that updates in place | `create(pr, body)`, `upsert(pr, markerKey, body)` (hidden `<!-- savvy-web:key -->`), `find(pr, markerKey) → Option`, `delete` | `PullRequestCommentError` | `GitHubClient` |
| `GitHubGraphQL` | typed GraphQL | node-ID work, auto-merge | `query(op, gql, vars?)`, `mutation(op, gql, vars?)` | `GitHubGraphQLError` | `GitHubClient` |
| `GitHubIssue` | issues + PR→issue links | issue automation | `list`, `get`, `close(n, reason?)`, `comment`, `getLinkedIssues(prNumber)` | `GitHubIssueError` | `GitHubClient` + `GitHubGraphQL` |
| `GitHubRelease` | releases + assets | release automation | `create`, `uploadAsset`, `getByTag`, `list`, `updateRelease`, `listReleaseAssets` | `GitHubReleaseError` | `GitHubClient` |
| `GitHubContent` | read a file at a ref | reading repo config remotely | `getFile(path, ref?)` | `GitHubContentError` | `GitHubClient` |
| `GitHubCommit` | **read** commit graph (REST) | history / diffs / changed files | `get(ref)`, `list(ref)`, `compare(base, head)`, `changedFiles(ref)` | `GitHubCommitError` | `GitHubClient` |
| `WorkflowDispatch` | trigger + poll workflows | cross-workflow orchestration | `dispatch(workflow, ref, inputs?)`, `dispatchAndWait`, `getRunStatus` | `WorkflowDispatchError` | `GitHubClient` |
| `RateLimiter` | quota guard + retry | long API-heavy scans | `checkRest`, `checkGraphQL`, `withRateLimit(effect)`, `withRetry(effect, opts?)` | `RateLimitError` | `GitHubClient` |
| `TokenPermissionChecker` | scope verification | fail fast on missing scopes | `check(reqs)`, `assertSufficient`, `assertExact`, `warnOverPermissioned` | `TokenPermissionError` | `TokenPermissionCheckerLive(permissions)` — a **function** returning a layer |
| `GitHubArtifactMetadata` | GH Packages storage record | link attestation ↔ published artifact | `createStorageRecord(input) → number[]` | `GitHubArtifactMetadataError` | `GitHubClient` |

**Confusable pair:** `GitHubCommit` READS commits via REST; `GitCommit`
WRITES commits via the Git Data API (below).

## Git Data API (write) services

| Service | Provides | Key APIs | Error | Live requires |
| --- | --- | --- | --- | --- |
| `GitCommit` | verified commits via Git Data API | `createTree(entries, baseTree?)`, `createCommit(msg, treeSha, parents)`, `updateRef(ref, sha, force?)`, `commitFiles(branch, msg, files)` | `GitCommitError` | `GitHubClient` |
| `GitBranch` | branch CRUD | `create`, `exists`, `delete`, `getSha`, `reset` | `GitBranchError` | `GitHubClient` |
| `GitTag` | tag CRUD | `create(tag, sha)`, `delete`, `list(prefix?)`, `resolve(tag)` | `GitTagError` | `GitHubClient` |

## Build / publish / workspace services

| Service | Provides | Key APIs | Error | Live requires |
| --- | --- | --- | --- | --- |
| `CommandRunner` | child-process exec | `exec`, `execCapture → {exitCode, stdout, stderr}`, `execJson(cmd, args, schema)`, `execLines` | `CommandRunnerError` | none |
| `NpmRegistry` | registry queries | `getLatestVersion`, `getDistTags`, `getPackageInfo`, `getVersions`, `getPublishedIntegrity` | `NpmRegistryError` | `CommandRunner` |
| `PackagePublish` | pack/probe/publish chain | `setupAuth`, `pack → PackResult`, `publish`, `publishTarball`, `verifyIntegrity`, `publishToRegistries`, `publishIdempotent` (deprecated), `dryRun` | `PackagePublishError` | `CommandRunner` + `NpmRegistry` + `ActionOutputs` |
| `PackageManagerAdapter` | npm/pnpm/yarn/bun abstraction | `detect`, `install`, `getCachePaths`, `getLockfilePaths`, `exec` | `PackageManagerError` | `CommandRunner` + `FileSystem` |
| `WorkspaceDetector` | monorepo introspection | `detect → WorkspaceInfo`, `listPackages`, `getPackage` | `WorkspaceDetectorError` | `FileSystem` + `CommandRunner` |
| `ChangesetAnalyzer` | changeset files | `parseAll(dir?)`, `hasChangesets`, `generate(packages, summary, dir?)` | `ChangesetError` | `FileSystem` |
| `ConfigLoader` | JSON/JSONC/YAML + Schema | `loadJson(path, schema)`, `loadJsonc`, `loadYaml`, `exists` | `ConfigLoaderError` | `FileSystem` |
| `ToolInstaller` | `@actions/tool-cache` parity | `find → Option`, `download`, `extractTar`, `extractZip`, `cacheDir`, `cacheFile` | `ToolInstallerError` | none |
| `Glob` | `@actions/glob` parity | `glob(patterns, opts?)`, `hashFiles(patterns, opts?) → Option<string>` (SHA-256 hash-of-hashes) | `GlobError` | none |
| `DryRun` | mutation interception | `isDryRun`, `guard(label, effect, fallback)` | — | `DryRunLive(enabled)` — a **function** |

## Storage / attestation services

| Service | Provides | Key APIs | Error | Live requires |
| --- | --- | --- | --- | --- |
| `ActionCache` | GH Actions cache (V2 Twirp + Azure Blob) | `save(paths, key)`, `restore(paths, primaryKey, restoreKeys?) → Option<matchedKey>` | `ActionCacheError` | `HttpClient` |
| `Artifact` | `@actions/artifact` v2 parity | `uploadArtifact`, `listArtifacts`, `getArtifact → Option`, `downloadArtifact`, `deleteArtifact` | `ArtifactError` | `HttpClient` |
| `BlobStore` | key→bytes store | `get → Option<Uint8Array>`, `put`, `has` | `BlobStoreError` | `GitHubBlobStoreLive` (`HttpClient`) or `S3BlobStoreLive(config)` (SigV4, no aws-sdk) |
| `OidcTokenIssuer` | runner OIDC ID tokens | `getToken(audience?) → Redacted` | `OidcTokenError` | `HttpClient`; needs `id-token: write` |
| `SigstoreSigner` | sign in-toto statements | `signStatement(statement) → SigstoreBundle` (requires `OidcTokenIssuer` in R) | `SigstoreSignerError` | `SigstoreSignerLive` / `makeSigstoreSignerLive(config)` |
| `Sbom` | CycloneDX BOM | `generate(input)`, `serializeJson`, `save` | `SbomError` | `FileSystem` |
| `Attest` | full attest+upload | `buildStatement`, `save`, `buildBundle`, `attest`, `provenance`, `sbom`, `listForSubject(sha256, {predicateType?})` (idempotent recovery) | `AttestError` | `AttestLive` over `SigstoreSigner` + `OidcTokenIssuer` + `GitHubClient` (+ `Sbom` for `sbom`) |

## Namespaces & utilities (not injected — plain imports)

| Name | Provides | Key APIs |
| --- | --- | --- |
| `Action` | entry-point boilerplate | `Action.run(program, {layer?})` (catches every Cause, `::error::` + exit 1), `formatCause`, `resolveLogLevel` |
| `Step` | step-buffered logging (✅/❌) | `withStep(name, effect, opts?)`, `success(line)`, `failure(line)`, `line(icon, text)`, `collapse(steps, reducer)`, `groupStep(name, effect, opts?)` |
| `GitHubToken` | App installation token across pre/main/post | `provision(opts?)`, `client()` (Layer), `read()`, `botIdentity()`, `dispose()` — see `github-app-auth` |
| `ActionInput` | GitHub-faithful Config combinators | `boolean(name)` (YAML 1.2 truth set), `multiline(name)` |
| `ActionsRuntime` / `ActionsConfigProvider` / `ActionsLogger` | the default layer bundle and its pieces | `ActionsRuntime.Default`; provider/logger values for manual wiring |
| `GithubMarkdown` | pure GFM builders | `table`, `heading`, `details`, `rule`, `statusIcon`, `link`, `list`, `checklist`, `bold`, `code`, `codeBlock`, `image`, `quote` |
| `ReportBuilder` | one report → three sinks | `create(title)` → `.stat`, `.section`, `.details`, then `.toMarkdown()` / `.toSummary()` / `.toComment(pr, key)` / `.toCheckRun(id)` |
| `ErrorAccumulator` | non-short-circuiting batches | `forEachAccumulate(items, fn)`, `forEachAccumulateConcurrent(items, fn, n)` → `{successes, failures}` |
| `AutoMerge` | PR auto-merge GraphQL | `enable(nodeId, method?)`, `disable(nodeId)` (requires `GitHubGraphQL`) |
| `SemverResolver` | semver math | `compare`, `satisfies`, `latestInRange`, `increment`, `parse` (errors: `SemverResolverError`) |
| `IoUtil` | `@actions/io` `which` parity | `which`, `whichOrFail`, `findInPath` (require `FileSystem`; errors: `IoError`) |
| `PathUtils` | path normalization | `toPosixPath`, `toWin32Path`, `toPlatformPath` |
| RegistryClassifier helpers | npm registry identity | `getRegistryType`, `isNpmRegistry`, `isJsrRegistry`, `isGitHubPackagesRegistry`, `isCustomRegistry`, `getRegistryDisplayName`, `generatePackageViewUrl`, type `RegistryType` |
| slsa / intoto helpers | provenance predicates | `decodeJwtClaims`, `buildSLSAProvenancePredicate`, `GITHUB_BUILD_TYPE`; `buildStatement`, `npmPurl`, `serializeStatement`, `subject` |

## Layer dependency tiers (wire lower tiers first)

```text
Tier 0 (no deps): ActionLogger, ActionEnvironment, CommandRunner, ToolInstaller,
                  DryRun(enabled), Glob, OctokitAuthApp, GitHubClient constructors
Tier 0.5 (platform): ActionOutputs/ActionState/Sbom ← FileSystem;
                  ActionCache/Artifact/BlobStore/OidcTokenIssuer ← HttpClient
Tier 1:           GitHubApp ← OctokitAuthApp + HttpClient; NpmRegistry ← CommandRunner;
                  ChangesetAnalyzer/ConfigLoader ← FileSystem;
                  TokenPermissionCheckerLive(permissions); SigstoreSigner ← OidcTokenIssuer
Tier 2 (← GitHubClient): CheckRun, PullRequestComment, GitHubGraphQL, GitBranch,
                  GitCommit, GitTag, GitHubRelease, GitHubContent, GitHubCommit,
                  RateLimiter, WorkflowDispatch, GitHubArtifactMetadata, Attest;
                  GitHubIssue + PullRequest ← GitHubClient + GitHubGraphQL
Tier 2 (other):   PackageManagerAdapter ← CommandRunner + FileSystem;
                  WorkspaceDetector ← FileSystem + CommandRunner
Tier 3:           PackagePublish ← CommandRunner + NpmRegistry + ActionOutputs
```

`ActionsRuntime.Default` supplies `FileSystem` (NodeFileSystem) and
`HttpClient` (FetchHttpClient from `effect/unstable/http`), so Tier-0.5
services only need their Live layer added to `Action.run`'s `options.layer`.
