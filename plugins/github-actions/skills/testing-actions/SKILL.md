---
name: testing-actions
description: >
  Testing GitHub Actions built on @savvy-web/github-action-effects — the
  /testing entry point, the in-memory test layers and their state shapes,
  ConfigProvider-driven input injection, output assertions, App-token
  lifecycle testing, failure injection, and the HttpClient stub recipe for
  Live-layer tests. Verified against @savvy-web/github-action-effects@3.0.4.
  User-invokable as /github-actions:testing-actions.
when_to_use: >
  "test an action", "write tests for this action", "test layer", "mock
  GitHubClient", "stub the GitHub API", "ConfigProvider.fromUnknown",
  "assert on outputs", "test the pre/main/post lifecycle", "test
  GitHubToken.client", "ActionOutputsTest", "failure injection", "test a
  Live layer", "why is my test hitting the network"
---

# Testing github-action-effects actions

Every service in the library ships a Live layer and an in-memory Test layer.
Action tests provide Test layers, inject inputs through a `ConfigProvider`,
run the exported `program`, and assert on the captured state — no
`process.env` mutation, no network, no filesystem beyond what you choose to
provide. For per-layer usage beyond this skill, the package's own test suite
(`__test__/` — readable in the library's repo, not shipped in the published
package; vendor the source via the silk plugin's `.repos` capability) is the
authority.

## The import rule

Tests import from **`@savvy-web/github-action-effects/testing`**. Entry
points (`main.ts` / `pre.ts` / `post.ts`) import from the **root**.

The `/testing` entry re-exports the full surface EXCEPT runtime-only
symbols that statically pull `@octokit/*` or emit workflow commands at
import time: `Action` (the value), `Step`, `GitHubToken` +
`ProvisionOptions`, `GitHubClientLive`, `OctokitAuthAppLive`,
`GitHubBlobStoreLive`, `S3BlobStoreLive` + `S3BlobStoreConfig`, and the
`RegistryClassifier` helpers (src/testing.ts vs src/index.ts). Importing
the root in a test file works but drags that runtime in; importing
`/testing` from an entry point fails to find `Action`. When a test must
exercise one of the omitted symbols (e.g. `GitHubToken`), import that
symbol from the root and everything else from `/testing` — the package's
own `__test__/GitHubToken.test.ts` does exactly this.

## The canonical harness

The shape every action test should start from:

```ts
import { ConfigProvider, Effect, Layer, Logger } from "effect";
import {
  ActionEnvironmentTest,
  ActionLoggerTest,
  ActionOutputsTest,
} from "@savvy-web/github-action-effects/testing";
import { program } from "./program.js";

const outputsState = ActionOutputsTest.empty();
const baseLayer = Layer.mergeAll(
  ActionOutputsTest.layer(outputsState),
  ActionLoggerTest.layer(ActionLoggerTest.empty()),
  ActionEnvironmentTest.layer(env, payload as never),
  // ...domain service test layers...
);

await Effect.runPromise(
  program.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ...inputs }))),
    Effect.provide(baseLayer),
    Effect.provide(Logger.layer([])), // silence log output in test runs
  ),
);
// assert on outputsState
```

Three rules baked into that harness:

1. **Inputs come from `ConfigProvider.fromUnknown({...})`**, keyed by the
   input name exactly as `Config.string("input-name")` reads it. Never set
   `INPUT_*` env vars in tests — the ConfigProvider layer replaces the
   runtime's `ActionsConfigProvider` wholesale.
2. **`Logger.layer([])` silences logging.** Without it every
   `Effect.logInfo` in the program prints into the test output.
3. **Keep a reference to each state object you assert on.** The layer
   closes over the state; the test reads it after the run.

## Test-layer factory shapes — check before you wire

The convention is `X.empty(): XTestState` + `X.layer(state): Layer`, but
**four shapes exist**. Writing `X.layer(X.empty())` without checking the
shape is the classic type error here. Verified against `src/layers/*Test.ts`
at 3.0.4:

| Shape | Layers |
| --- | --- |
| `empty(): State` + `layer(state): Layer` (majority) | ActionCache, ActionLogger, ActionOutputs, ActionState, Artifact, BlobStore, ChangesetAnalyzer, CheckRun, ConfigLoader, GitBranch, GitCommit, GitHubApp, GitHubCommit, GitHubContent, Glob, PackageManagerAdapter, PullRequest, PullRequestComment, RateLimiter, TokenPermissionChecker, ToolInstaller, WorkflowDispatch |
| `empty(): Layer` — no state exposed | **GitHubClientTest**, **CommandRunnerTest** (`layer` takes a `ReadonlyMap<string, CommandResponse>`), **NpmRegistryTest**, **WorkspaceDetectorTest**, **ActionEnvironmentTest** (`layer(env, payload?)` — no `empty-state` form at all) |
| `empty(): { state, layer }` — destructure it | DryRunTest, GitHubArtifactMetadataTest, GitHubGraphQLTest, GitHubIssueTest, GitHubReleaseTest, GitTagTest, PackagePublishTest (its `layer(...)` ALSO returns `{ state, layer }`) |
| Plain `Layer` const or `make*` factory | `OidcTokenIssuerTest` / `SigstoreSignerTest` are ready-made stateless layers; Attest/Sbom use `makeAttestTestState(overrides?)` / `makeSbomTestState(overrides?)` + `AttestTest.layer(state)`, plus `AttestTestFullLayer(state?)` for the whole attestation stack |

Full state-shape reference for every layer:
[test-layer-states.md](./references/test-layer-states.md).

### GitHubClientTest — stubs, not passthrough

`GitHubClientTest.empty()` returns a **Layer** with default repo
`test-owner/test-repo` and zero recorded responses. Any un-stubbed
`rest` / `graphql` / `paginate` call fails with a `GitHubClientError`
("No test response recorded for operation …") — deliberate, so a test
cannot silently hit an unstubbed path. To stub, build the state yourself
and pass it to `layer`:

```ts
import type { GitHubClientTestState } from "@savvy-web/github-action-effects/testing";
import { GitHubClientTest } from "@savvy-web/github-action-effects/testing";

const gh: GitHubClientTestState = {
  restResponses: new Map([["repos.get", { data: { default_branch: "main" } }]]),
  graphqlResponses: new Map(),
  paginateResponses: new Map([["listIssues", [[{ number: 1 }], [{ number: 2 }]]]]),
  repo: { owner: "acme", repo: "demo" },
};
const layer = GitHubClientTest.layer(gh);
```

Keys are the `operation` string you pass to `client.rest(operation, fn)` —
the callback is never invoked. `paginateResponses` maps operation → array
of pages; `paginate` flattens them, `paginateStream` replays one page per
chunk so `Stream.takeWhile` can stop early (GitHubClientTest.ts:98-100).

## Asserting on captured state

`ActionOutputsTestState` captures everything the program wrote:
`outputs` (`{name, value}[]`), `summaries`, `variables`, `paths`,
`secrets`, `failed`. Two habits:

- **Last write wins.** `outputs` is an append log; when a program may set
  the same output twice, assert on the LAST entry for a name, not
  `toContainEqual` alone.
- `setJson` stores the JSON **string** in `outputs` — `JSON.parse` it
  before deep-asserting, or assert on the exact serialized form when
  declaration order matters (it does for `$schema`-first contracts; see
  `outputs-and-schemas`).

`ActionLoggerTestState` records `entries`, `groups` (with their own
entries), `flushedBuffers`, and `notices` — assert on decision-log lines
through it rather than spying on stdout.

## Testing the App-token lifecycle

`GitHubAppTest.empty()` seeds a full state: token `ghs_test_token_123`,
`expiresAt` 2099, `installationId: 12345`, AND
`appIdentity: { appSlug: "test-app", appUserId: 99999, appName: "Test App" }`.
Two consequences (GitHubAppTest.ts:76-86):

- The default state does NOT exercise `provision`'s identity-degradation
  path. To test it, build the state WITHOUT `appIdentity` — then
  `resolveAppIdentity` fails and `provision` must degrade gracefully.
- `generateCalls` / `revokeCalls` record every mint/revoke — assert
  revocation on the failure path with them.

**Testing `GitHubToken.client()`** (a root-entry import): the persisted
token lives in `ActionState` under the key
`"github-action-effects/installation-token"`
(`__test__/GitHubToken.test.ts:25`). Run `provision` against a **shared**
`ActionStateTest` state first, then provide that same state to the client
layer:

```ts
const state = ActionStateTest.empty();
await Effect.runPromise(
  Effect.provide(
    GitHubToken.provision({ clientId: "Iv1.abc", privateKey: "pk", installationId: 7 }),
    Layer.mergeAll(
      ActionStateTest.layer(state),
      GitHubAppTest.layer(GitHubAppTest.empty()),
      ActionOutputsTest.layer(ActionOutputsTest.empty()),
      Logger.layer([]),
    ),
  ),
);
// same state → client() finds the token
const result = await Effect.runPromise(
  Effect.provide(
    Effect.flatMap(GitHubClient, (c) => c.rest("op", () => Promise.resolve({ data: "ok" }))),
    GitHubToken.client().pipe(Layer.provide(ActionStateTest.layer(state))),
  ),
);
```

An empty state makes `client()` fail — that's the "pre phase didn't run"
test (`__test__/GitHubToken.test.ts:322-333`).

## Failure injection

For services with rich Test states, seed the failure (e.g. `AttestTest`'s
`failWith`, `GitHubClientTest`'s missing stub). For everything else,
hand-roll the layer:

```ts
const failingCache = Layer.succeed(ActionCache, {
  save: () => Effect.fail(new ActionCacheError({ key: "k", operation: "save", reason: "boom" })),
  restore: () => Effect.fail(new ActionCacheError({ key: "k", operation: "restore", reason: "boom" })),
});
```

Use `Effect.die(...)` instead of `Effect.fail` to test defect paths
(post-action `catchDefect` handlers). This is also the coverage honesty
tool: the aggregate coverage gate can be green while an orchestration
module's error branches are untested — verify them by fault injection.

## Live-layer tests: the HttpClient stub recipe

When testing a Live layer itself (rare in an action; the library does it),
stub HTTP at the `HttpClient` service — never monkeypatch `fetch`. The
canonical recipe (from the package's `__test__/layers/GitHubAppLive.test.ts`):

```ts
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

const mockHttpClientLayer: Layer.Layer<HttpClient.HttpClient> = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request, url) =>
    Effect.sync(() => {
      captured.push({ method: request.method, url: url.toString() });
      const reply = replies.shift() ?? { status: 500, body: "{}" };
      const noBody = reply.status === 204 || reply.status === 304; // Fetch spec: null body
      return HttpClientResponse.fromWeb(
        request,
        new Response(noBody ? null : reply.body, {
          status: reply.status,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  ),
);
```

Note the import path: `effect/unstable/http` (v4 core), NOT
`@effect/platform` — the package docs still show the old path in places;
the source is the authority.

## Pure builders: test them directly

Markdown/summary/format builders in the house style are pure functions
(`buildSummaryMarkdown(data): string`, injectable `now` for timestamps).
Test them as plain functions with no layers at all — that is why they are
pure. See `checks-and-reports` for the builder discipline.

## Repo mechanics

- Tests are **co-located**: `src/foo.ts` → `src/foo.test.ts`. Every module.
- `vitest.config.ts` uses `@vitest-agent/plugin` with
  `COVERAGE_LEVELS.strict` and `pool: "forks"` — the template repo
  preconfigures this. Run through the vitest-agent MCP `run_tests` tool when
  the session exposes it.
- Entry files carry `/* v8 ignore next 3 -- entry-point guard */` on the
  `if (process.env.GITHUB_ACTIONS)` guard and `/* v8 ignore start -- pure
  Layer wiring */` on layer modules — see `runtime-and-layers`.

## Do this, not this

| Do | Not | Why |
| --- | --- | --- |
| `Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ "dry-run": "true" })))` | `process.env["INPUT_DRY-RUN"] = "true"` | env mutation leaks across `forks`-pooled tests and bypasses the Config layer the program actually reads |
| Check the factory shape, then wire (`const { state, layer } = GitHubReleaseTest.empty()`) | `GitHubReleaseTest.layer(GitHubReleaseTest.empty())` | a third of the Test layers do not follow `empty(): State` — see the shapes table |
| Build `GitHubClientTestState` with explicit stubs per operation | expect `GitHubClientTest.empty()` to answer calls | every un-stubbed call fails with `GitHubClientError` by design (GitHubClientTest.ts:31-39) |
| Import test layers from `/testing`; import `GitHubToken`/`Step` from the root only where needed | import everything from the root in tests | the root statically pulls octokit + workflow-command emission into the test process |
| Assert secrets were masked via `outputsState.secrets` | grep captured log text for the token | `provision` masks through `setSecret`; the state records it directly (`__test__/GitHubToken.test.ts`) |
| Stub HTTP with `Layer.succeed(HttpClient.HttpClient, HttpClient.make(...))` | `vi.stubGlobal("fetch", ...)` | the library routes through the HttpClient service; the stub captures requests typed, and 204/304 need null bodies |

## Reference map

| Reference | Load when |
| --- | --- |
| [test-layer-states.md](./references/test-layer-states.md) | You need the exact state shape, factory signature, or seeded defaults of a specific Test layer |

## Related skills

`action-engineering` routes the library; `runtime-and-layers` owns the
entry-point/layer wiring these tests exercise; `github-app-auth` owns the
provision→client→dispose lifecycle being tested; `outputs-and-schemas`
owns what the asserted outputs should look like; `errors-and-state` owns
the error types you inject.
