# Test-layer state shapes

> Distilled from `@savvy-web/github-action-effects@3.0.4` source
> (`src/layers/*Test.ts`) and production actions built on this stack,
> 2026-07-23. On version skew the installed source wins — re-verify before
> relying on this.

All exported from `@savvy-web/github-action-effects/testing`. Factory shape
legend: **S** = `empty(): State` + `layer(state)`; **L** = `empty(): Layer`;
**SL** = `empty(): { state, layer }`; **C** = plain Layer const / `make*`
factory.

## Core runtime layers

| Layer | Shape | State fields |
| --- | --- | --- |
| `ActionOutputsTest` | S | `outputs: CapturedOutput[]` (`{name, value}`), `summaries: string[]`, `variables: CapturedOutput[]`, `paths: string[]`, `secrets: string[]`, `failed: string[]` |
| `ActionLoggerTest` | S | `entries: {level, message}[]`, `groups: {name, entries}[]`, `flushedBuffers: {label, entries: string[]}[]`, `notices: {message, properties?}[]` |
| `ActionStateTest` | S | `entries: Map<string, string>` (key → encoded JSON). Pre-populate to simulate a prior phase; `GitHubToken` persists under `"github-action-effects/installation-token"` |
| `ActionEnvironmentTest` | **L** | `layer(env: Record<string,string>, payload?: WebhookPayload)` builds contexts from `GITHUB_*`/`RUNNER_*` keys over baked-in defaults (`owner/repo`, sha `abc1234567890def`, event `push`, Linux runner); `RUNNER_DEBUG === "1"` drives `isDebug`. `empty()` = defaults, `get` always fails, `issue` fails (no number seeded) |
| `ActionCacheTest` | S | `entries: Map<string, ReadonlyArray<string>>` (key → cached paths) |

## GitHub API layers

| Layer | Shape | State fields |
| --- | --- | --- |
| `GitHubClientTest` | **L** | `layer(state: GitHubClientTestState)`: `restResponses: Map<operation, {data}>`, `graphqlResponses: Map<query, unknown>`, `paginateResponses: Map<operation, Array<unknown[]>>` (array of pages), `repo: {owner, repo}`. `empty()` = no stubs + `test-owner/test-repo`. **Every un-stubbed call fails `GitHubClientError`**; the octokit callback is never invoked |
| `GitHubAppTest` | S | `generateCalls: {appId, privateKey, installationId?}[]`, `revokeCalls: Redacted[]`, `tokenToReturn: InstallationToken`, `appIdentity?: {appSlug, appUserId, appName}`. `empty()` seeds token `ghs_test_token_123` AND `appIdentity` (`test-app`/99999/`Test App`); **omit `appIdentity` to make `resolveAppIdentity` fail** and exercise provision degradation. `withToken` mints + revokes around the effect either way |
| `GitHubGraphQLTest` | **SL** | `queryResponses: Map<operation, unknown>`, `mutationResponses: Map<operation, unknown>`, `queryCalls` / `mutationCalls: {operation, query, variables?}[]` |
| `GitHubIssueTest` | **SL** | `issues: Map<number, IssueData>`, `comments: {issueNumber, body}[]`, `closeCalls: {issueNumber, reason?}[]`, `linkedIssues: Map<number, {number, title}[]>` |
| `GitHubReleaseTest` | **SL** | `releases: Map<tag, ReleaseData>`, `createCalls: {tag, name}[]`, `uploadCalls: {releaseId, name}[]`, `assets: Map<releaseId, ReleaseAsset[]>` (uploadAsset populates, listReleaseAssets reads) |
| `GitHubContentTest` | S | `files: Map<string, string>` keyed **`${ref ?? ""}:${path}`**, seeded with decoded text |
| `GitHubCommitTest` | S | `commits: Map<ref, CommitDetail>`, `commitLists: Map<ref, CommitSummary[]>`, `comparisons: Map<"base...head", CommitComparison>`, `changedFiles: Map<ref, CommitFile[]>` |
| `CheckRunTest` | S | `runs: CheckRunRecord[]` (`{id, name, headSha, htmlUrl, status, conclusion?, outputs: CheckRunOutput[]}`), `nextId: number` |
| `PullRequestTest` | S | `prs: PullRequestRecord[]`, `mergedPrs: number[]`, `nextNumber`, `files: Map<prNumber, PullRequestFile[]>`, `associatedByCommit: Map<sha, PullRequestInfo[]>` |
| `PullRequestCommentTest` | S | `comments: Map<prNumber, {id, body}[]>`, `nextId`. Marker semantics match Live: `upsert` finds by hidden marker substring |
| `RateLimiterTest` | S | `checkRestCalls` / `checkGraphQLCalls`, mutable `restStatus` / `graphqlStatus: RateLimitStatus` |
| `TokenPermissionCheckerTest` | S | `grantedPermissions: Record<string, string>`, `checkCalls: Record<string, PermissionLevel>[]` |
| `WorkflowDispatchTest` | S | `dispatches: DispatchRecord[]` (`{workflow, ref, inputs}`), `statuses: Map<runId, WorkflowRunStatus>`, mutable `waitConclusion` (default `"success"`) |
| `GitHubArtifactMetadataTest` | **SL** | `calls: StorageRecordInput[]`, `recordIds: ReadonlyArray<number>` (returned by createStorageRecord) |

