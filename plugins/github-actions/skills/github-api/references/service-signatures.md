# GitHub API services — signatures

> Distilled from `@savvy-web/github-action-effects@3.0.4` source
> (`src/services/*.ts`, `src/layers/*.ts`) and production actions built on
> this stack, 2026-07-23. On version skew the installed source wins —
> re-verify before relying on this. Layers follow the `<Service>Live` naming;
> unless noted, each Live layer requires `GitHubClient`.

## GitHubClient (`services/GitHubClient.ts`)

```typescript
rest: <T>(operation: string, fn: (octokit: unknown) => Promise<{ data: T }>)
 => Effect<T, GitHubClientError>
graphql: <T>(query: string, variables?: Record<string, unknown>)
 => Effect<T, GitHubClientError>
paginate: <T>(operation, fn: (octokit, page, perPage) => Promise<{ data: T[] }>,
 options?: { perPage?: number; maxPages?: number }) => Effect<Array<T>, GitHubClientError>
paginateStream: <T>(operation, fn, options?) => Stream<T, GitHubClientError>
repo: Effect<{ owner: string; repo: string }, GitHubClientError>   // from GITHUB_REPOSITORY
```

Error: `GitHubClientError { operation, status?, reason, retryable, retryAfterMs? }`.

Constructors (`layers/GitHubClientLive.ts`):

```typescript
GitHubClientLive.fromEnv(resilience?): Layer<GitHubClient, GitHubClientError>
GitHubClientLive.fromToken(token: Redacted<string>, resilience?): Layer<GitHubClient>
GitHubClientLive.fromApp(
 { clientId: string; privateKey: Redacted<string>; installationId?: number },
 resilience?,
): Layer<GitHubClient, GitHubAppError, HttpClient>   // scoped: revokes on close
```

`ResilienceOptions { enabled?: boolean; maxRetries?: number; baseDelay?: Duration.Input; maxDelay?: Duration.Input }`
— defaults `true` / `4` / `1s` / `30s`.
`resilienceSchedule(options?) → { schedule, times, while }` for standalone
`Effect.retry` (no `retryAfterMs` honoring, multiplicative jitter).

## GitHubGraphQL (`services/GitHubGraphQL.ts`)

```typescript
query:    <T>(operation: string, query: string, variables?) => Effect<T, GitHubGraphQLError>
mutation: <T>(operation: string, mutation: string, variables?) => Effect<T, GitHubGraphQLError>
```

Error carries `errors: Array<{ message, type? }>` from the GraphQL response.

## PullRequest (`services/PullRequest.ts`) — Live needs GitHubClient + GitHubGraphQL

```typescript
get: (number) => Effect<PullRequestInfo, PullRequestError>
list: (options?: { head?; base?; state?: "open" | "closed" | "all"; perPage?; paginate? })
 => Effect<ReadonlyArray<PullRequestInfo>, PullRequestError>
listFiles: (number) => Effect<Array<PullRequestFile>, PullRequestError>
listAssociatedWithCommit: (sha) => Effect<Array<PullRequestInfo>, PullRequestError>
create: ({ title, body, head, base, draft?, autoMerge?: "merge" | "squash" | "rebase" | false })
 => Effect<PullRequestInfo, PullRequestError>
update: (number, { title?; body?; state?: "open" | "closed"; autoMerge? })
 => Effect<PullRequestInfo, PullRequestError>
getOrCreate: ({ head, base, title, body, draft?, autoMerge? })
 => Effect<PullRequestInfo & { created: boolean }, PullRequestError>
merge: (number, { method?: "merge" | "squash" | "rebase"; commitTitle?; commitMessage? })
 => Effect<..., PullRequestError>
addLabels: (number, labels: ReadonlyArray<string>) => Effect<void, PullRequestError>
requestReviewers: (number, { reviewers?; teamReviewers? }) => Effect<..., PullRequestError>
```

`PullRequestInfo` includes `number`, `nodeId` (for GraphQL auto-merge),
`html_url`-style url, `mergedAt?`, `body?`, `mergeCommitSha?`, `baseSha?`.
`getOrCreate` applies `draft` only on the create path.

## GitHubIssue (`services/GitHubIssue.ts`) — Live needs GitHubClient + GitHubGraphQL

```typescript
list: (options?: { state?; labels?; milestone?; perPage?; maxPages? })
 => Effect<..., GitHubIssueError>
get: (issueNumber) => Effect<IssueData, GitHubIssueError>
close: (issueNumber, reason?: "completed" | "not_planned") => Effect<void, GitHubIssueError>
comment: (issueNumber, body) => Effect<{ id: number }, GitHubIssueError>
getLinkedIssues: (prNumber) => Effect<..., GitHubIssueError>   // GraphQL under the hood
```

