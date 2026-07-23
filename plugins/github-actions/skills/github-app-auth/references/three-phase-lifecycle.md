# Three-phase App auth — a complete action

> Distilled from `@savvy-web/github-action-effects@3.0.4` source and
> production actions built on this stack, 2026-07-23. On version skew the
> installed source wins — re-verify before relying on this.

A complete, self-contained App-authenticated action: `pre.ts` provisions the
installation token, `layers/app.ts` wires the pre/post and main layer slices,
`post.ts` disposes, `action.yml` declares the credential inputs, and the
workflow grants the runner-side permissions. Adapt the permission set and
service slices to the action at hand.

## pre.ts — provision

```typescript
import { Action, ActionState, GitHubToken } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { PreLive } from "./layers/app.js";
import { STATE_KEYS, StartTimeState } from "./state.js";

/**
 * Fine-grained installation permissions this action requires. `provision`
 * verifies the minted token grants at least these before persisting, failing
 * fast otherwise. Keep this the single source of truth for the action's
 * blast radius — action.yml prose and tests both point here.
 */
export const REQUIRED_PERMISSIONS = {
 contents: "write",
 pull_requests: "write",
 checks: "write",
} as const;

export const pre = Effect.gen(function* () {
 const state = yield* ActionState;
 yield* state.save(STATE_KEYS.startTime, new StartTimeState({ startedAt: Date.now() }), StartTimeState);

 yield* Effect.logInfo("Generating GitHub App installation token...");
 const token = yield* GitHubToken.provision({ permissions: REQUIRED_PERMISSIONS });
 yield* Effect.logInfo(`Token generated (expires: ${token.expiresAt})`);
});

/* v8 ignore next 3 */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(pre, { layer: PreLive });
}
```

A variant that also surfaces the resolved App name (available when identity
resolution succeeded in `provision`):

```typescript
yield* Effect.logInfo(
 `Token generated${token.appName !== undefined ? ` for app "${token.appName}"` : ""} (expires: ${token.expiresAt})`,
);
```

## layers/app.ts — pre/post + main slices

```typescript
import { NodeFileSystem, NodeServices } from "@effect/platform-node";
import {
 ActionStateLive,
 ConfigLoaderLive,
 GitHubAppLive,
 GitHubGraphQLLive,
 GitHubToken,
 OctokitAuthAppLive,
} from "@savvy-web/github-action-effects";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

/** pre/post: GitHubApp (for token provision/dispose) + filesystem for ActionState. */
export const PreLive = Layer.mergeAll(
 GitHubAppLive.pipe(Layer.provide(OctokitAuthAppLive), Layer.provide(FetchHttpClient.layer)),
 NodeFileSystem.layer,
);
export const PostLive = PreLive;

/** main: GitHubClient (built from the persisted installation token) + whatever
 * derived services this action uses on top of it. */
const actionState = ActionStateLive.pipe(Layer.provide(NodeServices.layer));
const githubClient = GitHubToken.client().pipe(Layer.provide(actionState), Layer.orDie);
const githubGraphql = GitHubGraphQLLive.pipe(Layer.provide(githubClient));
const configLoader = ConfigLoaderLive.pipe(Layer.provide(NodeServices.layer));

export const MainLive = Layer.mergeAll(githubClient, githubGraphql, configLoader);
```

Note: `Action.run` provides `ActionState` itself for the *program*; the extra
`actionState` slice here exists because `GitHubToken.client()` is a Layer that
needs `ActionState` **at layer-build time**, before the runtime's own layer is
in play. Providing it locally also keeps `withCheckRun` callbacks at
`R = never` (see `runtime-and-layers` for that gotcha).

## post.ts — dispose

```typescript
import { Action, ActionState, GitHubToken } from "@savvy-web/github-action-effects";
import { Effect, Option } from "effect";
import { PostLive } from "./layers/app.js";
import { STATE_KEYS, StartTimeState } from "./state.js";

export const post = Effect.gen(function* () {
 const state = yield* ActionState;
 const start = yield* state.getOptional(STATE_KEYS.startTime, StartTimeState);
 if (Option.isSome(start)) {
  const duration = Date.now() - start.value.startedAt;
  yield* Effect.logInfo(`Total duration: ${(duration / 1000).toFixed(1)}s`);
 }
 yield* Effect.logInfo("Revoking installation token...");
 yield* GitHubToken.dispose().pipe(
  Effect.catch((e) => Effect.logWarning(`Token revocation failed: ${e instanceof Error ? e.message : String(e)}`)),
 );
}).pipe(
 Effect.catchDefect((d) => Effect.logWarning(`Post-action warning: ${d instanceof Error ? d.message : String(d)}`)),
);

/* v8 ignore next 3 */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(post, { layer: PostLive });
}
```

A post that honors a `skip-token-revoke` input:

```typescript
const skipTokenRevoke = yield* Config.boolean("skip-token-revoke").pipe(Config.withDefault(false));
if (skipTokenRevoke) {
 yield* Effect.logInfo("Token revocation skipped (skip-token-revoke is true)");
} else {
 yield* GitHubToken.dispose().pipe(Effect.catch(/* logWarning */));
}
```

## action.yml — input declarations

```yaml
inputs:
  app-client-id:
    description: GitHub App client ID for authentication
    required: true
  app-private-key:
    description: GitHub App private key (PEM format)
    required: true
  github-token:
    description: |
      GitHub token for GitHub Packages publishing (optional).
      Use this when the GitHub App doesn't have packages:write permission.
      Typically pass secrets.GITHUB_TOKEN with workflow permissions: packages: write.
    required: false
    default: ""
  skip-token-revoke:
    description: Skip token revocation in post-action (tokens expire after 1 hour anyway)
    required: false
    default: "false"
```

The `github-token` and `skip-token-revoke` companions are optional — include
them only when the action needs them.

## Workflow-side wiring

The calling workflow passes App credentials from org/repo secrets and
declares a job-level permission block scoped to what the job actually does,
for example:

```yaml
permissions:
  contents: write
  pull-requests: write
  id-token: write
  packages: write
  attestations: write
  checks: write
```

`permissions:` on the *workflow* govern `secrets.GITHUB_TOKEN` and OIDC
(`id-token: write` gates `OidcTokenIssuer`); they do **not** widen the App
installation token — that is governed by the App's installation configuration
and verified by `provision({ permissions })`.

## The token-input bridge (read-only actions)

```typescript
// src/main.ts
import { Action } from "@savvy-web/github-action-effects";
import { MainLive } from "./layers/app.js";
import { program } from "./program.js";

// Bridge the action's `token` input (exposed as INPUT_TOKEN by the runner) to
// GITHUB_TOKEN so GitHubClientLive.fromEnv() can authenticate. The runner does
// not populate GITHUB_TOKEN automatically — workflows pass `with: token: …`.
/* v8 ignore next 3 */
if (process.env.INPUT_TOKEN && !process.env.GITHUB_TOKEN) {
 process.env.GITHUB_TOKEN = process.env.INPUT_TOKEN;
}

/* v8 ignore next */
Action.run(program, { layer: MainLive });
```

with:

```yaml
inputs:
  token:
    description: GitHub token for read-only API calls
    required: false
    default: ${{ github.token }}
```

Only for actions that never mutate. Everything else: App auth.
