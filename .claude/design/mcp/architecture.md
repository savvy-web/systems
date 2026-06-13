---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-06-12
last-synced: 2026-06-12
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
**Build:** ESM-only via `@savvy-web/bundler` (M5 self-host); the markdown corpus ships through the
top-level `public/content` copy convention. See [The content corpus](#the-content-corpus-and-its-identity-contract).

This is Silk Core sub-project 2. The server grew in three increments — the walking-skeleton tool host, the manifest-backed resource-layer rebuild, then the Phase B work (API-doc generation pipeline, body search, related-graph boost, query logging) — all now as-built and described below. For the forward-looking roadmap see `docs/superpowers/specs/2026-06-01-silk-suite-0.1.0-closeout-and-roadmap.md`.

## Current State

Implemented and verified end-to-end. The server ships five tools (`workspace_info`, `silk_docs_search`, `turbo_inspect`, `changeset_inspect`, `biome_check`), the manifest-backed resource layer (`silk://catalog` plus a single `silk://{+path}` template over an on-disk markdown corpus), a turbo-orchestrated API-doc generation pipeline, body-content search, a related-graph retrieval boost, structured query logging, and MCP wiring across three Claude Code plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) that each spawn the same server. `private: true` in source; the builder flips it on build.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`), `workspaces-effect`, `@effect/platform`, `@effect/platform-node`, `effect`, `@modelcontextprotocol/sdk`, `fuse.js` and `zod` (v4). `api-extractor-llms` — an external npm package (extracted from this monorepo), not a workspace sibling — is a `devDependency` (`^0.1.0`, used only by the `generate:api-docs` script, not bundled into the server). Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process so silk-effects is a normal runtime **dependency**, not bundled.

What is **not** built (deferred to Phase C): per-service/deep API pages; separate-repo package overviews and action docs; the cross-repo refactor of `rspress-plugin-api-extractor` to consume `api-extractor-llms`; `silk://guides/silk-v2-release-pipeline` (blocked until the v2 pipeline exists); and MCP completions/subscriptions/pagination.

## The Information-vs-Direction Split

The load-bearing architectural principle. **Information lives in the MCP; direction lives in the plugins.** The server carries every resource and tool regardless of the current project — including, eventually, GitHub Actions knowledge. Each plugin decides which resources and tools to point the agent at, so a non-Actions project never gets bloated with Actions context even though the shared server could serve it. This split is why three plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) spawn the identical server but orient the agent differently. The MCP itself carries no per-project gating.

## The Runtime Layer

One long-lived Effect `ManagedRuntime`, built from `SilkRuntimeLive` (`src/runtime.ts`), composed **directly** from `silk-effects` and `workspaces-effect` exports — both of which mcp is allowed to import, so the cli↔silk↔mcp non-import invariant holds without indirection.

