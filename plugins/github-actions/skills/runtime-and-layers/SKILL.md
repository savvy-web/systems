---
name: runtime-and-layers
description: >
  Entry points and Layer wiring for Node 24 actions built on
  @savvy-web/github-action-effects — what Action.run provides vs what you wire,
  the main/pre/post entry shapes, ActionsRuntime.Default composition, the
  static-MainLive discipline, Layer.orDie at the boundary, and the withCheckRun
  R=never gotcha. Verified against @savvy-web/github-action-effects@3.0.4.
  User-invokable as /github-actions:runtime-and-layers.
when_to_use: >
  "write main.ts / pre.ts / post.ts", "what does Action.run provide", "wire the
  app layer", "MainLive", "PreLive", "PostLive", "Layer.orDie", "makeAppLayer",
  "provide GitHubClient to my program", "type error: R is not never",
  "withCheckRun callback type error", "FileSystem or HttpClient requirement",
  "extend ActionsRuntime", "Effect.provide in an action"
paths:
  - "**/src/main.ts"
  - "**/src/pre.ts"
  - "**/src/post.ts"
---

# Runtime and layers

An action built on `@savvy-web/github-action-effects` has exactly one shape: tiny
entry files (`main.ts`, optionally `pre.ts`/`post.ts`) that call
`Action.run(program, { layer: <PhaseLive> })`, a `program.ts` holding the Effect
pipeline, and a `layers/app.ts` holding pure `Layer` wiring with no logic.
`Action.run` provides the core action I/O services automatically; everything
else (GitHub clients, domain services) is yours to wire and pass via
`options.layer`. Verify any claim here against the installed package —
`src/index.ts` of `github-action-effects` is the authoritative barrel.

## Entry points

Canonical `main.ts`:

```typescript
import { Action } from "@savvy-web/github-action-effects";
import { MainLive } from "./layers/app.js";
import { program } from "./program.js";

/* v8 ignore next 3 */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(program, { layer: MainLive });
}
```

The `if (process.env.GITHUB_ACTIONS)` guard keeps `program` importable by tests
without module-level side effects — always write it. When a program needs
runtime arguments the tests must control (parsed inputs, a dry-run flag, a
layer), additionally export an inner program function
(`innerProgram(inputs, dryRun, layer)`) and keep the module-level `program` a
thin wrapper that parses inputs and delegates; tests then import the inner
function directly.

`pre.ts` and `post.ts` follow the same shape with their own layers (`PreLive`,
`PostLive`) — see [github-app-auth](../github-app-auth/SKILL.md) for the
canonical pre/post token lifecycle and [errors-and-state](../errors-and-state/SKILL.md)
for post-action error posture. Every entry file the builder should bundle must
exist on disk — a configured `pre`/`post` pointing at a missing file is
*silently dropped* by the builder ([builder-config](../builder-config/SKILL.md)).

## What `Action.run` provides — and does

`Action.run(program, options?)` (src/Action.ts):

1. Merges `ActionsRuntime.Default` with `options.layer` (if given).
2. Wraps the program in `ActionLogger.withBuffer("action", program)`.
3. `Effect.catchCause`: formats the cause via `Action.formatCause` (`[Tag]
   message`), appends the JS stack, emits the Effect span trace as `::debug::`
   (visible with `RUNNER_DEBUG=1`), emits `::error::Action failed: …`, and sets
   `process.exitCode = 1`.
4. `Effect.runPromise` with a last-resort `.catch()` that also sets exit code 1.

`CoreServices = ActionLogger | ActionOutputs | ActionEnvironment | ActionState`.
Programs typed `Effect<void, E, CoreServices | R>` pass `R`'s layer via
`options.layer` (third overload). Inside, `fullLayer` is deliberately
`Layer<any, never, any>` — a documented **type-erasure seam** so callers never
have to name every transitively-required service. Do not "fix" it.

Consequences you must respect:

| Do this | Not this |
| --- | --- |
| Let `Action.run` own top-level failure and the exit code | Top-level `Effect.catchAll` → `outputs.setFailed` (loses `[Tag]` formatting and the span trace; do this only when a friendlier one-line headline genuinely matters more than the diagnostics, and accept the loss knowingly) |
| `await Action.run(...)` in tests | Fire-and-forget in tests (timing races) |
| Read inputs via `Config.*` — `ActionsConfigProvider` is already installed | Hand-rolling `process.env.INPUT_*` reads |

## `ActionsRuntime.Default`

Verbatim from `src/runtime/ActionsRuntime.ts`:

```typescript
export const ActionsRuntime = {
 Default: Layer.mergeAll(
  ConfigProvider.layer(ActionsConfigProvider),
  Logger.layer([ActionsLogger]),
  ActionEnvironmentLive,
  ActionLoggerLive,
  ActionOutputsLive,
  ActionStateLive,
  FetchHttpClient.layer,
 ).pipe(Layer.provideMerge(NodeFileSystem.layer)),
} as const;
```

So the runtime already supplies `FileSystem` (Node) and `HttpClient`
(fetch-backed) to your program's environment. **Import note:**
`FetchHttpClient` comes from `effect/unstable/http` — the package's own docs
still show `@effect/platform` in places; that is stale, teach the source form.
`effect` and `@effect/platform-node` are **peerDependencies** of the library:
your action installs them itself and they stay regular deps of the action repo.

