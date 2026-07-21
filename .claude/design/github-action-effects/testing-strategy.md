---
status: current
module: github-action-effects
category: testing
created: 2026-03-06
updated: 2026-07-21
last-synced: 2026-07-21
completeness: 88
related:
  - ./index.md
  - ./services.md
  - ./layers.md
dependencies: []
---

# Testing Strategy

Testing approach, the `./testing` subpath contract and coverage requirements for `@savvy-web/github-action-effects`.

See [index.md](./index.md) for the architecture overview and [layers.md](./layers.md) for the test layer implementations.

---

## Overview

Every service is tested in-memory through its `Test` layer, so the suite needs no GitHub API credentials and no GitHub Actions runtime installed. Because there are no `@actions/*` packages, Live-layer tests mock at the Node.js level (env vars, filesystem, captured stdout) rather than at a wrapper-service boundary.

---

## Testing subpath export

**Import path:** `@savvy-web/github-action-effects/testing`.

The `./testing` subpath re-exports everything from the main entry point **except** a small omitted set, so test files can import every Test layer, schema and error without dragging in runtime-only dependencies (notably `@octokit/rest` / `@octokit/auth-app`, which a test environment may not have installed). `packages/github-action-effects/src/testing.ts` is the authoritative omission list — read its diff against `src/index.ts` rather than trusting a transcribed set here. As of this writing it drops the Octokit-importing layers, the `GitHubToken` and `Action` namespaces, the `Step` module, the `RegistryClassifier` util and both blob-store Live backends (`GitHubBlobStoreLive`, `S3BlobStoreLive`); the `BlobStore` service, `BlobStoreTest` and `BlobStoreError` stay available for tests.

---

## Test layout

Test files live under a sibling `__test__/` directory that mirrors the `src/` tree, the canonical pattern being a service-interface test through the Test layer plus a Live-layer test with mocked Node.js dependencies:

```text
src/services/ActionOutputs.ts              — service interface
__test__/services/ActionOutputs.test.ts    — tests via the Test layer
src/layers/ActionOutputsLive.ts            — live layer
__test__/layers/ActionOutputsLive.test.ts  — live layer tests with mocked deps
src/layers/ActionOutputsTest.ts            — test layer (no test file needed)
__test__/runtime/WorkflowCommand.test.ts   — pure-function tests
```

Each service has a Test layer with in-memory backing, exercised through the Effect runtime so no real GitHub API or workflow command is touched. Test layers use the namespace-object pattern (`.empty()` / `.layer(state)`) for ergonomic setup.

**Framework:** Vitest driven by the root `@vitest-agent/plugin` (`AgentPlugin`), which discovers and classifies these `__test__/*.test.ts` files. Tests run in the forks pool (required for Effect-TS runtime compatibility), v8 coverage provider, 80% threshold for lines, functions, statements and branches.

---

## What gets tested

Coverage spans every service, the runtime modules, the namespace and utility objects and the schemas. The exact assertions live in the `*.test.ts` files under `__test__/`; the regression-prone areas worth knowing about are:

- **`ActionLogger`** — the flush regressions: `withBuffer` flushes its transcript on success as well as failure (a clean run must not silently discard Info-level logging), the `RUNNER_DEBUG=1` run-time bypass passes through unbuffered, and a failure inside a group flushes within that group with no double-flush across nested groups or the outer `withBuffer` boundary (see [layers.md](./layers.md#load-bearing-layer-notes)).
- **`GitHubClient`** — the three construction modes, pagination termination and the retryable classification (429/5xx/secondary-rate-limit 403 vs a bare 403).
- **`GitHubToken`** — `provision`/`client`/`dispose` across phases, including the no-op `dispose` when nothing was persisted.
- **`ActionCache` / `Artifact`** — the V2 Twirp save/restore path with archive create/extract and cache-miss handling.

---

## Integration tests

Deferred until the service surface stabilizes. The plan is to run actions in Docker via `nektos/act` using the action-builder's `persistLocal` feature.

---

## Current State

Unit tests cover the service catalog, the runtime modules, the namespace/utility objects and the schemas, meeting the 80% threshold. Integration tests remain deferred.

## Rationale

In-memory test layers give fast, deterministic tests without GitHub credentials or runner infrastructure. Mirroring the `src/` tree under `__test__/` keeps tests discoverable per the suite-wide convention while leaving `src/` free of test files, and the forks pool satisfies Effect-TS runtime requirements. With all `@actions/*` packages removed, the suite has no dependency on the GitHub Actions runner environment.

## Related Documentation

- [index.md](./index.md) — architecture overview and design decisions
- [services.md](./services.md) — service interfaces being tested
- [layers.md](./layers.md) — test layer implementations used in tests
