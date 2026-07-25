---
status: current
module: github-action-effects
category: architecture
created: 2026-03-06
updated: 2026-07-24
last-synced: 2026-07-24
completeness: 90
related:
  - ./index.md
  - ./services.md
dependencies: []
---

# Errors and Schemas

Error and schema conventions for `@savvy-web/github-action-effects`.

See [index.md](./index.md) for the architecture overview and [services.md](./services.md) for the service interfaces that produce these types.

---

## Overview

Every service has one tagged error type and validates its boundary data with Effect Schema. This doc records the conventions those types follow — the cardinal shapes, the wrapping discipline and the retryability contract — not the per-type inventory. The error definitions live in `packages/github-action-effects/src/errors/`, the schemas in `packages/github-action-effects/src/schemas/` and the service-local interfaces in each `packages/github-action-effects/src/services/<Service>.ts`.

---

## Error pattern

All errors extend `Data.TaggedError` inline, one file per error in `src/errors/`:

```typescript
export class FooError extends Data.TaggedError("FooError")<{
  readonly field: string;
}> {}
```

There is no shared `Base` error. Tagged errors with structured fields let consumers pattern-match and handle failures programmatically inside Effect pipelines.

### Error hierarchy

Services that depend on `GitHubClient` map the underlying `GitHubClientError` to their own domain-specific error type, so a caller catching (for example) `CheckRunError` never has to reason about transport-level failures. Every Tier 2 GitHub-API service follows this pattern — see the dependency graph in [integration-points.md](./integration-points.md).

`GitHubClientError` carries the load-bearing `retryable` contract that the rest of the library keys off:

- `retryable` is `true` for 429 (rate limit), any 5xx and a 403 that carries a server-advised retry signal (a `Retry-After` header, or `x-ratelimit-remaining: 0` plus `x-ratelimit-reset` — a GitHub secondary rate limit).
- A bare 403 (a genuine permission denial) stays non-retryable.
- `retryAfterMs` carries the server-advised delay when present.

**A wrapping error may enrich, not just rename.** The domain wrapper is where a transport-level signal becomes a domain discriminant the caller can match on directly. `GitBranchError` is the reference case: alongside `branch`/`operation`/`reason` it carries an optional `status` (the underlying HTTP status, preserved through the wrap) and an optional `alreadyExists`, set by `GitBranchLive`'s `mapError` when the `GitHubClientError` was a 422 — occasionally a 409 — whose reason names an existing reference. That is the benign create-race outcome, and the discriminant exists so a caller stops inferring it from a re-query of branch state or from string-matching a message. Both fields are optional so the shape stays additive for existing callers. The rule generalizes: when a wrapper drops information a caller provably needs, add a field rather than making the caller round-trip to the API for it — and route every failure path through the shared `mapError` so no branch constructs the error bare and silently omits the discriminant.

`RuntimeEnvironmentError` is raised by `RuntimeFile` when a required environment file variable (`GITHUB_OUTPUT`, `GITHUB_STATE`, etc.) is unset. Consuming layers map it to their own domain error — for example `ActionOutputsLive` maps it to `ActionOutputError`.

A few errors carry extra ergonomics worth knowing before editing them: `NpmRegistryError` and `PackagePublishError` expose a `message` getter so a caught error reads cleanly at the surface (e.g. in `console.error` or a workflow command) without destructuring; `PackagePublishError` and `CommandRunnerError` also surface the tail of long stderr to aid CI diagnostics.

---

## Schema pattern

Schemas use `Schema.Struct` (or `Schema.Class`) with annotations, and types are inferred via `typeof X.Type`. Schema validation at each service boundary catches malformed data early with a clear error rather than letting it propagate. The barrel re-exports each schema alongside an inferred `*Type` alias — see `src/index.ts` for the exact export names.

Two clusters are worth calling out as topology rather than inventory:

