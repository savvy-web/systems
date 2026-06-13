---
status: current
module: github-action-effects
category: architecture
created: 2026-03-06
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 92
related:
  - ./index.md
  - ./layers.md
  - ./errors-and-schemas.md
  - ./testing-strategy.md
dependencies: []
---

# Services

The service catalog map, namespace objects and the load-bearing semantics for `@savvy-web/github-action-effects`.

See [index.md](./index.md) for the architecture overview and [layers.md](./layers.md) for live and test layers.

---

## Overview

Each service is an independently usable Effect module under `packages/github-action-effects/src/services/`, with one tagged error type and (where it matters) co-located result interfaces. This doc is the "where does X live and what is it for" map plus the few services whose semantics are non-obvious. For the exact method signatures of any service, read its source file — the barrel at `src/index.ts` lists every public symbol.

`Action.run()` automatically provides `ActionsRuntime.Default`, so programs also have `FileSystem` and a fetch-backed `HttpClient` without providing them manually. Inputs are read via Effect's `Config` API backed by `ActionsConfigProvider` (not a dedicated service); the `ActionInput` runtime helper adds GitHub-faithful `boolean`/`multiline` combinators on top of the same provider. Logging goes through the Effect Logger backed by `ActionsLogger`.

```text
@savvy-web/github-action-effects
├── Runtime Layer (replaces @actions/*)
│   ├── WorkflowCommand       — ::command:: protocol formatter with escaping
│   ├── RuntimeFile           — Env file appender (GITHUB_OUTPUT, GITHUB_ENV, etc.)
│   ├── ActionsConfigProvider — ConfigProvider reading INPUT_* env vars
│   ├── ActionInput           — GitHub-faithful boolean/multiline Config combinators
│   ├── ActionsLogger         — Effect Logger emitting workflow commands
│   ├── ActionsRuntime        — Single convenience Layer wiring everything
│   └── Step                  — Step-buffered logging (withStep/success/failure/collapse/groupStep)
│
├── Core Action I/O
│   ├── ActionLogger          — Log groups + buffered output
│   ├── ActionOutputs         — Typed output setting and step summaries
│   ├── ActionState           — Schema-serialized state for multi-phase actions
│   ├── ActionEnvironment     — Schema-validated GitHub/Runner context variables
│   └── ActionCache           — Cache save/restore via V2 Twirp protocol
│
├── Git Operations (Git Data API)
│   ├── GitBranch             — Branch management
│   ├── GitCommit             — Verified commits (tree/commit/ref, file add+delete)
│   └── GitTag                — Tag management
│
├── GitHub API
│   ├── GitHubClient          — Direct @octokit/rest; namespace layer (fromEnv/fromToken/fromApp)
│   ├── GitHubGraphQL         — GraphQL queries/mutations
│   ├── GitHubRelease         — Releases + assets
│   ├── GitHubIssue           — Issue management + linked issues
│   ├── GitHubApp             — App authentication lifecycle
│   ├── OctokitAuthApp        — Wrapper for @octokit/auth-app createAppAuth
│   ├── CheckRun              — Check runs with bracket pattern
│   ├── PullRequest           — PR lifecycle (CRUD, merge, labels, reviewers, files)
│   ├── PullRequestComment    — Sticky (upsert) PR comments
│   ├── RateLimiter           — Rate-limit awareness and retry
│   ├── WorkflowDispatch      — Trigger and monitor workflow runs
│   ├── GitHubContent         — Read repository file contents at a ref
│   ├── GitHubCommit          — Read the commit graph (get/list/compare/changedFiles)
│   ├── GitHubArtifactMetadata — GitHub Packages artifact-metadata storage records
│   └── Artifact              — Workflow artifact upload/download (V2 Twirp + Azure Blob)
│
├── Build Tooling
│   ├── CommandRunner         — Structured shell execution (node:child_process)
│   ├── NpmRegistry           — npm registry queries + per-registry integrity probe
│   ├── PackagePublish        — Multi-registry publishing
│   ├── PackageManagerAdapter — Unified PM operations (npm/pnpm/yarn/bun/deno)
│   ├── WorkspaceDetector     — Monorepo workspace detection
│   ├── ToolInstaller         — Tool binary download/extract/cache
│   ├── Glob                  — Glob matching + file hashing over node:fs
│   ├── ChangesetAnalyzer     — Changeset file parsing and generation
│   ├── ConfigLoader          — JSON/JSONC/YAML config loading with schema validation
│   ├── TokenPermissionChecker — Token permission validation + enforcement
│   └── DryRun                — Mutation interception for dry-run mode
│
├── Attestation
│   ├── Attest                — End-to-end attest/sign/upload + listForSubject
│   ├── OidcTokenIssuer       — GitHub Actions OIDC token for Sigstore
│   ├── SigstoreSigner        — Sign an in-toto statement → Sigstore bundle
│   └── Sbom                  — CycloneDX 1.5 BOM generation and serialization
│
├── Namespace Objects
│   ├── Action.*              — run, resolveLogLevel, formatCause
│   ├── GitHubToken.*         — provision, client, dispose, read, botIdentity
│   └── GithubMarkdown.*      — table, heading, details, bold, code, etc.
│
└── Utility Namespaces / helpers
    ├── AutoMerge             — PR auto-merge enable/disable via GraphQL
    ├── SemverResolver        — Semver comparison, parsing, resolution
    ├── ErrorAccumulator      — Process-all-collect-failures pattern
    ├── ReportBuilder         — Fluent markdown report builder
    ├── RegistryClassifier    — URL-safe registry detection/display
    ├── IoUtil / PathUtils    — Filesystem + path helpers
    └── intoto / slsa         — in-toto statement + SLSA provenance helpers
```

