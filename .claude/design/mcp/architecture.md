---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-06-01
last-synced: 2026-06-01
completeness: 95
related:
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
  - ../docs/architecture.md
  - ../api-extractor-llms/architecture.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp architecture

The `savvy-mcp` server — a standalone, spawnable MCP server that serves Silk Suite tooling and library knowledge to coding agents as structured tools and curated resources. Built on an Effect `ManagedRuntime` over `@savvy-web/silk-effects` plus the `@modelcontextprotocol/sdk`.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The Information-vs-Direction Split](#the-information-vs-direction-split)
- [The Runtime Layer](#the-runtime-layer)
- [The Tool Half](#the-tool-half)
- [The Resource Half](#the-resource-half)
- [Root Resolution](#root-resolution)
- [Plugin Integration](#plugin-integration)
- [Boundaries and Invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a human) alongside an agent in the project working directory, shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text — and to serve library knowledge as MCP resources agents research before guessing.

It is **not** a discovery host. An earlier silk-core framing imagined a thin host reading a `./savvy` contribution contract from installed packages; that is dropped. The MCP is a content-rich server with two concrete jobs (tools and resources) and no discovery seam. It reuses `@savvy-web/silk-effects` for tool logic — the same business layer the `savvy` CLI uses.

**Package:** `@savvy-web/mcp`
**Location:** `packages/mcp` in `savvy-web/systems`
**Bin:** `savvy-mcp` → `src/bin.ts` → `startMcpServer()` in `src/server.ts`
**Build:** ESM-only via `@savvy-web/rslib-builder` (`NodeLibraryBuilder`)

This is Silk Core sub-project 2. The server grew in three increments — the walking-skeleton tool host, the manifest-backed resource-layer rebuild, then the Phase B work (API-doc generation pipeline, body search, related-graph boost, query logging) — all now as-built and described below. For the forward-looking roadmap see `docs/superpowers/specs/2026-06-01-silk-suite-0.1.0-closeout-and-roadmap.md`.

## Current State

Implemented and verified end-to-end. The server ships two tools (`workspace_info`, `silk_docs_search`), the manifest-backed resource layer (`silk://catalog` plus a single `silk://{+path}` template over an on-disk markdown corpus), a turbo-orchestrated API-doc generation pipeline, body-content search, a related-graph retrieval boost, structured query logging, and MCP wiring across three Claude Code plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) that each spawn the same server. `private: true` in source; the builder flips it on build.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`), `workspaces-effect`, `@effect/platform`, `@effect/platform-node`, `effect`, `@modelcontextprotocol/sdk`, `fuse.js` and `zod` (v4). `api-extractor-llms` — an external npm package (extracted from this monorepo), not a workspace sibling — is a `devDependency` (`^0.1.0`, used only by the `generate:api-docs` script, not bundled into the server). Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process so silk-effects is a normal runtime **dependency**, not bundled.

What is **not** built (deferred to Phase C): per-service/deep API pages; separate-repo package overviews and action docs; the cross-repo refactor of `rspress-plugin-api-extractor` to consume `api-extractor-llms`; `silk://guides/silk-v2-release-pipeline` (blocked until the v2 pipeline exists); and MCP completions/subscriptions/pagination.

## The Information-vs-Direction Split

The load-bearing architectural principle. **Information lives in the MCP; direction lives in the plugins.** The server carries every resource and tool regardless of the current project — including, eventually, GitHub Actions knowledge. Each plugin decides which resources and tools to point the agent at, so a non-Actions project never gets bloated with Actions context even though the shared server could serve it. This split is why three plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) spawn the identical server but orient the agent differently. The MCP itself carries no per-project gating.

## The Runtime Layer

One long-lived Effect `ManagedRuntime`, built from `SilkRuntimeLive` (`src/runtime.ts`), composed **directly** from `silk-effects` and `workspaces-effect` exports — both of which mcp is allowed to import, so the cli↔silk↔mcp non-import invariant holds without indirection.

`SilkRuntimeLive` exposes two services: `SilkWorkspaceAnalyzer` (the skeleton's one tool) and `WorkspaceRoot` (for root walk-up — see [Root Resolution](#root-resolution)). It is built by providing `SilkWorkspaceAnalyzerLive` + `WorkspaceRootLive` with a `DepsLive` merge of `WorkspacesLive` (the workspace trio plus `DependencyGraph` and `TopologicalSorter` the analyzer needs), `ChangesetConfigReaderLive`, `TagStrategyLive` and `VersioningStrategyLive` (itself fed `ChangesetConfigReaderLive`, since `Layer.mergeAll` does not cross-feed siblings). The layer still requires `FileSystem` + `Path`; `bin.ts` supplies them at the edge via `NodeContext.layer`. See `src/runtime.ts` for the exact wiring.

`SilkRuntimeLive` composes its **own** stack rather than hoisting the CLI's. The CLI's `AppLive` does not include the analyzer (the two runtimes genuinely diverge) and the only shared surface is the three-line workspace-trio wiring, so a shared layer would couple two diverging consumers for negligible gain. Extracting one is deferred until a second host needs the same composition (YAGNI). No CLI code is touched by this package.

The smoke tests (`__test__/runtime.smoke.test.ts`, `server.smoke.test.ts`) are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck.

## The Tool Half

Every tool follows the conventions proven by `workspace_info` (`src/tools/workspace-info.ts`):

- **Effect Schema is the source of truth** for input and output, with `.annotations()` carrying descriptions. The handler runs as `runtime.runPromise(Effect.gen(...))`, yielding silk-effects services; all logic stays in silk-effects and the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.transformOrFail` (decode succeeds to markdown, encode is `Forbidden`), and the tool returns `{ content: [{ type: "text", text }], structuredContent: <json> }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool` accepts only zod schemas, not raw JSON Schema. The bridge (`src/schema/effect-to-zod.ts`) routes Effect Schema → `JSONSchema.make` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place the canonical Effect Schema crosses into the SDK's world; `zod` (v4) is a boundary dependency only.

`workspace_info` wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis` (`WorkspaceInfoResult`): `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in `AnalyzedWorkspace` (which the zod bridge cannot inline) and is more token-efficient for the agent. See `src/tools/workspace-info.ts` for the schema, the `toWorkspaceInfoResult` mapper and the transcript transform.

`silk_docs_search` (`src/tools/docs-search.ts`) is the read-only entry into the resource corpus. It takes a plain keyword/phrase query — no operator DSL — and returns ranked hits with a normalized higher-is-better `confidence` plus a high/medium/low `confidenceLabel`. It runs **synchronously off the in-memory index, not the Effect runtime** (no silk-effects services involved), and never returns empty: when nothing scores, it falls back to the priority-ordered top-N so the agent always has a starting point. Results also carry an optional `related` field (see [The Resource Half](#the-resource-half)) and a structured stderr query log line is emitted per call (see [Query Logging](#query-logging)). See [The Resource Half](#the-resource-half) for the index it queries.

## The Resource Half

Resources serve a curated, on-disk markdown corpus behind a stable URI scheme. A build-time compiler validates the corpus and emits a manifest; the runtime serves from that manifest plus the bodies on disk. The Phase B work added an ephemeral API-doc generation pipeline that feeds generated docs into this same corpus.

### The content corpus and its identity contract

The corpus lives under `src/resources/content/{standards,packages,guides}/**.md`. Each file carries YAML front-matter (`id`, `title`, `summary`, `tier`, `source`, `status`, `tags`, `audience`, `priority`, `related`). The front-matter shape is the load-bearing contract — see the Effect Schemas in `src/resources/schema.ts` (`DocFrontMatter`, `ManifestEntry`, `Manifest`).

The **`id` is the stable identity**, not the file path: the URI is derived as `silk://<id>`, never from where the file sits on disk. `ID_PATTERN` requires the id to be tier-prefixed and allows an optional trailing slash for directory-index docs (e.g. `packages/silk-effects/` resolves to `content/packages/silk-effects/index.md`). Directories prefixed with `_` (e.g. `_templates/`) are skipped by the compiler.

The URI taxonomy stays stable when `packages/*` content swaps from hand-authored to generated-from-API-model:

- `silk://standards/<topic>` — Silk development standards (commits, changesets, lint, testing, semver, dependency conventions, API model pipeline).
- `silk://packages/<pkg>/<topic>` — per-package API/usage docs; the `packages/<pkg>/api/<kind>/<slug>` sub-path is the generated API-reference space.
- `silk://guides/<slug>` — higher-level conceptual articles layered over the packages.

Tags are drawn from a controlled vocabulary in `content/tags.json` (canonical tags → aliases); the compiler canonicalizes and rejects unknown tags via `src/resources/tags.ts`.

### The API-doc generation pipeline

Generated docs are `source: generated` entries in the corpus. They are produced by an ephemeral turbo-orchestrated pipeline and are **gitignored** (`src/resources/content/packages/*/api/`). On a fresh clone or bare install they are absent; `build:catalog` and `build:dev`/`build:prod` will (re)generate them via turbo.

**Targets.** `scripts/api-targets.ts` declares the four in-monorepo library packages that are generation targets: `silk-effects`, `templates`, `github-action-effects` and `github-action-builder`. `@savvy-web/silk` and `@savvy-web/cli` are excluded because they are not libraries. `@savvy-web/mcp` is excluded because its generated docs are an input to `build:catalog` → `build:dev`, so a `generate:api-docs → mcp#build:dev` dependency would be a turbo cycle. Excluding mcp keeps the build subgraph acyclic even if `silk` later depends on `mcp`.

**Generator.** `scripts/generate-api-docs.ts` reads each target's `dist/npm/<unscoped>.api.json` (emitted by `build:prod`), calls the external `api-extractor-llms` package's `renderPackage` with two injected services, and writes the resulting docs under `content/packages/<dir>/api/`. The two injected services are:

- A `FrontmatterRenderer` — `frontMatterFor(target, meta)` → `toYaml(fm)` — that builds silk YAML front-matter with `source: generated`, `tier: packages`, `tags: [<dir>, api]`, `priority: 0.3` and **empty `related`**.
- A `RouteFormatter` — `silk://packages/<dir>/api/<kind>/<slug>` — that maps item refs to silk URIs.

Generated docs carry empty `related` by design (decision 4 from the plan): no committed hand-authored doc may reference a generated `packages/*/api/*` id, because a bare install skips generation and would leave dangling references in `build:catalog`. The related-graph boost (see [Search Index](#search-index)) therefore operates only on hand-authored links.

The generator is **skip-tolerant**: if a target's model is absent, it logs `SKIP` and exits 0. A bare `pnpm install` (which runs `prepare: turbo run build:dev`) therefore never fails due to a missing model.

The body-budget guard in `scripts/compile.ts` exempts `source: generated` docs from the per-tier byte-size warning — generated pages are split per API item, not editorially constrained.

**Turbo orchestration.** `packages/mcp/turbo.json` (extends `//`) declares the task graph:

```text
@savvy-web/{silk-effects,templates,github-action-effects,github-action-builder}#build:prod
      ↓ (emit dist/npm/*.api.json)
@savvy-web/mcp#generate:api-docs
      ↓ (write content/packages/*/api/**)
@savvy-web/mcp#build:catalog
      ↓ (compile manifest.json)
@savvy-web/mcp#build:dev / build:prod
```

`generate:api-docs` depends only on the four explicit in-monorepo library `#build:prod` tasks (not `^build:prod`) so `silk`/`cli`/`mcp` never enter mcp's build subgraph. It has **no** workspace edge for the renderer itself: `api-extractor-llms` is now an external npm package, so the generator pulls it from `node_modules` rather than waiting on a sibling build (the former `@savvy-web/api-extractor-llms#build:dev` edge is gone). `build:catalog` depends on `generate:api-docs`. mcp's own `build:dev`/`build:prod` depend on `build:catalog`. The four prod builds are `cache: true`, so turbo restores their `dist/npm` (including `.api.json`) from cache on repeat runs. `generate:api-docs` and `build:catalog` are `cache: false` (outputs are ephemeral build artifacts, not committed).

See `../api-extractor-llms/architecture.md` for the external library that performs the actual rendering.

### The build-time compiler

`scripts/compile.ts` holds the pure `compileCorpus` (no I/O); `scripts/build-catalog.ts` is the I/O shell that walks the corpus, parses front-matter with gray-matter, runs `compileCorpus`, and writes `content/manifest.json`. Integrity checks fail the build on any error: id uniqueness, tier↔directory match, `related`-target resolution, controlled tags, per-tier body-size budgets (skipped for `source: generated`), a dead `workflow-*`-name grep, the generated-doc provenance marker, and a `git log` lastModified stamp per doc. The manifest is a **gitignored build artifact**, regenerated each build.

`build:catalog` (run with `tsx`) is sequenced via turbo (see above) ahead of `build:dev`/`build:prod`. `rslib.config.ts` `copyPatterns` bundles `content/` into `dist/<env>/resources/content` so the built binary serves the same corpus, including generated docs.

### Runtime serving

Two discovery surfaces coexist over the manifest:

- **`silk://catalog`** is a single FIXED resource rendered from the manifest by `catalog.ts`, listing every doc grouped by tier with a "load when …" hint. Generated API-reference docs appear in the catalog marked `(generated)`. It is the agent's mandated first read.
- A single **`silk://{+path}` `ResourceTemplate`** (`src/resources/index.ts`) handles both `list()` and read. `list()` returns every doc except the catalog and `deprecated` docs; the read handler keys the body lookup off `variables.path` (never `uri.pathname`). Per-doc annotations (audience/priority/lastModified) appear in both list entries and read contents.

`load.ts` resolves the content root across the source and built layouts (throwing a diagnostic that lists the probed paths if no manifest is found) and reads bodies through the path-security resolver in `paths.ts`. See `src/resources/{catalog,index,load,schema}.ts` for the model.

### Search index

`silk_docs_search` queries an in-memory Fuse `DocIndex` (`src/resources/doc-index.ts`), built once in `bin.ts` before `server.connect` and held per process. The Fuse key weights are title 0.55 / tags 0.3 / summary 0.12 / **body 0.03**. The body key is low-weight so body matches rescue body-only terms without letting long bodies dominate ranking over title and tag matches. Results tie-break by curated `priority`, and the index never returns empty (priority-ordered fallback).

**Related-graph boost.** After Fuse ranks, the `DocIndex.search` method inspects the top-3 hits' `related` arrays and appends any neighbors not already in the result set as low-confidence "see also" entries (confidence 0, `matchedOn: ["related"]`). The related graph is compile-time validated so every `related` id resolves. Generated docs carry empty `related`, so the boost operates only on hand-authored links. `SearchResult` and `DocsSearchHit` carry an optional `related` field exposing the hit's related ids to the agent.

### Query logging

`src/resources/query-log.ts` provides a pure `formatQueryLogLine(query, results)` → string formatter and a `stderrQueryLogger` sink. The tool handler (`runDocsSearch`) accepts an optional `QueryLogger` and, when one is supplied, emits one structured JSON line to stderr per query: `[savvy-mcp] docs-search {"query":…,"topResults":[…],"topConfidence":…,"belowThreshold":…}`. Privacy-clean — no user content beyond the query string and the top result URIs. The logger is wired in `src/server.ts` using `stderrQueryLogger`. Tests inject a spy logger.

## Root Resolution

The `savvy-mcp` bin resolves its base directory by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (`src/bin.ts`). Because dev tooling launches the server from `packages/mcp/` rather than the repo root, the `workspace_info` handler additionally resolves the true workspace root by walking up from its base dir (or an explicit `cwd` argument) via `WorkspaceRoot.find` before analyzing — so the tool works from any subdirectory. The walk-up lives in the **mcp handler, not the analyzer**, so the analyzer/CLI contract stays unchanged.

## Plugin Integration

A plugin declares the server via an `mcpServers` block in `.claude-plugin/plugin.json` whose command runs a `bin/start-mcp.sh` launcher (detect package manager → `exec <pm> savvy-mcp`), passing the project dir through `CLAUDE_PROJECT_DIR`. The same launcher and declaration are reused by all three plugins — `plugins/silk`, `plugins/github-actions` and `plugins/docs` — and each is registered in the repo's `.claude-plugin/marketplace.json`.

Direction is added per plugin as SessionStart orientation hooks telling the agent to read `silk://catalog` before researching, prefer `silk_docs_search` over filesystem grep, and consult `workspace_info` before reporting workspace facts. The silk and github-actions hooks were strengthened to the `cc-nudge-hooks` TIER-1/TIER-2 structure and now drain stdin; `plugins/github-actions` is no longer an empty skeleton (its hook libs are the full-featured silk versions). `plugins/docs` adds the *write* side of direction — an `mcp` corpus-authoring agent and two mode commands — over the same shared server. See `../silk/plugin.md` for the silk read-side orientation and the `docs-search` skill, and `../docs/architecture.md` for the docs plugin and the three-tier query/authoring split.

When several plugins are active in one session, each declares the server, so Claude Code may spawn one instance per plugin. The server is stateless and lightweight, so this is acceptable.

## Boundaries and Invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from `silk-effects` (and `workspaces-effect`), preserving the cli↔silk↔mcp non-import invariant. `api-extractor-llms` is no longer part of this invariant: it is an external npm package, consumed by mcp purely as a build-time `devDependency` (the generator script imports it from `node_modules`), so it is outside the workspace dependency graph entirely.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is canonical; zod is a boundary-only dependency** confined to the `effect-to-zod` bridge at the SDK registration edge.
- **Generated docs carry empty `related`.** No committed hand-authored doc may reference a generated `packages/*/api/*` id — a bare install skips generation and would leave a dangling `related` reference that fails `build:catalog`. The related-graph boost operates only on hand-authored `related` links, which are always present.

## Rationale

### Why a standalone server, not a discovery host

The parent silk-core spec framed the MCP as a thin discovery host peer to the CLI reading a contribution contract. That framing is dropped as premature coupling. A content-rich standalone server with a fixed tool/resource surface ships value now; the discovery seam — if it ever returns — is a future concern, and the information-vs-direction split already gives per-project tailoring without one. The CLI remains the bridge for what tools cannot yet cover.

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the Effect-Schema → JSON-Schema → zod bridge cannot inline. Projecting to a flat, name-only result both satisfies the bridge and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.

### Why generated docs are ephemeral and gitignored

Generated API docs are a deterministic function of the source packages' `.api.json` models, which are themselves build artifacts. Committing them would bloat the repo and create a false impression that they are hand-maintained. The turbo pipeline reconstructs them on any machine that builds mcp. The skip-tolerant generator ensures a bare install never fails even when models are absent.

### Why the related-graph boost uses compiled-time-validated ids

The corpus compiler rejects dangling `related` references as a build error. Every `related` id in the manifest therefore resolves to a live doc. The boost can safely look up neighbors by URI without defensive null handling. Generated docs opt out of the boost by carrying empty `related` — they are transient enough that cross-linking them into the hand-authored graph would create links that disappear on a bare install.