- **`schemas/GitTree.ts`** models Git Data API commits as discriminated unions — `FileChange`/`TreeEntry` split into a content variant (add/update) and a deletion variant (`sha: null`). `GitCommit.commitFiles` consumes these.
- **`schemas/Attestation.ts`** holds the in-toto/Sigstore wire types (`InTotoStatement`, `InTotoSubject`, `SigstoreBundle`, `AttestInput`, `AttestationRecord`) plus the predicate-type URI constants. The `Attest`, `SigstoreSigner` and `Sbom` services share these.

Service-specific result and option types (`PullRequestInfo`, `PackResult`, `CommitComparison`, etc.) are plain TypeScript interfaces co-located with their service file, not schemas. They are listed in [services.md](./services.md) where the method that returns them is described.

### Shared internal helpers

A few cross-layer helpers live under `src/layers/internal/` so the Live and Test layers stay in sync:

- `decodeInput.ts` (`decodeInput`, `decodeJsonInput`) — input validation.
- `decodeState.ts` (`decodeState`, `encodeState`) — shared by `ActionStateLive` and `ActionStateTest`.
- `environmentMaps.ts` — environment-variable mapping shared by `ActionEnvironmentLive` and `ActionEnvironmentTest`.

`formatBotIdentity` in `src/utils/botIdentity.ts` is a pure function that derives a `BotIdentity` from an optional `{ appSlug?, appUserId? }` source: a verified `<appSlug>[bot]` identity when both fields are present, otherwise the well-known `github-actions[bot]` fallback. Both `GitHubApp.botIdentity` and `GitHubToken.botIdentity` delegate to it.

---

## Data flow

These topology sketches show what crosses each runtime boundary. The internal mechanics live in the named source files.

### Input reading

`action.yml` inputs become `INPUT_*` env vars, which `ActionsConfigProvider` exposes through Effect's `Config` API, so `Config.string("name")` reads `INPUT_NAME` and yields a typed value or a `ConfigError`.

### Output

`ActionOutputs.set` appends to `GITHUB_OUTPUT` via `RuntimeFile`; `summary` appends to `$GITHUB_STEP_SUMMARY`; `setFailed` issues `::error::` and sets `process.exitCode = 1`; `setSecret` issues `::add-mask::`.

### State serialization

`ActionState.save` runs `Schema.encode` then `JSON.stringify` and appends to `GITHUB_STATE`; `get` reads the `STATE_*` env var, `JSON.parse`s it and `Schema.decode`s it, failing with `ActionStateError` when the key is unset or invalid. See `src/layers/internal/decodeState.ts`.

### Cache (V2 Twirp protocol)

`ActionCache` reads `ACTIONS_RESULTS_URL` and `ACTIONS_RUNTIME_TOKEN`, tars the paths, then runs the three-step Twirp save (`CreateCacheEntry` → Azure Blob upload → `FinalizeCacheEntryUpload`) or the `GetCacheEntryDownloadURL`-based restore (Azure Blob download → untar). The version hash is `sha256(paths.join("|") + "|gzip|1.0")`. See [integration-points.md](./integration-points.md#cache-protocol-v2-twirp) and `src/layers/ActionCacheLive.ts`.

### Attestation

`Attest.attest` builds an `InTotoStatement`, hands it to `SigstoreSigner` (which fetches an OIDC token via `OidcTokenIssuer`, signs through Fulcio and witnesses on Rekor) and POSTs the resulting bundle to the repo's attestation endpoint, returning an `AttestationRecord`. `Attest.sbom` and `Attest.listForSubject` build on the same path. See `src/services/Attest.ts` for the full flow.

---

## Current State

The error and schema conventions are stable across the service catalog. The retryability contract on `GitHubClientError` and the domain-wrapping discipline are the parts most likely to matter when adding a new GitHub-API service.

## Rationale

Inline `Data.TaggedError` keeps error definitions concise while preserving structured fields for pattern matching. Schema validation at service boundaries surfaces invalid data early with actionable messages.

## Related Documentation

- [index.md](./index.md) — architecture overview and design decisions
- [services.md](./services.md) — service interfaces that use these error and schema types
