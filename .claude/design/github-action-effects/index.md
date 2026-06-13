---
status: current
module: github-action-effects
category: architecture
created: 2026-03-06
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 95
related:
  - ./services.md
  - ./layers.md
  - ./errors-and-schemas.md
  - ./testing-strategy.md
  - ./integration-points.md
  - ../github-action-builder/architecture.md
dependencies: []
---

# GitHub Action Effects - Architecture

Effect-based utility library for building robust, well-logged, and
schema-validated GitHub Actions with Node.js 24. Zero CJS dependencies --
all `@actions/*` packages replaced with native ESM implementations using
Effect primitives and the GitHub Actions runtime protocol.

## Design documents

| Document | Contents |
| --- | --- |
| [services.md](./services.md) | All service interface descriptions, namespace objects, utility namespaces |
| [layers.md](./layers.md) | Layer patterns, live vs test implementations, dependency graph |
| [errors-and-schemas.md](./errors-and-schemas.md) | Error types, schema patterns, data flow |
| [testing-strategy.md](./testing-strategy.md) | Testing approach, coverage requirements, test layer patterns |
| [integration-points.md](./integration-points.md) | Dependencies, how services compose, data flow diagrams |

## Current State

The library provides Effect service interfaces plus namespace and utility objects spanning core action I/O, GitHub API integration, git operations, build tooling, attestation and a runtime layer that implements the GitHub Actions protocol natively (no `@actions/*` packages). The authoritative list of services, layers, errors and schemas is the barrel export at `packages/github-action-effects/src/index.ts`; the design docs describe topology and decisions, not the per-symbol inventory.

## Overview

`@savvy-web/github-action-effects` is an unopinionated utility library providing Effect services for GitHub Actions built with [`@savvy-web/github-action-builder`](../github-action-builder/architecture.md) (or any Node.js 24 action). Users compose these services into their own Effect programs. The library does not dictate how actions are structured — it provides building blocks.

**Package:** `@savvy-web/github-action-effects` at `packages/github-action-effects` in `savvy-web/systems`.

### Scope

Services cover six domains:

- **Core action I/O** — outputs, state, logging, environment, cache
- **Git operations** — branches, commits, tags via the Git Data API
- **GitHub API** — REST client, GraphQL, releases, issues, PR lifecycle, PR comments, check runs, workflow dispatch, app auth, rate limiting, content reading, commit graph, artifact metadata, artifact upload/download
- **Build tooling** — command execution, npm registry, package publishing, workspace detection, package-manager adaptation, tool installation, changeset analysis, config loading, glob/hash
- **Attestation** — in-toto/SLSA statement construction, Sigstore signing, CycloneDX SBOM generation, full attest-and-upload workflow
- **Runtime layer** — native implementations of the GitHub Actions workflow command protocol, environment-file appending, a `ConfigProvider` for `INPUT_*` variables, Effect Logger integration and the `Step` buffered-logging primitive

### Problem statement

GitHub Actions development suffers from four recurring pain points:

1. **Brittle error handling** -- Actions fail fast on first error, making
   monorepo builds that should report partial results instead crash entirely
2. **Noisy logging** -- Raw command output floods the console, making debugging
   with LLMs or human eyes difficult; no structured log levels
3. **Unvalidated inputs** -- JSON strings passed between workflows have no schema
   validation; GitHub's input validation is minimal
4. **Manual reporting** -- Building GFM tables for check run summaries and PR
   comments requires repetitive string concatenation

### Design principles

