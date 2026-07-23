---
name: github-api
description: >
  Calling the GitHub API from actions built on
  @savvy-web/github-action-effects — the GitHubClient service
  (rest/graphql/paginate/paginateStream), the three GitHubClientLive
  constructors, the built-in resilience/retry policy, RateLimiter, and the
  derived services (PullRequest, GitHubRelease, GitBranch, GitCommit vs
  GitHubCommit, WorkflowDispatch, …). Verified against
  @savvy-web/github-action-effects@3.0.4. User-invokable as
  /github-actions:github-api.
when_to_use: >
  "call the GitHub API", "octokit", "GitHubClient", "fromEnv vs fromToken vs
  fromApp", "paginate", "rate limit", "secondary rate limit", "retry a 403",
  "create a release from an action", "create a branch/tag from an action",
  "verified commit", "commit files via the API", "trigger another workflow",
  "GraphQL from an action", "compare two refs"
---

# GitHub API from actions

All GitHub API traffic goes through the `GitHubClient` service — an Octokit
wrapper with typed errors, automatic retry/backoff, rate-limit header
tracking, and silenced per-request log noise. Higher-level derived services
(PR, release, branch, tag, …) sit on top; prefer them over raw `rest` calls
when one exists.

## Getting a client: three constructors

All live on the `GitHubClientLive` namespace
(`@savvy-web/github-action-effects` `src/layers/GitHubClientLive.ts`):

| Constructor | Signature | Use when | Error channel |
| --- | --- | --- | --- |
| `fromEnv(resilience?)` | **a function — call it** | read-only actions with the token-input bridge (see `github-app-auth`) | `GitHubClientError` if `GITHUB_TOKEN` unset |
| `fromToken(token, resilience?)` | takes `Redacted<string>` — wrap with `Redacted.make` | you already hold a token (this is what `GitHubToken.client()` uses) | `never` |
| `fromApp({clientId, privateKey, installationId?}, resilience?)` | scoped layer; requires `HttpClient` | single-phase programs authenticating as an App directly | `GitHubAppError` |

- `GitHubClientLive.fromEnv()` — the `()` matters; passing the namespace
  member without calling it wires nothing. It reads the **weak repo-scoped**
  `process.env.GITHUB_TOKEN`; not the path for permission-sensitive work.
- `fromApp` revokes its minted token on scope close. A plain
  `Effect.provide` is enough; add `Effect.scoped` + `Layer.memoize` only to
  share one token across several `Effect.provide`s
  (`src/layers/GitHubClientLive.ts:376-390` shows the pattern).
- In a three-phase action you almost never construct a client yourself —
  `GitHubToken.client()` builds it from the persisted installation token.

## The client surface

```typescript
const client = yield* GitHubClient;
const { owner, repo } = yield* client.repo;          // from GITHUB_REPOSITORY

// REST — the callback receives the real Octokit; narrow it yourself
const data = yield* client.rest("repos.get", (octokit) =>
 (octokit as Octokit).rest.repos.get({ owner, repo }),
);

// GraphQL
const result = yield* client.graphql<{ repository: { id: string } }>(
 `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }`,
 { owner, name: repo },
);

// Eager pagination — collects ALL pages (perPage default 100)
const all = yield* client.paginate("issues.list", (octokit, page, perPage) =>
 (octokit as Octokit).rest.issues.listForRepo({ owner, repo, page, per_page: perPage }),
 { maxPages: 10 },
);
```

The callback's `octokit` parameter is typed `unknown` — a deliberate seam so
the service interface does not export Octokit types. Cast at the call site.

**Early-terminating scans use `paginateStream`**, not `paginate` — the eager
form fetches every page before you can look at one:

```typescript
const recent = yield* client.paginateStream<{ number: number; closed_at: string | null }>(
 "listIssues",
 (octokit, page, perPage) =>
  (octokit as Octokit).rest.issues.listForRepo({ owner, repo, state: "all", page, per_page: perPage }),
).pipe(
 Stream.takeWhile((issue) => issue.closed_at === null || issue.closed_at > "2026-01-01"),
 Stream.runCollect,
);
```

## Resilience (on by default)

Every `rest`/`graphql`/`paginate` call is wrapped in `withResilience`
(`src/layers/resilience.ts:87-111`). Defaults: `maxRetries: 4`,
`baseDelay: 1s`, `maxDelay: 30s`, full-jitter exponential backoff.

Retryable (`src/layers/GitHubClientLive.ts:64-65`): **429**, **any 5xx**, and **403
only when the server advises a delay** (`Retry-After` header, or
`x-ratelimit-remaining: 0` + `x-ratelimit-reset`). A bare 403/404/422 fails
fast — a permission denial or validation error must not loop. A
server-advised `retryAfterMs` always beats the computed backoff.

Tune or disable per constructor: `fromEnv({ enabled: false })`,
`fromToken(token, { maxRetries: 2 })`.

`resilienceSchedule(options?)` is exported for standalone
`Effect.retry({ schedule, times, while })` use — but it differs from the
internal wrapper: it does **not** honor `retryAfterMs` and jitters
multiplicatively (`Schedule.jittered`), not full-jitter
(`src/layers/resilience.ts:38-44`). Use it for your own effects, not to re-wrap client
calls.