## Git-object layers

| Layer | Shape | State fields |
| --- | --- | --- |
| `GitBranchTest` | S | `branches: Map<branch, sha>` |
| `GitCommitTest` | S | `trees: {entries, baseTree?, sha}[]`, `commits: {message, treeSha, parentShas, sha}[]`, `refUpdates: {ref, sha, force?}[]` |
| `GitTagTest` | **SL** | `tags: Map<tag, sha>`, `createCalls: {tag, sha}[]`, `deleteCalls: string[]` |

## Build / publish / workspace layers

| Layer | Shape | State fields |
| --- | --- | --- |
| `CommandRunnerTest` | **L** | `layer(responses: ReadonlyMap<string, CommandResponse>)` — key is the command string, value `{exitCode, stdout, stderr}`. `empty()` = empty map |
| `NpmRegistryTest` | **L** | `layer(state)`: `packages: Map<name, {versions, latest, distTags, integrity?, tarball?}>`. `empty()` = no packages |
| `PackagePublishTest` | **SL** (both `empty()` AND `layer(...)` return `{state, layer}`) | `packResult`, `integrityMatch`, `publishedVersions`, `dryRunOk`, plus recorded calls: `setupAuthCalls`, `packCalls`, `publishCalls`, `publishTarballCalls` (+`publishTarballProvenanceUrl?`), `verifyIntegrityCalls`, `publishToRegistriesCalls`, `publishIdempotentCalls`, `dryRunCalls` |
| `PackageManagerAdapterTest` | S | `info: PackageManagerInfo` (returned by detect), `execCalls: {args, options}[]`, `cachePaths: string[]` |
| `WorkspaceDetectorTest` | **L** | `layer(state)`: `info: WorkspaceInfo`, `packages: WorkspacePackage[]` |
| `ChangesetAnalyzerTest` | S | `changesets: Changeset[]` (parseAll source), `generated: ChangesetFile[]` (generate sink) |
| `ConfigLoaderTest` | S | `files: Map<path, string>` (raw content; loaders parse + schema-decode it) |
| `GlobTest` | S | `matches: Map<patterns, string[]>`, `hashes: Map<patterns, string>` |
| `ToolInstallerTest` | S | recorded `findCalls`/`downloadCalls`/`extractTarCalls`/`extractZipCalls`/`cacheDirCalls`/`cacheFileCalls` + `cachedTools: Map<"tool version", path>` (drives `find` hits) |
| `DryRunTest` | **SL** | `guardedLabels: string[]` — labels whose `guard` took the fallback |

## Storage / attestation layers

| Layer | Shape | State fields |
| --- | --- | --- |
| `BlobStoreTest` | S | `entries: Map<string, Uint8Array>` |
| `ArtifactTest` | S | `artifacts: Map<name, ArtifactItem>`, `uploaded: Map<name, files[]>`, `nextId` |
| `AttestTest` | **C** — `makeAttestTestState(overrides?)` + `AttestTest.layer(state)`; `AttestTestFullLayer(state?)` provides the whole stack | recorded `buildStatementCalls`/`buildBundleCalls`/`attestCalls`/`sbomCalls`/`provenanceCalls`/`listForSubjectCalls`, `saves: Map<path, statement\|bundle>`, `seedAttestations: Map<sha256, AttestationListEntry[]>` (drives listForSubject), `attestationId?`, `repo?`, **`failWith?: AttestError`** (every op fails with it) |
| `SbomTest` | **C** — `makeSbomTestState(overrides?)` + `SbomTest.layer(state)` | `generateCalls: SbomInput[]`, `saves: Map<path, CycloneDXBom>`, `bomResponse?`, `jsonResponse?` |
| `OidcTokenIssuerTest` | **C** — plain Layer const | stateless; `getToken` returns `Redacted("test-oidc-token")` |
| `SigstoreSignerTest` | **C** — plain Layer const | stateless; returns a synthetic `SigstoreBundle` with `sig: "test-signature"` |
