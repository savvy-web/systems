---
name: github-app-auth
description: >
  GitHub App authentication for Node 24 actions built on
  @savvy-web/github-action-effects — the GitHubToken provision→client→dispose
  three-phase lifecycle, permission verification, bot identity, and when the
  lightweight token-input bridge is acceptable instead. Verified against
  @savvy-web/github-action-effects@3.0.4. User-invokable as
  /github-actions:github-app-auth.
when_to_use: >
  "authenticate with a GitHub App", "installation token", "app-client-id",
  "app-private-key", "GitHubToken.provision", "revoke the token", "pre.ts
  token", "bot identity for commits", "token permissions", "REQUIRED_PERMISSIONS",
  "id-token: write", "OIDC token", "why not GITHUB_TOKEN", "packages:write
  token for GitHub Packages"
paths:
  - "**/src/pre.ts"
  - "**/src/post.ts"
---

# GitHub App auth in actions

Any action that mutates GitHub state (branches, PRs, checks, releases, org
settings) authenticates as a **GitHub App** through the three-phase
`GitHubToken` lifecycle: mint in `pre`, consume via a layer in `main`, revoke
in `post`. The token is persisted across phases in `ActionState` under a
library-internal key — you never touch the envelope directly. Read-only
actions may use the lighter token-input bridge (last section).

## The three-phase lifecycle

### pre — provision

```typescript
// src/pre.ts
import { Action, ActionState, GitHubToken } from "@savvy-web/github-action-effects";
import { Effect } from "effect";
import { PreLive } from "./layers/app.js";

/**
 * Fine-grained installation permissions this action requires. `provision`
 * verifies the minted token grants at least these before persisting,
 * failing fast otherwise.
 */
export const REQUIRED_PERMISSIONS = {
 contents: "write",
 pull_requests: "write",
 checks: "write",
} as const;

export const pre = Effect.gen(function* () {
 yield* Effect.logInfo("Generating GitHub App installation token...");
 const token = yield* GitHubToken.provision({ permissions: REQUIRED_PERMISSIONS });
 yield* Effect.logInfo(`Token generated (expires: ${token.expiresAt})`);
});

/* v8 ignore next 3 */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(pre, { layer: PreLive });
}
```

**Export the permission set as a named `REQUIRED_PERMISSIONS` const** — it
self-documents the action's blast radius and is assertable in tests. Inline
permission literals inside the `provision` call are the legacy form.

What `provision(options?)` does, in order (`@savvy-web/github-action-effects`
`src/GitHubToken.ts:35-93`):

1. Reads `app-client-id` / `app-private-key` inputs unless overridden via
   `options.clientId` / `options.privateKey`. The key stays `Redacted<string>`
   end-to-end.
2. Mints an installation token (`GitHubApp.generateToken`; installation ID
   auto-resolved from the repo owner when omitted).