---

## Namespace objects

The public API groups related functions under namespace objects to keep the barrel small and stay api-extractor compatible. Functions are defined as properties of the namespace; they are not exported individually.

- **`Action`** (`src/Action.ts`) — top-level helpers: `run` (the entry-point wrapper, below), `resolveLogLevel`, `formatCause`.
- **`GitHubToken`** (`src/GitHubToken.ts`) — the App installation-token lifecycle across pre/main/post phases. See [GitHubToken lifecycle](#githubtoken-lifecycle).
- **`GithubMarkdown`** (`src/utils/GithubMarkdown.ts`) — pure GFM builders (`table`, `heading`, `details`, `bold`, `code`, `codeBlock`, `link`, `list`, `checklist`, `rule`, `statusIcon`).

---

## Load-bearing service semantics

Most service methods are self-explanatory from their file. The behaviors below are non-obvious and worth knowing before editing the caller.

- **`GitHubClient`** — `retryable` on `GitHubClientError` is true for 429, any 5xx and a 403 carrying a secondary-rate-limit signal; a bare 403 stays non-retryable. The three construction modes are documented in [layers.md](./layers.md#githubclientlive-construction-modes). See [errors-and-schemas.md](./errors-and-schemas.md#error-hierarchy).
- **`GitHubCommit` vs `GitCommit`** — `GitHubCommit` reads the commit graph over `repos.getCommit`/`listCommits`/`compareCommits`; `GitCommit` *writes* via the Git Data API. `GitHubCommit.compare` paginates by commit, so a single-commit comparison truncates to the first 300 files — use `changedFiles` (paginates by the commit's files) for the full set on large squash merges.
- **`GitTag.resolve`** unwraps annotated tags: when the ref type is `tag` it dereferences to the target commit SHA, so the result is always a commit SHA.
- **`CheckRun`** caps annotations at 50 per API call; `create` returns a `CheckRunData` record (not just an id).
- **`PullRequestComment`** uses `<!-- savvy-web:KEY -->` HTML-comment markers for sticky-comment idempotency.
- **`PackagePublish`** — `publish`/`publishToRegistries` route through the active PM's executor (`pnpm dlx npm`, `yarn npm`) so callers get npm ≥ 11.5.1 OIDC trusted publishing regardless of the workspace PM; `pack` computes both an sha512 integrity `digest` and a hex `sha256Hex` (for attestation APIs); `publishTarball` uploads a pre-packed tarball byte-identically to multiple registries. `publishIdempotent` is deprecated — new callers compose `pack`, `NpmRegistry.getPublishedIntegrity` and `publishTarball`.
- **`NpmRegistry.getPublishedIntegrity`** returns `Option<string>` — `none` on a 404 (version absent), `some(integrity)` when found; other failures propagate as `NpmRegistryError`.
- **`Attest.listForSubject`** is pinned to `X-GitHub-Api-Version: 2026-03-10`, under which the inline Sigstore bundle is dropped, so `predicateType` is recovered either via the `predicate_type` query param (when filtered) or by fetching each entry's `bundle_url`. Returns `[]` on 404.
- **`OidcTokenIssuer`** requires `id-token: write` in the workflow permissions and returns a `Redacted<string>`.
- **`Sbom.generate`** carries the NTIA-required metadata (`supplier`, `authors`) and an `inFlightPackages` escape hatch for workspace packages not yet on a registry.
- **`Artifact`** uploads/downloads workflow artifacts over the same V2 Twirp + Azure Blob path as `ActionCache`; the cross-run/cross-repo REST `findBy` path is the documented exception.
- **`Glob`** wraps `node:fs.globSync`; several `@actions/glob` options are accepted for parity but are documented no-ops because `globSync` has no equivalent — see the `GlobOptions` doc comments in `src/services/Glob.ts`.
- **`GitHubApp.resolveAppIdentity`** makes two requests (`GET /app` with the App JWT, then `GET /users/<slug>[bot]`); passing an installation token runs the public `GET /users` lookup authenticated (5000 req/hr) instead of unauthenticated (60 req/hr). `botIdentity` delegates to `formatBotIdentity` — see [errors-and-schemas.md](./errors-and-schemas.md#shared-internal-helpers).

---

## Utility namespaces

Pure helpers with no service dependencies, in `src/utils/`:

- **`GithubMarkdown`** — pure GFM string builders.
- **`SemverResolver`** — Effect wrapper over `semver-effect` (`SemverResolverError`).
- **`AutoMerge`** — PR auto-merge enable/disable; depends on `GitHubGraphQL`.
- **`ErrorAccumulator`** — process-all-collect-failures (`forEachAccumulate`, `forEachAccumulateConcurrent`).
- **`ReportBuilder`** — fluent markdown report builder with summary/comment/check-run output targets.
- **`RegistryClassifier`** — URL-safe registry detection that parses URLs and checks hostnames (not substrings) to prevent CWE-20 bypass; a null/undefined registry resolves to `"npm"`.
- **`IoUtil` / `PathUtils`** — filesystem and path helpers.
- **`intoto` / `slsa`** — in-toto statement construction (`buildStatement`, `subject`, `npmPurl`, `serializeStatement`) and SLSA provenance predicate building (`buildSLSAProvenancePredicate`, `decodeJwtClaims`, `GITHUB_BUILD_TYPE`).

---

## Action.run helper

`Action.run(program, options?)` wires an Effect program into a GitHub Action entry point with standard boilerplate. It provides `ActionsRuntime.Default`, wraps the program in `ActionLogger.withBuffer("action", program)`, catches all causes via `Effect.catchAllCause` (emitting `::error::` plus a `::debug::` stack/span trace), sets `process.exitCode = 1` on failure and merges any user-supplied `options.layer`. A last-resort catch on the promise still sets a non-zero exit if the error handler itself fails. See `src/Action.ts`.

---

## GitHubToken lifecycle

`GitHubToken` (`src/GitHubToken.ts`) is a namespace object orchestrating the GitHub App installation-token lifecycle across a multi-phase action. It holds no state of its own — it draws on `GitHubApp`, `ActionState` and `TokenPermissionChecker`, and uses `GitHubClientLive.fromToken` to build the client. Crucially, every helper exposes its dependencies in the `R` channel rather than self-providing them, so a consumer must supply a `GitHubApp` layer (`GitHubAppLive` + `OctokitAuthAppLive` in production, `GitHubAppTest` in tests).

The helpers communicate through a single internal `ActionState` key (`github-action-effects/installation-token`) carrying the `InstallationToken` envelope:

```text
pre.ts   GitHubToken.provision()  — resolve App credentials, generate token,
                                    best-effort resolve App identity, enrich
                                    token, optionally verify scopes, persist
                                          │
                                          ▼  ActionState (GITHUB_STATE file)
                                          │
main.ts  GitHubToken.client()     — read envelope, build GitHubClient layer
                                    via GitHubClientLive.fromToken
         GitHubToken.read()       — read raw InstallationToken from state
         GitHubToken.botIdentity() — derive BotIdentity from persisted token
                                          │
post.ts  GitHubToken.dispose()    — read envelope, revoke token via GitHubApp
```

Two behaviors are load-bearing:

- **`provision`** resolves App identity by passing the freshly minted installation token to `resolveAppIdentity`, wrapped in `Effect.option` so a network hiccup degrades to a token without identity fields rather than crashing the action. Credentials are hybrid: `clientId`/`privateKey` default to the `app-client-id`/`app-private-key` action inputs and the options object overrides them.
- **`dispose`** is a deliberate no-op when nothing was persisted, because `post` steps run even when `pre`/`main` failed — a cleanup step must not crash because there is nothing to revoke.

---

## Current State

The service catalog, the namespace objects and the runtime layer (which eliminates all `@actions/*` dependencies) are stable. The barrel at `src/index.ts` is the authoritative inventory.

## Rationale

Services are independent, composable Effect modules so action authors pick only what they need. The namespace-object pattern keeps the public surface small while staying compatible with api-extractor.

## Related Documentation

- [index.md](./index.md) — architecture overview and design decisions
- [layers.md](./layers.md) — live and test layer implementations
- [errors-and-schemas.md](./errors-and-schemas.md) — error types and schema patterns
- [testing-strategy.md](./testing-strategy.md) — testing approach and coverage