## Wiring your own layer: static `MainLive`

House style: a `layers/app.ts` exporting one static const per phase, pure
wiring, no logic, coverage-pragma'd:

```typescript
/* v8 ignore start -- pure Layer wiring */
const githubClient = GitHubClientLive.fromEnv().pipe(Layer.orDie);

export const MainLive = Layer.mergeAll(
 githubClient,
 ActionOutputsLive.pipe(Layer.provide(NodeFileSystem.layer)),
 ActionEnvironmentLive,
 NodeFileSystem.layer,
 ValidatorLive.pipe(Layer.provide(Layer.mergeAll(ActionEnvironmentLive, githubClient, NodeFileSystem.layer))),
);
/* v8 ignore stop */
```

(`ValidatorLive` stands in for whatever domain service your action defines.)

Rules:

- **Bind shared layers to consts and reuse the reference** (`githubClient`
  above) — layer identity drives memoization; two separate
  `GitHubClientLive.fromEnv()` expressions build two clients.
- **`Layer.orDie` for fatal misconfiguration at the boundary.** A missing
  `GITHUB_TOKEN`, or a missing provisioned App token
  (`GitHubToken.client().pipe(Layer.provide(actionState), Layer.orDie)`), is a
  defect, not a checked error your program logic should ever see.
- **Static const by default; a `makeAppLayer(...)` factory only when the layer
  graph genuinely varies by input** — the legitimate cases are layers that take
  construction input, like `DryRunLive(dryRun)` or an offline-vs-live resolver
  chosen by an input. Do not introduce a factory for style.
- Provide each domain service its deps explicitly with
  `X.pipe(Layer.provide(...))`; merge the results with `Layer.mergeAll`;
  compose library-vs-domain groups with `Layer.provideMerge(domain, library)`
  when domain layers consume library services.

## The `withCheckRun` double-provide gotcha

`CheckRun.withCheckRun(name, sha, callback)` requires the callback to be
`R = never`. If the bracketed work uses your app services, the app layer must be
provided **twice** — outside (for services used before the bracket) and again
inside the callback:

```typescript
Effect.provide(
 Effect.gen(function* () {
  const checkRunService = yield* CheckRun;
  yield* checkRunService.withCheckRun(name, headSha, (checkRunId) =>
   Effect.provide(innerWork(checkRunId), appLayer),
  );
 }),
 appLayer,
);
```

This is expected, not a smell. Layer memoization makes the second provide reuse
the same built services **only if `appLayer` is the same reference** — another
reason factories are the exception.

## Service dependency tiers

Abbreviated; full verified table in
[references/dependency-graph.md](./references/dependency-graph.md).

- **Tier 0** (no service deps): ActionLogger, ActionEnvironment, CommandRunner,
  ToolInstaller, DryRun, OidcTokenIssuer, Glob; OctokitAuthApp, GitHubClient,
  ActionCache (external package imports).
- **Tier 0.5** (`FileSystem`/`HttpClient`): ActionOutputs, ActionState, Sbom;
  Artifact, GitHubBlobStore, S3BlobStore.
- **Tier 1**: GitHubApp ← OctokitAuthApp (+ HttpClient); NpmRegistry ←
  CommandRunner; ChangesetAnalyzer, ConfigLoader ← FileSystem;
  TokenPermissionChecker ← GitHubApp; SigstoreSigner ← OidcTokenIssuer.
- **Tier 2** (← GitHubClient): GitHubGraphQL, GitBranch, GitCommit, GitTag,
  GitHubRelease, CheckRun, PullRequestComment, RateLimiter, WorkflowDispatch,
  GitHubContent, GitHubCommit, GitHubArtifactMetadata, Attest; GitHubIssue and
  PullRequest also need GitHubGraphQL. Other: PackageManagerAdapter,
  WorkspaceDetector ← CommandRunner + FileSystem.
- **Tier 3**: PackagePublish ← CommandRunner + NpmRegistry + ActionOutputs;
  AutoMerge (util) ← GitHubGraphQL.

Test layers for Tier 2 services do **not** depend on GitHubClient — all
in-memory ([testing-actions](../testing-actions/SKILL.md)).

## Coverage pragmas

Wiring and entry guards are excluded from coverage, always with a reason:

- `/* v8 ignore start -- pure Layer wiring */` … `/* v8 ignore stop */` around
  `layers/app.ts` bodies.
- `/* v8 ignore next 3 -- entry-point guard, only runs in GitHub Actions */` on
  the entry guard.

## Reference map

| Reference | Load when |
| --- | --- |
| [dependency-graph.md](./references/dependency-graph.md) | You need the exact deps of one service, or are composing a layer graph with more than a couple of Tier 2 services |

## Related skills

`action-engineering` routes the whole library; `github-app-auth` owns the
pre/main/post token lifecycle this skill's PreLive/PostLive wire;
`errors-and-state` owns failure posture and cross-phase state;
`checks-and-reports` owns what goes inside the withCheckRun bracket;
`testing-actions` owns test-layer composition; `builder-config` owns how these
entries become `dist/*.js`.