3. Masks the raw token in the runner log via `outputs.setSecret`
   (`::add-mask::`) — the token is persisted to `GITHUB_STATE` as plaintext
   (GitHub's protocol), masking is the GitHub-native defense.
4. When `options.permissions` is set, runs
   `TokenPermissionChecker.assertSufficient` against the granted scopes —
   **fail-fast**: a missing scope fails `pre` before `main` ever runs.
5. Best-effort resolves App identity (`appSlug`/`appUserId`/`appName`) — a
   failure logs a warning and degrades to the default bot identity; it never
   fails the action.
6. Persists the enriched envelope to `ActionState`.

The whole use-block runs inside `Effect.acquireUseRelease`: if verification
or persistence fails, **the token is revoked before the error propagates** —
no orphaned live token.

### main — consume via layer, never via env

```typescript
// src/layers/app.ts
import { NodeServices } from "@effect/platform-node";
import { ActionStateLive, GitHubToken } from "@savvy-web/github-action-effects";
import { Layer } from "effect";

const actionState = ActionStateLive.pipe(Layer.provide(NodeServices.layer));
const githubClient = GitHubToken.client().pipe(Layer.provide(actionState), Layer.orDie);
```

- `GitHubToken.client()` is a **function returning a Layer**: it reads the
  persisted envelope from `ActionState` and builds a `GitHubClient` via
  `GitHubClientLive.fromToken` (`src/GitHubToken.ts:95-102`).
- `Layer.orDie` is deliberate: a missing/unreadable token means `pre` did not
  run — that is a fatal wiring defect, not a recoverable error.
- **`process.env.GITHUB_TOKEN` is never set.** The client carries the token
  internally as `Redacted`. If a downstream tool genuinely insists on reading
  a token from the environment (some imperative CLIs do), scope the export as
  narrowly as possible — set it only for that subprocess invocation, never
  process-wide — and document why at the call site.

### post — dispose, never fail the workflow

```typescript
// src/post.ts
export const post = Effect.gen(function* () {
 yield* Effect.logInfo("Revoking installation token...");
 yield* GitHubToken.dispose().pipe(
  Effect.catch((e) => Effect.logWarning(`Token revocation failed: ${e instanceof Error ? e.message : String(e)}`)),
 );
}).pipe(
 Effect.catchDefect((d) => Effect.logWarning(`Post-action warning: ${d instanceof Error ? d.message : String(d)}`)),
);
```

`dispose()` reads the persisted envelope with `getOptional` — **no-op when
`pre` never provisioned** (`src/GitHubToken.ts:104-113`). The belt-and-braces
`Effect.catch` + `Effect.catchDefect` pair is house style: a post-action must
never turn a green run red. Offer a `skip-token-revoke` input
(`Config.boolean`, default `false`) when consumers may re-use the token after
the job — tokens expire after 1 hour regardless.

### Layer composition for pre/post

```typescript
// src/layers/app.ts — the canonical form
import { NodeFileSystem } from "@effect/platform-node";
import { GitHubAppLive, OctokitAuthAppLive } from "@savvy-web/github-action-effects";
import { FetchHttpClient } from "effect/unstable/http";

export const PreLive = Layer.mergeAll(
 GitHubAppLive.pipe(Layer.provide(OctokitAuthAppLive), Layer.provide(FetchHttpClient.layer)),
 NodeFileSystem.layer,
);
export const PostLive = PreLive;
```

`FetchHttpClient` comes from `effect/unstable/http` — the package docs
showing `@effect/platform` are stale.

## action.yml declarations

```yaml
inputs:
  app-client-id:
    description: GitHub App client ID for authentication
    required: true
  app-private-key:
    description: GitHub App private key (PEM format)
    required: true
```

Both always `required: true`. Two optional companion inputs are common:
`github-token` (a workflow-issued token for GitHub Packages publishing, for
when the App installation lacks `packages:write` — consumers pass
`secrets.GITHUB_TOKEN` with a `packages: write` workflow permission) and
`skip-token-revoke`.

## Bot identity for commits

After `provision`, any phase can derive the verified commit identity:

```typescript
const bot = yield* GitHubToken.botIdentity();
// { name: "<appSlug>[bot]", email: "<appUserId>+<appSlug>[bot]@users.noreply.github.com" }
```

Falls back to `github-actions[bot]` / `41898282+…` when identity resolution
degraded in `pre`. Use this for `GitCommit` author/committer fields — GitHub
marks commits from it "verified".

## Direct App use (no phases)

For a single-phase program, `GitHubApp.withToken(clientId, privateKey, effect)`
brackets generate→use→revoke (revokes even on failure), and
`GitHubClientLive.fromApp({ clientId, privateKey, installationId? })` builds a
scoped client layer that revokes on scope close. Both need
`GitHubAppLive ∘ OctokitAuthAppLive` + an `HttpClient`.

## Permission checking beyond provision

`TokenPermissionChecker` (`src/services/TokenPermissionChecker.ts`) offers
`check` (report), `assertSufficient` (fail on missing), `assertExact` (fail on
missing OR extra), `warnOverPermissioned` (log-only). `provision({permissions})`
runs `assertSufficient` for you; reach for the service directly only for
`assertExact`/audit flows. Its Live layer is a **function**:
`TokenPermissionCheckerLive(grantedPermissions)`.

## OIDC

`OidcTokenIssuer.getToken(audience?)` fetches a runner OIDC ID token
(Sigstore, cloud federation). Requires the workflow permission
`id-token: write`; without it the runner env vars are absent and the call
fails with `OidcTokenError{reason: "env"}`.

## The lightweight alternative: token-input bridge

A **read-only** action (no mutations, no App identity needed) may skip App
auth entirely and bridge a plain `token` input instead:

```typescript
// Bridge the action's `token` input to GITHUB_TOKEN for GitHubClientLive.fromEnv().
/* v8 ignore next 3 */
if (process.env.INPUT_TOKEN && !process.env.GITHUB_TOKEN) {
 process.env.GITHUB_TOKEN = process.env.INPUT_TOKEN;
}
```

with `GitHubClientLive.fromEnv().pipe(Layer.orDie)` in `MainLive`. Acceptable
only when: the action never mutates, `secrets.GITHUB_TOKEN`'s repo scope
suffices, and no cross-repo access is needed. The moment the action writes
anything, switch to App auth.

## Do this, not this

| Do | Not | Why |
| --- | --- | --- |
| `export const REQUIRED_PERMISSIONS = {...} as const` in `pre.ts` | inline `provision({ permissions: {...} })` literal | self-documents the action's blast radius; assertable in tests |
| `GitHubToken.client().pipe(Layer.provide(actionState), Layer.orDie)` | reading the token yourself / `process.env.GITHUB_TOKEN = ...` | missing token is a wiring defect; env bridge leaks an unredacted secret |
| `dispose().pipe(Effect.catch(logWarning))` + `catchDefect` in post | letting `dispose` failure fail the job | a post-action must never redden a green run |
| `Config.redacted("app-private-key")` / `Redacted` end-to-end | `Config.string` for the key, `Redacted.value` outside wire boundaries | one unwrap site max; `Redacted` prints as `<redacted>` |
| `FetchHttpClient` from `effect/unstable/http` | `from "@effect/platform"` (package docs show this) | v4 moved it; the docs are stale — source wins |
| App auth for any mutating action | token bridge because it is less code | `GITHUB_TOKEN` lacks cross-repo scope, unverified commits, no identity |

## Reference map

| Reference | Load when |
| --- | --- |
| [three-phase-lifecycle.md](./references/three-phase-lifecycle.md) | you need the complete pre/main/post files, action.yml blocks, and workflow permissions for a full App-authenticated action |

## Related skills

`runtime-and-layers` for where `PreLive`/`MainLive`/`PostLive` live and
`Action.run` wiring; `github-api` for what the built `GitHubClient` can do;
`errors-and-state` for the `ActionState` machinery `provision` persists
through; `testing-actions` for `GitHubAppTest` and testing the lifecycle.
`action-engineering` routes everything.
