---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-06-18
last-synced: 2026-06-18
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

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The information-vs-direction split](#the-information-vs-direction-split)
- [The runtime layer](#the-runtime-layer)
- [The tool half](#the-tool-half)
- [The resource half](#the-resource-half)
- [Root resolution](#root-resolution)
- [Plugin integration](#plugin-integration)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a human) alongside an agent in the project working directory, shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text — and to serve library knowledge as MCP resources agents research before guessing.

It is **not** a discovery host. The MCP is a content-rich server with two concrete jobs (tools and resources) and no discovery seam. It reuses `@savvy-web/silk-effects` for tool logic — the same business layer the `savvy` CLI uses.

**Package:** `@savvy-web/mcp`, at `packages/mcp` in `savvy-web/systems`. The `savvy-mcp` bin (`src/bin.ts`) calls `startMcpServer()` in `src/server.ts`. ESM-only, built via `@savvy-web/bundler`; the markdown corpus ships through the top-level `public/content` copy convention (see [The content corpus](#the-content-corpus-and-its-identity-contract)).

## Current state

Implemented and verified end-to-end. The server ships seven tools (`workspace_info`, `silk_docs_search`, `turbo_inspect`, `changeset_inspect`, `changeset_validate`, `changeset_preview`, `biome_check`), the manifest-backed resource layer (`silk://catalog` plus a single `silk://{+path}` template over an on-disk markdown corpus), a turbo-orchestrated API-doc generation pipeline, body-content search, a related-graph retrieval boost, structured query logging and MCP wiring across three Claude Code plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) that each spawn the same server. `private: true` in source; the builder flips it on build.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`) for tool logic, `workspaces-effect`, the `@effect/*` runtime, `@modelcontextprotocol/sdk`, `fuse.js` and `zod` (v4, boundary-only). `api-extractor-llms` — an external npm package, not a workspace sibling — is a build-only `devDependency` used by the `generate:api-docs` script and never bundled into the server. See `package.json` for exact ranges. Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process so silk-effects is a normal runtime **dependency**, not bundled.

## The information-vs-direction split

The load-bearing architectural principle. **Information lives in the MCP; direction lives in the plugins.** The server carries every resource and tool regardless of the current project — including, eventually, GitHub Actions knowledge. Each plugin decides which resources and tools to point the agent at, so a non-Actions project never gets bloated with Actions context even though the shared server could serve it. This split is why three plugins (`plugins/silk`, `plugins/github-actions`, `plugins/docs`) spawn the identical server but orient the agent differently. The MCP itself carries no per-project gating.

## The runtime layer

One long-lived Effect `ManagedRuntime`, built from `SilkRuntimeLive` (`src/runtime.ts`), composed **directly** from `silk-effects` and `workspaces-effect` exports — both of which mcp is allowed to import, so the cli↔silk↔mcp non-import invariant holds without indirection.

`SilkRuntimeLive` exposes the services the tools need: `SilkWorkspaceAnalyzer` (for `workspace_info`), `WorkspaceRoot` (for root walk-up, see [Root resolution](#root-resolution)), `Turbo.TurboInspector` (for `turbo_inspect`), the `Changesets.BranchAnalyzer` + `Changesets.ConfigInspector` pair (for `changeset_inspect`) and `Changesets.ReleasePlanner` (for `changeset_preview`). A single shared `ConfigInspector` instance feeds the branch analyzer and the release planner and is re-exposed, the same shared-instance pattern the CLI uses. The leftover platform requirements (`CommandExecutor`, `FileSystem`, `Path`) flow up to the host layer, which `bin.ts` supplies at the edge via `NodeContext.layer`. See `src/runtime.ts` for the exact wiring.

`SilkRuntimeLive` composes its **own** stack rather than hoisting the CLI's `AppLive`: the two runtimes genuinely diverge (the CLI does not include the analyzer) and the only shared surface is the three-line workspace-trio wiring, so a shared layer would couple two diverging consumers for negligible gain. Extracting one is deferred until a second host needs the same composition. No CLI code is touched by this package.

The smoke tests in `__test__/` (`runtime.smoke.test.ts`, `server.smoke.test.ts`) are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck.

## The tool half

Every tool follows the conventions proven by `workspace_info` (`src/tools/workspace-info.ts`):

- **Effect Schema is the source of truth** for input and output, with `.annotations()` carrying descriptions. The handler runs as `runtime.runPromise(Effect.gen(...))`, yielding silk-effects services; all logic stays in silk-effects and the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.transformOrFail` (decode succeeds to markdown, encode is `Forbidden`), and the tool returns `{ content: [{ type: "text", text }], structuredContent: <json> }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool` accepts only zod schemas. The bridge (`src/schema/effect-to-zod.ts`) routes Effect Schema → `JSONSchema.make` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place the canonical Effect Schema crosses into the SDK's world.

`workspace_info` wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis`: `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in `AnalyzedWorkspace` (which the zod bridge cannot inline, see [Rationale](#why-a-flat-tool-projection-over-the-rich-analysis)) and is more token-efficient for the agent. See `src/tools/workspace-info.ts`.

`silk_docs_search` (`src/tools/docs-search.ts`) is the read-only entry into the resource corpus. It takes a plain keyword/phrase query — no operator DSL — and returns ranked hits with a normalized higher-is-better `confidence` plus a high/medium/low `confidenceLabel`. It runs **synchronously off the in-memory index, not the Effect runtime** (no silk-effects services involved), and never returns empty: when nothing scores, it falls back to the priority-ordered top-N. Results also carry an optional `related` field (see [Search index](#search-index)) and emit a structured stderr query log line per call (see [Query logging](#query-logging)).

`turbo_inspect` (`src/tools/turbo-inspect.ts`) wraps silk-effects' `Turbo.TurboInspector` — read-only Turborepo introspection that never executes a task (every path is `turbo … --dry=json`). Its result is a **discriminated union keyed by `mode`** (`cache` | `graph` | `affected`), each variant embedding the corresponding silk-effects `Turbo` result schema. Those embedded schemas are flat and non-recursive so the union round-trips cleanly through the effect→zod bridge. The handler resolves the workspace root via `WorkspaceRoot.find` from the requested (or fallback) `cwd` — the same walk-up `workspace_info` uses — then dispatches to the matching `TurboInspector` method.

`changeset_inspect` (`src/tools/changeset-inspect.ts`) follows the exact same pattern, backing the silk plugin's `changeset-manager` workflow. Its result is a **discriminated union keyed by `mode`** (`branch` | `config` | `classify`): `branch` wraps `Changesets.BranchAnalyzer.analyzeBranch` (diff-against-base file classification), `config` wraps `Changesets.ConfigInspector.inspect` (the resolved `.changeset/config.json`), and `classify` wraps `Changesets.ConfigInspector.classify` (an arbitrary file path → its owning package). All embedded schemas bridge safely. The structured MCP result exists because the CLI's `--json` output is prefixed with an `Effect.log` line that breaks naive `JSON.parse`; the structured result sidesteps that fragility. The `classify`/`config show`/`analyze-branch`/`release-surface` inspection commands were removed from the `savvy changeset` CLI, so these MCP modes are now the inspection surface. See `src/tools/changeset-inspect.ts` and `../silk/plugin.md`.

`changeset_validate` (`src/tools/changeset-validate.ts`) is a read-only tool that validates the changeset files in `.changeset/` against the `@savvy-web/changesets` format rules via silk-effects' `Changesets.ChangesetLinter`. Its result carries the typed `LintMessage` diagnostics (file path, rule code, message) plus an `ok` boolean and `errorCount`, with the same one-way markdown transcript transform as the other tools. It is the structured counterpart to the `savvy changeset lint` CLI path, the tool side of the inspection surface alongside `changeset_inspect`. See `src/tools/changeset-validate.ts`.

`changeset_preview` (`src/tools/changeset-preview.ts`) is a read-only preview of the next release, backing the silk plugin's `changeset-preview` skill. It wraps silk-effects' `Changesets.ReleasePlanner.preview`, which runs the genuine changesets engine over the pending `.changeset/` files against a throwaway temp directory (never mutating the repo) and returns each package's version bump plus the rendered CHANGELOG block exactly as it would ship, dependency tables included. The handler resolves the workspace root via `WorkspaceRoot.find` then calls `preview`, with the same flat structured result and one-way markdown transcript transform (a bump table followed by per-package release notes) as the other tools. Only `preview` is exposed; `ReleasePlanner.apply` is the destructive native release and is intentionally kept off MCP — it lives behind the `savvy changeset version` CLI command instead (see `../cli/architecture.md` and `../silk-effects/architecture.md`). See `src/tools/changeset-preview.ts`.

`biome_check` (`src/tools/biome-check.ts`) departs from the other tools in two ways: it is a **thin proxy that shells the Biome CLI directly** (no silk-effects service backs it — silk-effects is reused only for `Lint.Biome.findBiome()` binary resolution), and it is the **one savvy-mcp tool that mutates the working tree**. It does not run on the Effect runtime; the handler is a plain async `spawnSync` over Biome with optional `write`/`unsafe` fix params, both defaulting off. Its `BiomeCheckResult` schema is flat, with the same one-way markdown transcript transform as the other tools, and carries a fixed `guidance` guardrail that steers the agent to fix code rather than silence rules. The mutation departure is documented in [Boundaries and invariants](#boundaries-and-invariants). See `src/tools/biome-check.ts` for the schema, the gitlab parser and the handler, and `../silk/plugin.md` for the Biome LSP, the `biome-prefer-mcp` nudge hook and the `<biome_capability>` orientation block.

The execution flow is **fix-then-validate over the stable `gitlab` reporter** (not the experimental `json` reporter). When `write`/`unsafe` is set the handler runs a fix pass first, then always runs a read pass that reports what *remains* after any fix. stdout is parsed regardless of exit code (Biome's `0`/`1` both carry diagnostics; only `>1` means Biome itself failed and surfaces as a tool error); the gitlab severity scale maps onto the result's three-level `error`/`warning`/`info`. Returning structured data instead of Bash stdout sidesteps the Bash tool's output truncation.

## The resource half

Resources serve a curated, on-disk markdown corpus behind a stable URI scheme. A build-time compiler validates the corpus and emits a tracked manifest; the runtime serves from that manifest plus the bodies on disk. An API-doc generation pipeline renders generated docs into this same corpus as gitignored, ephemeral build output.

### The content corpus and its identity contract

The corpus lives under `public/content/{standards,packages,guides}/**.md` (under the top-level `public/` directory because the bundler copies only that directory). Each file carries YAML front-matter whose shape is the load-bearing contract — see the Effect Schemas in `src/resources/schema.ts` (`DocFrontMatter`, `ManifestEntry`, `Manifest`).

The **`id` is the stable identity**, not the file path: the URI is derived as `silk://<id>`, never from where the file sits on disk. `ID_PATTERN` requires the id to be tier-prefixed and allows an optional trailing slash for directory-index docs (e.g. `packages/silk-effects/` resolves to `content/packages/silk-effects/index.md`). Directories prefixed with `_` (e.g. `_templates/`) are skipped by the compiler.

The URI taxonomy stays stable when `packages/*` content swaps from hand-authored to generated-from-API-model:

- `silk://standards/<topic>` — Silk development standards (commits, changesets, lint, testing, semver, dependency conventions, the API model pipeline and a `standards/turbo/*` Turborepo set).
- `silk://packages/<pkg>/<topic>` — per-package API/usage docs; the `packages/<pkg>/api/<kind>/<slug>` sub-path is the generated API-reference space.
- `silk://guides/<slug>` — higher-level conceptual articles layered over the packages.

Tags are drawn from a controlled vocabulary in `content/tags.json` (canonical tags → aliases); the compiler canonicalizes and rejects unknown tags via `src/resources/tags.ts`.

### The API-doc generation pipeline

Generated docs are `source: generated` entries in the corpus. They are produced by a turbo-orchestrated pipeline and are **gitignored, ephemeral build output** (`public/content/packages/*/api/`), regenerated deterministically from each package's `.api.json` model on every build. The upstream API Extractor `.api.json` model files are also gitignored (`packages/mcp/lib/models/*/`). The committed `manifest.json` is the hand-authored baseline ONLY (no `source: generated` entries); `build:catalog` inflates it in place with the generated entries on a local build, but the deep-equality write guard keeps the committed baseline unchanged on a clean run. The generator is skip-tolerant, so a bare install with no models never fails. Because the generated docs are gitignored, `git log` has no commit for them and the compiler stamps their `lastModified` with the epoch fallback — only hand-authored docs get a real commit date.

**Targets.** `lib/scripts/api-targets.ts` declares the four in-monorepo library packages that are generation targets: `silk-effects`, `templates`, `github-action-effects` and `github-action-builder`. `@savvy-web/silk` and `@savvy-web/cli` are excluded because they are not libraries. `@savvy-web/mcp` is excluded because its generated docs are an input to `build:catalog` → `build:dev`, so a `generate:api-docs → mcp#build:dev` dependency would be a turbo cycle; excluding mcp keeps the build subgraph acyclic.

**Generator.** `lib/scripts/generate-api-docs.ts` reads each target's `.api.json` model from `lib/models/<pkg>/` (where the bundler's `--target prod` copies it from the canonical group's meta bundle via each leaf's `meta.localPaths`), calls the external `api-extractor-llms` package's `renderPackage` with two injected services, and writes the resulting docs under `public/content/packages/<dir>/api/` (gitignored). The two injected services are a `FrontmatterRenderer` that builds silk YAML front-matter (`source: generated`, `tier: packages`, empty `related`) and a `RouteFormatter` that maps item refs to `silk://packages/<dir>/api/<kind>/<slug>` URIs.

Generated docs carry empty `related` by design: no committed hand-authored doc may reference a generated `packages/*/api/*` id, because a bare install skips generation and would leave dangling references in `build:catalog`. The related-graph boost (see [Search index](#search-index)) therefore operates only on hand-authored links. The generator is **skip-tolerant**: if a target's model is absent it logs `SKIP` and exits 0, so a bare `pnpm install` never fails on a missing model. The body-budget guard in `lib/scripts/compile.ts` exempts `source: generated` docs from the per-tier byte-size warning — generated pages are split per API item, not editorially constrained.

**Turbo orchestration.** `packages/mcp/turbo.json` (extends `//`) declares the task graph:

```text
@savvy-web/{silk-effects,templates,github-action-effects,github-action-builder}#build:prod
      ↓ (copy *.api.json into mcp/lib/models/<pkg>/ via meta.localPaths)
@savvy-web/mcp#generate:api-docs
      ↓ (write public/content/packages/*/api/** — gitignored)
@savvy-web/mcp#build:catalog
      ↓ (compile manifest.json)
@savvy-web/mcp#build:dev / build:prod
```

Under the bundler the four leaves now emit their API Extractor model **during `build:prod`** (meta moved into `--target prod`; the old standalone `build:meta` is a soft-deprecated no-op), so `generate:api-docs` `dependsOn` the four leaves' explicit `#build:prod` tasks (not `^build:prod`, so `silk`/`cli`/`mcp` never enter mcp's build subgraph). It has **no** workspace edge for the renderer itself: `api-extractor-llms` is an external npm package the generator pulls from `node_modules`. `build:catalog` depends on `generate:api-docs`; mcp's own `build:dev`/`build:prod` depend on `build:catalog`. `build:catalog`'s only declared output is the tracked `public/content/manifest.json`, and its inputs exclude that manifest so a manifest rewrite does not re-trigger it. See `../api-extractor-llms/architecture.md` for the external library that performs the actual rendering.

### The build-time compiler

`lib/scripts/compile.ts` holds the pure `compileCorpus` (no I/O); `lib/scripts/build-catalog.ts` is the I/O shell that walks the corpus under `public/content`, parses front-matter with gray-matter, runs `compileCorpus`, and writes `public/content/manifest.json`. Integrity checks fail the build on any error: id uniqueness, tier↔directory match, `related`-target resolution, controlled tags, per-tier body-size budgets (skipped for `source: generated`), a dead `workflow-*`-name grep, the generated-doc provenance marker and a per-doc `lastModified` stamp from `git log` (falling back to the epoch when git has no record of the file, as it does for the gitignored generated API docs).

The **committed** `manifest.json` is the hand-authored baseline (`{ entries }` only, no generated entries), a deterministic function of the hand-authored corpus, with each entry's `lastModified` being the file's git commit date. On a local build `build-catalog.ts` regenerates and inflates the manifest in place with the gitignored generated API entries, but a `node:util` `isDeepStrictEqual` write guard only rewrites `manifest.json` when the parsed value differs from disk — so a clean rebuild (or a Biome reindent) leaves the committed baseline byte-identical and the build never fights the formatter or churns git. Biome owns the committed format; the build respects it. Do NOT commit the inflated manifest.

`build:catalog` (run with `tsx`) is sequenced via turbo ahead of `build:dev`/`build:prod`. The corpus ships through the top-level `public/content` directory, which the bundler copies wholesale into the built `dist/<group>/pkg` so the built binary serves the same corpus.

### Runtime serving

Two discovery surfaces coexist over the manifest:

- **`silk://catalog`** is a single FIXED resource rendered from the manifest by `catalog.ts`, listing every doc grouped by tier with a "load when …" hint. Generated API-reference docs appear marked `(generated)`. It is the agent's mandated first read.
- A single **`silk://{+path}` `ResourceTemplate`** (`src/resources/index.ts`) handles both `list()` and read. `list()` returns every doc except the catalog and `deprecated` docs; the read handler keys the body lookup off `variables.path` (never `uri.pathname`). Per-doc annotations (audience/priority/lastModified) appear in both list entries and read contents.

`load.ts` resolves the content root across the source and built layouts (throwing a diagnostic that lists the probed paths if no manifest is found) and reads bodies through the path-security resolver in `paths.ts`. See `src/resources/{catalog,index,load,schema}.ts`.

### Search index

`silk_docs_search` queries an in-memory Fuse `DocIndex` (`src/resources/doc-index.ts`), built once in `bin.ts` before `server.connect` and held per process. The Fuse key weights are title 0.55 / tags 0.3 / summary 0.12 / **body 0.03**. The body key is low-weight so body matches rescue body-only terms without letting long bodies dominate ranking over title and tag matches. Results tie-break by curated `priority`, and the index never returns empty (priority-ordered fallback).

**Related-graph boost.** After Fuse ranks, `DocIndex.search` inspects the top-3 hits' `related` arrays and appends any neighbors not already in the result set as low-confidence "see also" entries. The related graph is compile-time validated so every `related` id resolves; generated docs carry empty `related`, so the boost operates only on hand-authored links.

### Query logging

`src/resources/query-log.ts` provides a pure `formatQueryLogLine(query, results)` formatter and a `stderrQueryLogger` sink. When a `QueryLogger` is supplied, the tool handler emits one structured JSON line to stderr per query (`[savvy-mcp] docs-search {…}`). It is privacy-clean — no user content beyond the query string and the top result URIs. The logger is wired in `src/server.ts`; tests inject a spy logger.

## Root resolution

The `savvy-mcp` bin resolves its base directory by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (`src/bin.ts`). Because dev tooling launches the server from `packages/mcp/` rather than the repo root, the tool handlers additionally resolve the true workspace root by walking up from the base dir (or an explicit `cwd` argument) via `WorkspaceRoot.find` before analyzing — so the tools work from any subdirectory. The walk-up lives in the **mcp handler, not the analyzer**, so the analyzer/CLI contract stays unchanged.

## Plugin integration

A plugin declares the server via an `mcpServers` block in `.claude-plugin/plugin.json` whose command runs a `bin/start-mcp.sh` launcher (detect package manager → `exec <pm> savvy-mcp`), passing the project dir through `CLAUDE_PROJECT_DIR`. The same launcher and declaration are reused by all three plugins — `plugins/silk`, `plugins/github-actions` and `plugins/docs` — and each is registered in the repo's `.claude-plugin/marketplace.json`.

Direction is added per plugin as SessionStart orientation hooks telling the agent to read `silk://catalog` before researching, prefer `silk_docs_search` over filesystem grep and consult `workspace_info` before reporting workspace facts. `plugins/docs` adds the *write* side of direction — an `mcp` corpus-authoring agent and two mode commands — over the same shared server. See `../silk/plugin.md` for the silk read-side orientation and the `docs-search` skill, and `../docs/architecture.md` for the docs plugin and the three-tier query/authoring split.

When several plugins are active in one session, each declares the server, so Claude Code may spawn one instance per plugin. The server is stateless and lightweight, so this is acceptable.

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from `silk-effects` (and `workspaces-effect`), preserving the cli↔silk↔mcp non-import invariant. `api-extractor-llms` is outside this invariant: it is an external npm package consumed purely as a build-time `devDependency`, outside the workspace dependency graph entirely.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is canonical; zod is a boundary-only dependency** confined to the `effect-to-zod` bridge at the SDK registration edge.
- **`biome_check` is the one mutating tool — an intentional exception to the read-only convention.** Every other tool registers with `annotations: { readOnlyHint: true }` and never touches the working tree; `biome_check` carries **no** `readOnlyHint` because with `write`/`unsafe` it edits files. The mutation is never implicit (`write`/`unsafe` default off, so a bare call only reads) and Biome `--write` is deterministic and git-reversible. It is also the only tool that bypasses the Effect runtime and shells a CLI directly.
- **Generated docs carry empty `related`.** No committed hand-authored doc may reference a generated `packages/*/api/*` id — a bare install skips generation and would leave a dangling `related` reference that fails `build:catalog`. The related-graph boost operates only on hand-authored links, which are always present.

## Rationale

### Why a standalone server, not a discovery host

A thin discovery host reading a contribution contract from installed packages was considered and dropped as premature coupling. A content-rich standalone server with a fixed tool/resource surface ships value now; the information-vs-direction split already gives per-project tailoring without a discovery seam. The CLI remains the bridge for what tools cannot yet cover.

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the Effect-Schema → JSON-Schema → zod bridge cannot inline. Projecting to a flat, name-only result both satisfies the bridge and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.

### Why the manifest is tracked but generated docs are gitignored

The committed `manifest.json` is the hand-authored baseline only; the rendered API docs (and the `.api.json` models) are gitignored, ephemeral build output regenerated deterministically on every build. Tracking the baseline manifest gives the hand-authored docs real `lastModified` commit dates and lets a bare install serve the curated corpus without running generation, while keeping the bulky per-API-item generated pages out of git history. The cost is that gitignored generated docs have no commit, so the compiler stamps their `lastModified` with the epoch fallback — acceptable for transient pages. The deep-equality write guard keeps a local build from committing the inflated manifest, and the skip-tolerant generator ensures a bare install never fails when models are absent.

### Why the related-graph boost uses compile-time-validated ids

The corpus compiler rejects dangling `related` references as a build error, so every `related` id in the manifest resolves to a live doc and the boost can look up neighbors by URI without defensive null handling. Generated docs opt out by carrying empty `related` — they are transient enough that cross-linking them into the hand-authored graph would create links that disappear on a bare install.