- **Utility-first** -- Provide composable services, not an opinionated framework
- **Effect-native** -- All services are Effect services with proper Layer composition
- **Zero @actions/* dependencies** -- All platform interactions use native ESM
  implementations: `WorkflowCommand` for the `::command::` protocol,
  `RuntimeFile` for environment file appending, `ActionsConfigProvider` for
  reading `INPUT_*` env vars and `ActionsLogger` for the Effect Logger.
  Direct dependencies on `@octokit/rest` and `@octokit/auth-app` replace
  `@actions/github`. `@azure/storage-blob` is used for cache transfers.
- **Peer dependencies** -- `effect`, `@effect/platform`, and
  `@effect/platform-node` are required peers. Users bring their own versions.
- **Single entry point** -- One barrel export at `@savvy-web/github-action-effects`
- **Incrementally adoptable** -- Use one service or all of them; no all-or-nothing

---

## Runtime layer

The `packages/github-action-effects/src/runtime/` directory contains native implementations of the GitHub
Actions runtime protocol, replacing all `@actions/*` packages:

- **`WorkflowCommand`** -- Formats and issues `::command key=value::message`
  protocol strings to stdout. Handles escaping of `%`, `\r`, `\n`, `:`, `,`.
- **`RuntimeFile`** -- Appends key-value pairs to GitHub Actions environment
  files (`GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_STATE`, `GITHUB_PATH`).
  Supports multiline values via the delimiter protocol.
- **`ActionsConfigProvider`** -- A `ConfigProvider` that reads `INPUT_*`
  environment variables. Converts config keys to the `INPUT_` prefix format
  (uppercase, spaces to underscores, hyphens preserved).
- **`ActionsLogger`** -- An Effect `Logger` that maps log levels to workflow
  commands: Debug/Trace to `::debug::`, Info to plain stdout, Warning to
  `::warning::`, Error/Fatal to `::error::`. Forwards `file`, `line`, `col`
  annotations as command properties.
- **`ActionsRuntime.Default`** -- Single convenience Layer wiring the core services together: the `INPUT_*` ConfigProvider, the workflow-command Logger, `ActionLogger`, `ActionOutputs`, `ActionState`, `ActionEnvironment`, `NodeFileSystem.layer` and `FetchHttpClient.layer` (the fetch-backed `HttpClient` that `OidcTokenIssuerLive`, `GitHubAppLive` and `ActionCacheLive` require). See `packages/github-action-effects/src/runtime/ActionsRuntime.ts`.
- **`Step`** -- Step-buffered logging primitive (`withStep`, `success`, `failure`, `collapse`, `groupStep`). A step opens a per-step debug buffer, emits one success line on success and spills the buffer under a failure header on failure; warnings and errors always pass through. Nested calls track depth via a fiber-local `StepStack`. The step logger replaces all pre-installed loggers for the step's scope via `Effect.locally` so debug lines are not double-printed. See `packages/github-action-effects/src/runtime/Step.ts`.

Consumer pattern:

```typescript
// Inputs via Effect's Config API (backed by ActionsConfigProvider)
const name = yield* Config.string("name")      // reads INPUT_NAME
const count = yield* Config.integer("count")    // reads INPUT_COUNT

// Logging via Effect Logger (backed by ActionsLogger)
yield* Effect.log("hello")                      // plain stdout
yield* Effect.logDebug("details")               // ::debug::details
yield* Effect.logWarning("caution")             // ::warning::caution

// Option A: Direct layer provision
program.pipe(Effect.provide(ActionsRuntime.Default))

// Option B: Action.run with error handling + buffering
Action.run(program)
```

---

## Rationale

### Architectural decisions

#### AD-1: No @actions/* dependencies

- **Decision:** All `@actions/*` packages removed. The library uses native
  ESM implementations for the GitHub Actions runtime protocol.
- **Rationale:** The `@actions/*` packages are CommonJS, cannot be tree-shaken,
  and create version coupling between the library and consumers. The runtime
  protocol (workflow commands via stdout, environment files) is simple and
  well-documented. Native implementations give full control, better error
  handling via Effect and zero CJS in the dependency tree.
- **Direct dependencies:** `@octokit/rest` for REST/GraphQL API access,
  `@octokit/auth-app` for GitHub App authentication. These are ESM-compatible
  and provide the Octokit API surface directly.

#### AD-2: Inputs via the Config API

- **Decision:** Action inputs are read via Effect's `Config` API backed by
  `ActionsConfigProvider`, not a dedicated `ActionInputs` service.
- **Rationale:** Effect's `Config` API is the idiomatic way to read
  configuration. The `ActionsConfigProvider` maps config keys to `INPUT_*`
  environment variables, matching GitHub Actions behavior. This eliminates a
  dedicated service while providing schema validation, composition, and
  default values through Effect's built-in `Config` combinators.

#### AD-3: Two entry points -- main and testing subpath

- **Decision:** Two barrel exports: `src/index.ts` (main) and `src/testing.ts` (the `./testing` subpath in `package.json`). The `./testing` subpath omits the symbols whose import graph pulls in the heavyweight runtime-only dependencies — see the omitted set at the head of `src/testing.ts` (it drops the Octokit-importing layers, the `GitHubToken` namespace, the `Action` namespace and the `Step` module).
- **Rationale:** Test environments may not have `@octokit/rest` or `@octokit/auth-app` installed. The `./testing` subpath lets test files import everything they need without triggering those dependency imports.

#### AD-4: Services over frameworks

- **Decision:** Export composable Effect services, not an opinionated runner
- **Rationale:** Users may have their own Effect programs, layers and error
  strategies. Providing services lets them compose freely.

#### AD-5: GFM builder standalone from check runs

- **Decision:** GFM/markdown builders are independent of the CheckRun service
- **Rationale:** GFM output is used in check run summaries, PR comments, issue
  bodies and step summaries. Coupling it to check runs would limit reuse.

#### AD-6: Class-based Context.Tag and inline Data.TaggedError

- **Decision:** Services use `class Foo extends Context.Tag("github-action-effects/Foo")<Foo, { ... }>() {}`
  and errors use `class FooError extends Data.TaggedError("FooError")<{ ... }> {}`.
- **Rationale:** `Context.GenericTag` is deprecated in modern Effect. The
  class-based `Context.Tag` merges the interface and tag into a single
  declaration. Error types use inline `Data.TaggedError` without a separate
  `Base` export.

#### AD-7: Schema-based state serialization

- **Decision:** ActionState uses `Schema.encode` / `Schema.decode` for
  multi-phase state transfer rather than raw JSON.stringify/parse
- **Rationale:** State is persisted via `GITHUB_STATE` environment file and
  read back via `STATE_*` environment variables. Using Effect Schema for the
  round-trip provides type-safe encoding, decode validation and clear
  `ActionStateError` on phase-ordering bugs.

#### AD-8: Utility namespaces for lightweight abstractions

- **Decision:** Pure computation patterns and thin API wrappers use
  `const X = { ... } as const` namespace objects instead of full services
- **Rationale:** The pure-computation namespaces (GithubMarkdown, SemverResolver, ErrorAccumulator, AutoMerge, ReportBuilder, RegistryClassifier and the in-toto/SLSA helpers) do not need dependency injection or state management. Namespace objects avoid service ceremony while remaining api-extractor compatible.

### Constraints

#### Node.js 24 runtime

GitHub Actions runners support Node.js 24. We can use modern APIs and
ES2024+ features freely (native `fetch`, `crypto.randomUUID()`,
`node:child_process`, etc.).

#### GitHub Actions runtime protocol

Actions communicate through environment variables, file-based commands
(`GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_STATE`, `GITHUB_PATH`), and
workflow commands written to stdout (`::command::message`). All services
respect these conventions via the `packages/github-action-effects/src/runtime/` implementations.

#### Bundle size

Actions built with `@savvy-web/github-action-builder` bundle every dependency into a single self-contained ESM file per entry (via `@rsbuild/core`), so the Effect library adds to bundle size. This is acceptable — Effect tree-shakes well and action bundles are not size-constrained like browser bundles.

---

## Related Documentation

**Package Documentation:**

- `packages/github-action-effects/README.md` — package overview and quick-start guide

**Sibling Package:**

- [`@savvy-web/github-action-builder`](../github-action-builder/architecture.md) — co-located at `packages/github-action-builder`, bundles the actions these services run in

**External References:**

- [Effect Documentation](https://effect.website)
- [GitHub Actions Workflow Commands](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions)
