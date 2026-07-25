# Error taxonomy — @savvy-web/github-action-effects

> Distilled from `@savvy-web/github-action-effects@3.0.5` source
> (`src/errors/*.ts`), 2026-07-24. Field shapes are verbatim from source. On
> version skew the installed source wins — re-verify before relying on this.

41 tagged errors, one per file, all `Data.TaggedError("Tag")<{...}>`
directly — no base class. All are exported from both the root and
`/testing` entry points.

**Boundary contract:** you never write top-level error handling.
`Action.run` catches every `Cause`, formats `[Tag] message` via
`Action.formatCause` (fallback chain: `Cause.squash` → tag + `message ||
reason` → `Cause.pretty` → generic; note `||`, so an empty `message` falls
through to `reason`), emits one `::error::` annotation (newlines
`%0A`-encoded so multiline messages stay in a single annotation), and sets
`process.exitCode = 1`. `outputs.setFailed(msg)` is the explicit-failure
path that does not fail the effect.

## Field shapes

| Tag | Fields |
| --- | --- |
| `ActionCacheError` | `key`, `operation: "save" \| "restore"`, `reason` |
| `ActionEnvironmentError` | `variable`, `reason` |
| `ActionInputError` | `inputName`, `reason`, `rawValue: string \| undefined` |
| `ActionOutputError` | `outputName`, `reason` |
| `ActionStateError` | `key`, `reason`, `rawValue: string \| undefined` |
| `ArtifactError` | `operation: "upload" \| "download" \| "list" \| "get" \| "delete"`, `artifact`, `reason`, `retryable?: boolean` |
| `AttestError` | `reason: "build" \| "save" \| "oidc" \| "sign" \| "upload"`, `message`, `cause?` |
| `BlobStoreError` | `key`, `operation: "get" \| "put" \| "has"`, `reason` |
| `ChangesetError` | `operation: "parse" \| "generate" \| "read"`, `reason` |
| `CheckRunError` | `name`, `operation: "create" \| "update" \| "complete" \| "get"`, `reason` |
| `CommandRunnerError` | `command`, `args: ReadonlyArray<string>`, `exitCode: number \| undefined`, `stderr: string \| undefined`, `stdout?: string \| undefined`, `reason` |
| `ConfigLoaderError` | `path`, `operation: "read" \| "parse" \| "validate"`, `reason` |
| `GitBranchError` | `branch`, `operation: "create" \| "delete" \| "get" \| "reset"`, `reason`, `status?: number`, `alreadyExists?: boolean` |
| `GitCommitError` | `operation: "tree" \| "commit" \| "ref"`, `reason` |
| `GitHubAppError` | `operation: "jwt" \| "token" \| "revoke" \| "identity"`, `reason` |
| `GitHubArtifactMetadataError` | `operation: "createStorageRecord"`, `reason`, `retryable: boolean` |
| `GitHubClientError` | `operation`, `status: number \| undefined`, `reason`, `retryable: boolean`, `retryAfterMs: number \| undefined` |
| `GitHubCommitError` | `operation: "get" \| "list" \| "compare" \| "changedFiles"`, `ref?`, `reason` |
| `GitHubContentError` | `operation: "getFile"`, `path?`, `reason` |
| `GitHubGraphQLError` | `operation`, `reason`, `errors: ReadonlyArray<{message, type?}>` |
| `GitHubIssueError` | `operation: "list" \| "close" \| "comment" \| "getLinkedIssues" \| "get"`, `issueNumber?`, `reason`, `retryable: boolean` |
| `GitHubReleaseError` | `operation: "create" \| "uploadAsset" \| "getByTag" \| "list" \| "updateRelease" \| "listReleaseAssets"`, `tag?`, `reason`, `retryable: boolean` |
| `GitTagError` | `operation: "create" \| "delete" \| "list" \| "resolve"`, `tag?`, `reason` |
| `GlobError` | `operation: "glob" \| "hashFiles"`, `patterns`, `reason` |
| `IoError` | `operation: "which" \| "findInPath"`, `tool`, `reason` |
| `NpmRegistryError` | `pkg`, `operation: "view" \| "search" \| "versions"`, `reason` |
| `OidcTokenError` | `reason: "env" \| "http" \| "decode" \| "save"`, `message`, `cause?` |
| `PackageManagerError` | `pm: string \| undefined`, `operation: "detect" \| "install" \| "cache" \| "exec"`, `reason` |
| `PackagePublishError` | `operation: "setupAuth" \| "pack" \| "publish" \| "publishTarball" \| "verifyIntegrity" \| "publishToRegistries" \| "publishIdempotent" \| "dryRun"`, `pkg?`, `registry?`, `reason`, `cause?` |
| `PullRequestCommentError` | `prNumber`, `operation: "create" \| "upsert" \| "find" \| "delete"`, `reason` |
| `PullRequestError` | `operation: "get" \| "list" \| "listFiles" \| "listAssociatedWithCommit" \| "create" \| "update" \| "getOrCreate" \| "merge" \| "addLabels" \| "requestReviewers" \| "autoMerge"`, `prNumber?`, `reason` |
| `RateLimitError` | `api: "rest" \| "graphql"`, `remaining: number`, `resetAt: string`, `reason` |
| `RuntimeEnvironmentError` | `variable`, `message` |
| `SbomError` | `reason: "build" \| "serialize" \| "save"`, `message`, `cause?` |
| `SemverResolverError` | `operation: "compare" \| "satisfies" \| "latestInRange" \| "increment" \| "parse"`, `version`, `reason` |
| `SigstoreSignerError` | `reason: "sign" \| "witness" \| "bundle"`, `message`, `cause?` |
| `SlsaError` | `reason: "decode" \| "claims" \| "env"`, `message`, `cause?` |
| `TokenPermissionError` | `missing: Array<{permission, required, granted?}>`, `extra?: Array<{permission, level}>`, `reason` |
| `ToolInstallerError` | `tool`, `version`, `operation: "download" \| "extract" \| "cache" \| "path" \| "chmod"`, `reason`, `statusCode?: number \| undefined` |
| `WorkflowDispatchError` | `workflow`, `operation: "dispatch" \| "poll" \| "poll-pending" \| "status"`, `reason` |
| `WorkspaceDetectorError` | `operation: "detect" \| "list" \| "get"`, `reason` |

`GitBranchError.alreadyExists` is `true` when the underlying GitHub API
failure was a 422/409 response whose reason names an existing reference —
match on it in a `catchTag`/`catchIf` to detect a benign create-race
collision directly, without a second API round-trip to re-query branch
state.

## Retryability

`GitHubClientError.retryable` is set by the resilience wrapper: 429, ≥500,
or 403 **with** a server retry hint (`Retry-After`, or
`x-ratelimit-remaining: 0` + reset) are retryable; bare 403/404/422 fail
fast. `ArtifactError`, `GitHubIssueError`, `GitHubReleaseError` and
`GitHubArtifactMetadataError` carry their own `retryable` flags. Action-side
error classes in the house style add derived predicates (`isRateLimited`,
`isRetryable`) — see `errors-and-state`.