`SilkRuntimeLive` exposes five services: `SilkWorkspaceAnalyzer`, `WorkspaceRoot` (for root walk-up — see [Root Resolution](#root-resolution)), `Turbo.TurboInspector` (backing `turbo_inspect`) and `Changesets.BranchAnalyzer` + `Changesets.ConfigInspector` (backing `changeset_inspect`). It is built by providing `SilkWorkspaceAnalyzerLive` + `WorkspaceRootLive` + `Turbo.TurboInspectorLive` (the inspector fed its own `ToolDiscoveryLive`) plus one combined `Changesets.BranchAnalyzerLive` `provideMerge` `Changesets.ConfigInspectorLive` layer (so a single `ConfigInspector` instance feeds the analyzer AND is re-exposed, the same shared-instance pattern the CLI uses), with a `DepsLive` merge of `WorkspacesLive` (the workspace trio plus `DependencyGraph` and `TopologicalSorter` the analyzer needs), `ChangesetConfigReaderLive`, `TagStrategyLive` and `VersioningStrategyLive` (itself fed `ChangesetConfigReaderLive`, since `Layer.mergeAll` does not cross-feed siblings). `ConfigInspectorLive` needs `ChangesetConfigReader` + `WorkspaceDiscovery` + `FileSystem` (the last for its release-surface fallback) — all satisfied by `DepsLive` and the host platform layer. `ToolDiscoveryLive`'s `PackageManagerDetector` + `WorkspaceRoot` requirements are satisfied by `DepsLive`; the leftover `CommandExecutor` + `FileSystem` + `Path` flow up to the host platform layer, which `bin.ts` supplies at the edge via `NodeContext.layer`. See `src/runtime.ts` for the exact wiring.

`SilkRuntimeLive` composes its **own** stack rather than hoisting the CLI's. The CLI's `AppLive` does not include the analyzer (the two runtimes genuinely diverge) and the only shared surface is the three-line workspace-trio wiring, so a shared layer would couple two diverging consumers for negligible gain. Extracting one is deferred until a second host needs the same composition (YAGNI). No CLI code is touched by this package.

The smoke tests (`__test__/runtime.smoke.test.ts`, `server.smoke.test.ts`) are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck.

## The Tool Half

Every tool follows the conventions proven by `workspace_info` (`src/tools/workspace-info.ts`):

- **Effect Schema is the source of truth** for input and output, with `.annotations()` carrying descriptions. The handler runs as `runtime.runPromise(Effect.gen(...))`, yielding silk-effects services; all logic stays in silk-effects and the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.transformOrFail` (decode succeeds to markdown, encode is `Forbidden`), and the tool returns `{ content: [{ type: "text", text }], structuredContent: <json> }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool` accepts only zod schemas, not raw JSON Schema. The bridge (`src/schema/effect-to-zod.ts`) routes Effect Schema → `JSONSchema.make` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place the canonical Effect Schema crosses into the SDK's world; `zod` (v4) is a boundary dependency only.

`workspace_info` wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis` (`WorkspaceInfoResult`): `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in `AnalyzedWorkspace` (which the zod bridge cannot inline) and is more token-efficient for the agent. See `src/tools/workspace-info.ts` for the schema, the `toWorkspaceInfoResult` mapper and the transcript transform.

`silk_docs_search` (`src/tools/docs-search.ts`) is the read-only entry into the resource corpus. It takes a plain keyword/phrase query — no operator DSL — and returns ranked hits with a normalized higher-is-better `confidence` plus a high/medium/low `confidenceLabel`. It runs **synchronously off the in-memory index, not the Effect runtime** (no silk-effects services involved), and never returns empty: when nothing scores, it falls back to the priority-ordered top-N so the agent always has a starting point. Results also carry an optional `related` field (see [The Resource Half](#the-resource-half)) and a structured stderr query log line is emitted per call (see [Query Logging](#query-logging)). See [The Resource Half](#the-resource-half) for the index it queries.

`turbo_inspect` (`src/tools/turbo-inspect.ts`) wraps silk-effects' `Turbo.TurboInspector` — read-only Turborepo introspection that never executes a task (every path is `turbo … --dry=json`). Its result is a **discriminated union keyed by `mode`** (`cache` | `graph` | `affected`), each variant embedding the corresponding silk-effects `Turbo` result schema (`CacheDiagnosis` / `TaskGraphResult` / `AffectedResult`). Because those embedded schemas are flat and non-recursive, the union round-trips cleanly through the effect→zod bridge. The one-way `TurboInspectAsMarkdown` transform renders each mode's transcript (mirroring `WorkspaceInfoAsMarkdown`). The handler resolves the workspace root via `WorkspaceRoot.find` from the requested (or fallback) `cwd` — the same walk-up `workspace_info` uses — then dispatches to the matching `TurboInspector` method. See `src/tools/turbo-inspect.ts` for the union schemas and the handler.

`changeset_inspect` (`src/tools/changeset-inspect.ts`) is built to the exact same pattern as `turbo_inspect` — a read-only tool backing the silk plugin's `changeset-manager` workflow. Its result is a **discriminated union keyed by `mode`** (`branch` | `config`): `branch` wraps `Changesets.BranchAnalyzer.analyzeBranch` (the diff-against-base file classification, embedding `Changesets.BranchAnalysisSchema`) and `config` wraps `Changesets.ConfigInspector.inspect` (the resolved `.changeset/config.json`, embedding `Changesets.InspectedConfigSchema`). Both embedded schemas are flat and bridge-safe so the union round-trips through the effect→zod bridge. The handler resolves the workspace root the same way the other tools do, then dispatches by `mode`. The one-way `ChangesetInspectAsMarkdown` transform renders each mode's transcript. This tool replaced the two bash wrapper scripts the silk plugin previously shelled out to: the CLI's `--json` output is prefixed with an `Effect.log` line that breaks naive `JSON.parse`, and the structured MCP result sidesteps that fragility. The `savvy changeset analyze-branch` / `config show` CLI commands themselves remain. See `src/tools/changeset-inspect.ts` and `../silk/plugin.md`.

`biome_check` (`src/tools/biome-check.ts`) departs from the other tools in two ways: it is a **thin proxy that shells the Biome CLI directly** (no silk-effects service backs it — silk-effects is reused only for `Lint.Biome.findBiome()` binary resolution), and it is the **first savvy-mcp tool that mutates the working tree**. It does not run on the Effect runtime; the handler is a plain async `spawnSync` over Biome. Params are `paths?`, `mode` (`"check"` default — lint + format + organize-imports — or `"lint"`), `write` (`--write`, safe fixes), `unsafe` (`--write --unsafe`, implies `write`) and `cwd?`. Its `BiomeCheckResult` schema is flat (`{ summary: { errors, warnings }, diagnostics: [{ file, line, severity, rule, message }], wrote, guidance }`) with the same one-way `BiomeCheckAsMarkdown` transcript transform as the other tools. The `guidance` string carries a fixed guardrail ("fix the actual code, do not disable rules or add config overrides") so the agent fixes code rather than silencing rules. The mutation departure is documented in [Boundaries and Invariants](#boundaries-and-invariants). See `src/tools/biome-check.ts` for the schema, the gitlab parser and the two-pass handler, and `../silk/plugin.md` for the Biome LSP, the `biome-prefer-mcp` nudge hook and the `<biome_capability>` orientation block that steer the agent toward this tool.

The execution flow is **fix-then-validate over the stable `gitlab` reporter** (not the experimental `json` reporter). When `write`/`unsafe` is set the handler runs a fix pass first (`biome <mode> --write [--unsafe] --no-errors-on-unmatched <paths>`), then always runs a read pass (`biome <mode> --reporter=gitlab --error-on-warnings --no-errors-on-unmatched <paths>`) that reports what *remains* after any fix. stdout is parsed regardless of exit code (Biome's `0`/`1` both carry diagnostics; only `>1` means Biome itself failed and surfaces as a tool error); the gitlab severity scale (`info`/`minor`/`major`/`critical`/`blocker`) maps onto the result's three-level `error`/`warning`/`info`. Returning structured data instead of Bash stdout sidesteps the Bash tool's output truncation.

## The Resource Half

Resources serve a curated, on-disk markdown corpus behind a stable URI scheme. A build-time compiler validates the corpus and emits the (tracked, hand-authored-baseline) manifest; the runtime serves from that manifest plus the bodies on disk. The Phase B work added an API-doc generation pipeline that renders generated docs into this same corpus as gitignored, ephemeral build output.

### The content corpus and its identity contract

The corpus lives under `public/content/{standards,packages,guides}/**.md` (relocated from `src/resources/content` in M5, because the bundler copies only the top-level `public/` directory). Each file carries YAML front-matter (`id`, `title`, `summary`, `tier`, `source`, `status`, `tags`, `audience`, `priority`, `related`). The front-matter shape is the load-bearing contract — see the Effect Schemas in `src/resources/schema.ts` (`DocFrontMatter`, `ManifestEntry`, `Manifest`).

The **`id` is the stable identity**, not the file path: the URI is derived as `silk://<id>`, never from where the file sits on disk. `ID_PATTERN` requires the id to be tier-prefixed and allows an optional trailing slash for directory-index docs (e.g. `packages/silk-effects/` resolves to `content/packages/silk-effects/index.md`). Directories prefixed with `_` (e.g. `_templates/`) are skipped by the compiler.

The URI taxonomy stays stable when `packages/*` content swaps from hand-authored to generated-from-API-model:

- `silk://standards/<topic>` — Silk development standards (commits, changesets, lint, testing, semver, dependency conventions, API model pipeline, and the `standards/turbo/{ci,filtering,environment,best-practices,watch,boundaries}` Turborepo set, tagged `turbo`/`ci`).
- `silk://packages/<pkg>/<topic>` — per-package API/usage docs; the `packages/<pkg>/api/<kind>/<slug>` sub-path is the generated API-reference space.
- `silk://guides/<slug>` — higher-level conceptual articles layered over the packages.

Tags are drawn from a controlled vocabulary in `content/tags.json` (canonical tags → aliases); the compiler canonicalizes and rejects unknown tags via `src/resources/tags.ts`.

### The API-doc generation pipeline

Generated docs are `source: generated` entries in the corpus. They are produced by a turbo-orchestrated pipeline and are **gitignored, ephemeral build output** (`public/content/packages/*/api/`, ignored via the root `.gitignore`), regenerated deterministically from each package's `.api.json` model on every build. The upstream API Extractor `.api.json` **model files** are also gitignored (`packages/mcp/lib/models/*/`). The committed `manifest.json` is the hand-authored baseline ONLY (it carries no `source: generated` entries); `build:catalog` inflates it in place with the generated entries on a local build but the deep-equality write guard keeps the committed baseline unchanged on a clean run. The generator is skip-tolerant, so a bare install with no models never fails. Because the generated docs are gitignored, `git log` has no commit for them and the compiler stamps their `lastModified` with the epoch fallback (see [The build-time compiler](#the-build-time-compiler)) — only hand-authored docs get a real commit date.

**Targets.** `scripts/api-targets.ts` declares the four in-monorepo library packages that are generation targets: `silk-effects`, `templates`, `github-action-effects` and `github-action-builder`. `@savvy-web/silk` and `@savvy-web/cli` are excluded because they are not libraries. `@savvy-web/mcp` is excluded because its generated docs are an input to `build:catalog` → `build:dev`, so a `generate:api-docs → mcp#build:dev` dependency would be a turbo cycle. Excluding mcp keeps the build subgraph acyclic even if `silk` later depends on `mcp`.

**Generator.** `lib/scripts/generate-api-docs.ts` reads each target's `.api.json` model from `lib/models/<pkg>/` (where the bundler's `--target meta` copies it via each leaf's `meta.localPaths`), calls the external `api-extractor-llms` package's `renderPackage` with two injected services, and writes the resulting docs under `public/content/packages/<dir>/api/` (gitignored). The two injected services are:

- A `FrontmatterRenderer` — `frontMatterFor(target, meta)` → `toYaml(fm)` — that builds silk YAML front-matter with `source: generated`, `tier: packages`, `tags: [<dir>, api]`, `priority: 0.3` and **empty `related`**.
- A `RouteFormatter` — `silk://packages/<dir>/api/<kind>/<slug>` — that maps item refs to silk URIs.

Generated docs carry empty `related` by design (decision 4 from the plan): no committed hand-authored doc may reference a generated `packages/*/api/*` id, because a bare install skips generation and would leave dangling references in `build:catalog`. The related-graph boost (see [Search Index](#search-index)) therefore operates only on hand-authored links.

The generator is **skip-tolerant**: if a target's model is absent, it logs `SKIP` and exits 0. A bare `pnpm install` (which runs `prepare: turbo run build:dev`) therefore never fails due to a missing model.

The body-budget guard in `lib/scripts/compile.ts` exempts `source: generated` docs from the per-tier byte-size warning — generated pages are split per API item, not editorially constrained.

**Turbo orchestration.** `packages/mcp/turbo.json` (extends `//`) declares the task graph:

```text
@savvy-web/{silk-effects,templates,github-action-effects,github-action-builder}#build:meta
      ↓ (copy *.api.json into mcp/lib/models/<pkg>/ via meta.localPaths)
@savvy-web/mcp#generate:api-docs
      ↓ (write public/content/packages/*/api/** — gitignored)
@savvy-web/mcp#build:catalog
      ↓ (compile manifest.json)
@savvy-web/mcp#build:dev / build:prod
```

Under the bundler the four leaves emit their API Extractor model only via a separate `savvy build --target meta` step (each package's `build:meta` script copies the `.api.json` into `meta.localPaths`, i.e. `mcp/lib/models/<pkg>/`), **not** during `build:prod`. So `generate:api-docs` `dependsOn` was repointed from the four leaves' `#build:prod` to their `#build:meta` (still the four explicit in-monorepo library tasks, not `^build:meta`, so `silk`/`cli`/`mcp` never enter mcp's build subgraph). It has **no** workspace edge for the renderer itself: `api-extractor-llms` is now an external npm package, so the generator pulls it from `node_modules` rather than waiting on a sibling build. `build:catalog` depends on `generate:api-docs`; mcp's own `build:dev`/`build:prod` depend on `build:catalog` (their inputs include `public/content/**`). The `build:meta` tasks are uncached (they write into mcp's `localPaths`, outside their own cache scope). `generate:api-docs` is `cache: true` (its output, `public/content/packages/*/api/**`, is gitignored ephemeral content); `build:catalog`'s only declared output is the tracked `public/content/manifest.json`, and its inputs exclude that manifest so a manifest rewrite does not re-trigger it. The committed manifest is the hand-authored baseline; the deep-equality write guard keeps a clean rebuild from churning it.

See `../api-extractor-llms/architecture.md` for the external library that performs the actual rendering.

### The build-time compiler

`lib/scripts/compile.ts` holds the pure `compileCorpus` (no I/O); `lib/scripts/build-catalog.ts` is the I/O shell that walks the corpus under `public/content`, parses front-matter with gray-matter, runs `compileCorpus`, and writes `public/content/manifest.json`. Integrity checks fail the build on any error: id uniqueness, tier↔directory match, `related`-target resolution, controlled tags, per-tier body-size budgets (skipped for `source: generated`), a dead `workflow-*`-name grep, the generated-doc provenance marker, and a per-doc `lastModified` stamp from `git log -1 --format=%cI -- <file>` (falling back to the epoch when git has no record of the file — which is the case for the gitignored generated API docs).

The **committed** `manifest.json` is the hand-authored baseline (`{ entries }` only — the 29 hand-authored docs, no generated entries), a deterministic function of the hand-authored corpus, with each entry's `lastModified` being the file's git commit date. The former per-build `generatedAt` wall-clock timestamp was dropped (nothing read it at runtime; it was pure git churn). On a local build `build-catalog.ts` regenerates and inflates the manifest in place with the gitignored generated API entries, but a `node:util` `isDeepStrictEqual` write guard only rewrites `manifest.json` when the parsed value differs from disk — so a clean rebuild (or a Biome reindent) leaves the committed baseline byte-identical and the build never fights the formatter or churns git. Biome owns the committed format; the build respects it. Do NOT commit the inflated manifest.

`build:catalog` (run with `tsx`) is sequenced via turbo (see above) ahead of `build:dev`/`build:prod`. The corpus ships through the top-level `public/content` directory, which the bundler copies wholesale into the built `dist/<group>/pkg` so the built binary serves the same corpus (the bundler's only copy convention is `public/`; there is no `copyPatterns`).

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
- **`biome_check` is the one mutating tool — an intentional exception to the read-only convention.** Every other tool registers with `annotations: { readOnlyHint: true }` and never touches the working tree; `biome_check` carries **no** `readOnlyHint` because with `write`/`unsafe` it edits files. The mutation is never implicit — `write`/`unsafe` default off, so a bare call only reads — and Biome `--write` is deterministic and git-reversible. This is the deliberate departure from the `turbo_inspect` "read-only, never mutates" invariant; it is also the only tool that bypasses the Effect runtime and shells a CLI directly.
- **Generated docs carry empty `related`.** No committed hand-authored doc may reference a generated `packages/*/api/*` id — a bare install skips generation and would leave a dangling `related` reference that fails `build:catalog`. The related-graph boost operates only on hand-authored `related` links, which are always present.

## Rationale

### Why a standalone server, not a discovery host

The parent silk-core spec framed the MCP as a thin discovery host peer to the CLI reading a contribution contract. That framing is dropped as premature coupling. A content-rich standalone server with a fixed tool/resource surface ships value now; the discovery seam — if it ever returns — is a future concern, and the information-vs-direction split already gives per-project tailoring without one. The CLI remains the bridge for what tools cannot yet cover.

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the Effect-Schema → JSON-Schema → zod bridge cannot inline. Projecting to a flat, name-only result both satisfies the bridge and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.

### Why the manifest is tracked but generated docs are gitignored

The committed `manifest.json` is the hand-authored baseline only; the rendered API docs (and the `.api.json` models) are gitignored, ephemeral build output regenerated deterministically on every build. This is the deliberate split: tracking the baseline manifest gives the hand-authored docs real `lastModified` commit dates and lets a bare install serve the curated corpus without running generation, while keeping the bulky per-API-item generated pages out of git history. The cost is that gitignored generated docs have no commit, so the compiler stamps their `lastModified` with the epoch fallback — acceptable for transient generated pages. The deep-equality write guard keeps a local build (which inflates the manifest in place with generated entries) from committing the inflated version, and the skip-tolerant generator ensures a bare install never fails when models are absent. The relocation to `public/content` (M5) moved the gitignore rule but kept this split intact.

### Why the related-graph boost uses compiled-time-validated ids

The corpus compiler rejects dangling `related` references as a build error. Every `related` id in the manifest therefore resolves to a live doc. The boost can safely look up neighbors by URI without defensive null handling. Generated docs opt out of the boost by carrying empty `related` — they are transient enough that cross-linking them into the hand-authored graph would create links that disappear on a bare install.