## GitHubRelease (`services/GitHubRelease.ts`)

```typescript
create: ({ tag, name, body, draft?, prerelease?, generateReleaseNotes? })
 => Effect<ReleaseData, GitHubReleaseError>       // ReleaseData has id, uploadUrl, htmlUrl
uploadAsset: (releaseId, name, data, contentType) => Effect<..., GitHubReleaseError>
getByTag: (tag) => Effect<ReleaseData, GitHubReleaseError>
list: (options?: { perPage?; maxPages? }) => Effect<..., GitHubReleaseError>
updateRelease: (releaseId, { body?; name?; draft?; prerelease? }) => Effect<..., GitHubReleaseError>
listReleaseAssets: (releaseId) => Effect<Array<ReleaseAsset>, GitHubReleaseError>
```

`GitHubReleaseError` carries `retryable`.

## GitHubContent (`services/GitHubContent.ts`)

```typescript
getFile: (path: string, ref?: string) => Effect<string, GitHubContentError>
```

## GitHubCommit — READ (`services/GitHubCommit.ts`)

```typescript
get: (ref) => Effect<CommitDetail, GitHubCommitError>
list: (ref) => Effect<ReadonlyArray<CommitSummary>, GitHubCommitError>
compare: (base, head) => Effect<CommitComparison, GitHubCommitError>
changedFiles: (ref) => Effect<ReadonlyArray<CommitFile>, GitHubCommitError>
```

## GitCommit — WRITE, Git Data API (`services/GitCommit.ts`)

```typescript
createTree: (entries: Array<TreeEntry>, baseTree?) => Effect<string, GitCommitError>   // → tree sha
createCommit: (message, treeSha, parents) => Effect<string, GitCommitError>            // → commit sha
updateRef: (ref, sha, force?) => Effect<void, GitCommitError>
commitFiles: (branch, message, files: Array<FileChange>) => Effect<..., GitCommitError>
```

`FileChange` / `TreeEntry` schemas (content or deletion variants) live in
`schemas/GitTree.ts`. Commits are App-verified when the client authenticates
as an App.

## GitBranch (`services/GitBranch.ts`)

```typescript
create: (name, sha) => Effect<void, GitBranchError>
exists: (name) => Effect<boolean, GitBranchError>
delete: (name) => Effect<void, GitBranchError>
getSha: (name) => Effect<string, GitBranchError>
reset: (name, sha) => Effect<void, GitBranchError>
```

## GitTag (`services/GitTag.ts`)

```typescript
create: (tag, sha) => Effect<void, GitTagError>
delete: (tag) => Effect<void, GitTagError>
list: (prefix?) => Effect<Array<TagRef>, GitTagError>
resolve: (tag) => Effect<string, GitTagError>
```

## WorkflowDispatch (`services/WorkflowDispatch.ts`)

```typescript
dispatch: (workflow, ref, inputs?: Record<string, string>) => Effect<void, WorkflowDispatchError>
dispatchAndWait: (workflow, ref, inputs?, pollOptions?: { intervalMs?; timeoutMs? })
 => Effect<string, WorkflowDispatchError>    // → run conclusion
getRunStatus: (runId: number) => Effect<WorkflowRunStatus, WorkflowDispatchError>
```

## RateLimiter (`services/RateLimiter.ts`)

```typescript
checkRest: () => Effect<RateLimitStatus, GitHubClientError>
checkGraphQL: () => Effect<RateLimitStatus, GitHubClientError>
withRateLimit: <A, E, R>(effect) => Effect<A, E | RateLimitError, R>
withRetry: <A, E, R>(effect, options?: { maxRetries?: number; baseDelay?: number })
 => Effect<A, E | ..., R>
```

Reads the shared `RateLimitState` snapshot the client populates from
response headers.

## GitHubArtifactMetadata (`services/GitHubArtifactMetadata.ts`)

```typescript
createStorageRecord: (input: StorageRecordInput) => Effect<ReadonlyArray<number>, GitHubArtifactMetadataError>
```

`StorageRecordInput` includes `registryUrl`, `artifactUrl` and attestation
linkage fields; error carries `retryable`.

## Error tags (all `Data.TaggedError`, one file each under `src/errors/`)

`GitHubClientError`, `GitHubGraphQLError`, `PullRequestError`,
`GitHubIssueError`, `GitHubReleaseError`, `GitHubContentError`,
`GitHubCommitError`, `GitCommitError`, `GitBranchError`, `GitTagError`,
`WorkflowDispatchError`, `RateLimitError`, `GitHubArtifactMetadataError`,
`GitHubAppError`, `TokenPermissionError`. All carry `operation` (or
equivalent discriminant) + `reason`; retry-relevant ones add `retryable`.