## RateLimiter

For API-heavy scans (hundreds of calls), provide `RateLimiterLive` (needs
`GitHubClient`) and use:

- `checkRest()` / `checkGraphQL()` — current quota status.
- `withRateLimit(effect)` — fails with `RateLimitError` instead of burning
  the last requests when the quota is nearly exhausted.
- `withRetry(effect, { maxRetries?, baseDelay? })` — retry wrapper that also
  respects observed rate-limit state.

The client records `x-ratelimit-*` headers from every response into a shared
snapshot when `RateLimitState` is in context; `RateLimiterLive` reads the
same snapshot, so checks are free (no extra API call) once traffic flows.

## Derived services — prefer these over raw `rest`

Each is a `Context.Service` whose Live layer needs `GitHubClient` (two also
need `GitHubGraphQL`). Full signatures: `references/service-signatures.md`.

| Service | Reach for it when | Highlights |
| --- | --- | --- |
| `GitHubGraphQL` | typed GraphQL queries/mutations | `query`/`mutation` with operation names; error carries GraphQL `errors[]` |
| `PullRequest` | PR lifecycle (needs `GitHubClient` + `GitHubGraphQL`) | `getOrCreate({head, base, title, body, autoMerge?})` → `{…, created}` idempotent upsert; `merge`, `addLabels`, `requestReviewers`, `listAssociatedWithCommit` |
| `GitHubIssue` | issues + PR→issue links | `getLinkedIssues(prNumber)` (GraphQL), `close(n, reason?)`, `comment` |
| `GitHubRelease` | releases + assets | `create({tag, generateReleaseNotes?})`, `getByTag`, `uploadAsset` |
| `GitHubContent` | read one file at a ref without checkout | `getFile(path, ref?) → string` |
| `GitBranch` | branch CRUD | `create`, `exists`, `getSha`, `reset`, `delete` |
| `GitTag` | tag CRUD | `create(tag, sha)`, `resolve(tag) → sha`, `list(prefix?)` |
| `WorkflowDispatch` | cross-workflow orchestration | `dispatch`, `dispatchAndWait(…, {intervalMs?, timeoutMs?})`, `getRunStatus` |
| `GitHubArtifactMetadata` | GH Packages storage records (attestation linkage) | `createStorageRecord(input)` |
| `CheckRun`, `PullRequestComment` | checks & sticky comments | covered in `checks-and-reports` |

### The confusable pair: GitHubCommit vs GitCommit

- **`GitHubCommit` = READ** (REST): `get(ref)`, `list(ref)`,
  `compare(base, head)`, `changedFiles(ref)`. History and diffs.
- **`GitCommit` = WRITE** (Git Data API): `createTree`, `createCommit`,
  `updateRef`, and the one you usually want —
  `commitFiles(branch, message, files)` which builds tree → commit → ref in
  one call and yields **verified** commits when the client authenticates as
  an App (pair with `GitHubToken.botIdentity()` for attribution).

Picking `GitHubCommit` to write (or `GitCommit` to read history) is a type
error you will discover late — check the verb first.

## Errors

Every client call fails with `GitHubClientError { operation, status?,
reason, retryable, retryAfterMs? }` — `retryable` already encodes the policy
above, so a caller's `catchTag` can trust it. Derived services fail with
their own tagged errors (`PullRequestError`, `GitHubReleaseError` with
`retryable`, …) wrapping the operation context. HTML "Unicorn" error pages
are detected and replaced with a clean message
(`src/layers/GitHubClientLive.ts:120-124`).

## Do this, not this

| Do | Not | Why |
| --- | --- | --- |
| `GitHubClientLive.fromEnv()` | `GitHubClientLive.fromEnv` | it is a function returning a Layer; the bare reference wires nothing |
| `fromToken(Redacted.make(raw))` | passing a bare string | the boundary type forces redaction; an unredacted token cannot reach it |
| derived service (`PullRequest.getOrCreate`) | hand-rolled `rest` find-then-create | idempotency and error mapping are already done and tested |
| `paginateStream` + `Stream.takeWhile` for "find recent X" | `paginate` then `.filter` | eager pagination fetches every page first |
| trust `error.retryable` | retrying on any 403 | bare 403 is a permission denial; looping on it burns quota and time (`src/layers/GitHubClientLive.ts:59-65`) |
| `GitCommit.commitFiles` for writes | shelling out to `git` in the runner | API commits are App-verified and need no checkout/config |

## Reference map

| Reference | Load when |
| --- | --- |
| [service-signatures.md](./references/service-signatures.md) | you need exact method signatures, option objects, or error fields for any derived service |

## Related skills

`github-app-auth` for where the token comes from; `checks-and-reports` for
`CheckRun` / `PullRequestComment`; `errors-and-state` for handling the tagged
errors; `testing-actions` for `GitHubClientTest` stubbing (its `empty()`
returns a Layer — an exception to the usual test-layer pattern).
`action-engineering` routes everything.
