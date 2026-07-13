---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-07-12
last-synced: 2026-07-12
completeness: 95
related:
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp architecture

The `savvy-mcp` server — a standalone, spawnable MCP server that serves Silk Suite tooling to coding agents as structured tools. Built on an Effect `ManagedRuntime` over `@savvy-web/silk-effects` plus the `@modelcontextprotocol/sdk`.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [The runtime layer](#the-runtime-layer)
- [The tools](#the-tools)
- [Root resolution](#root-resolution)
- [Plugin integration](#plugin-integration)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a human) alongside an agent in the project working directory, shared across Claude Code plugins. It exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output instead of parsed console text.

It is a **tools-only** server: ten MCP tools and zero resources. It reuses `@savvy-web/silk-effects` for tool logic — the same business layer the `savvy` CLI uses. It is not a discovery host and carries no per-project gating; direction lives in the plugins, each of which orients the agent toward the tools it should prefer.

**Package:** `@savvy-web/mcp`, at `packages/mcp` in `savvy-web/systems`. The `savvy-mcp` bin (`src/bin.ts`) calls `startMcpServer()` in `src/server.ts`. ESM-only, built via `@savvy-web/bundler`.

## Current state

Implemented and verified end-to-end. The server ships ten tools (`workspace_info`, `turbo_inspect`, `changeset_inspect`, `changeset_validate`, `changeset_preview`, `changeset_deps_detect`, `changeset_deps_regen`, `biome_check`, `repos_inspect`, `repos_manage`) and MCP wiring across two Claude Code plugins (`plugins/silk`, `plugins/github-actions`) that each spawn the same server. `private: true` in source; the builder flips it on build.

The resource subsystem has been removed entirely. The `silk://` resource scheme, the on-disk markdown corpus and its manifest, the `silk_docs_search` tool with its Fuse search index and related-graph boost, the structured query logging and the turbo-orchestrated API-doc render pipeline (along with its `api-extractor-llms` build-time devDependency) are all gone. API documentation is moving to a separate future RSPress website built from each package's `.api.json` model rather than being served from the server.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`) for tool logic, `workspaces-effect`, the `@effect/*` runtime, `@modelcontextprotocol/sdk` and `zod` (v4, boundary-only). See `package.json` for exact ranges. Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real Node process so silk-effects is a normal runtime **dependency**, not bundled.

## The runtime layer

One long-lived Effect `ManagedRuntime`, built from `SilkRuntimeLive` (`src/runtime.ts`), composed **directly** from `silk-effects` and `workspaces-effect` exports — both of which mcp is allowed to import, so the cli↔silk↔mcp non-import invariant holds without indirection.

`SilkRuntimeLive` exposes the services the tools need: `SilkWorkspaceAnalyzer` (for `workspace_info`), `WorkspaceRoot` (for root walk-up, see [Root resolution](#root-resolution)), `Turbo.TurboInspector` (for `turbo_inspect`), the `Changesets.BranchAnalyzer` + `Changesets.ConfigInspector` pair (for `changeset_inspect`), `Changesets.ReleasePlanner` (for `changeset_preview`), `Changesets.DepsRegen` (for `changeset_deps_detect`/`changeset_deps_regen`), `Repos.ReposConfigStore` (for `repos_inspect` config mode) and `Repos.ReposManager` (for `repos_inspect` status mode and all `repos_manage` actions). A single shared `ConfigInspector` instance feeds the branch analyzer, the release planner and `DepsRegen`, and is re-exposed, the same shared-instance pattern the CLI uses. `DepsRegenLive` requires `PointInTimeWorkspace | ConfigInspector | WorkspaceDiscovery | PublishabilityDetector | ChangesetConfig`; `ConfigInspector` comes from the shared instance above, `PointInTimeWorkspace` is added via `PointInTimeWorkspaceLive` (whose `WorkspaceRoot`/`WorkspaceDiscovery` come from `WorkspacesLive` inside `DepsLive`), `ChangesetConfig` is provided its own `ChangesetConfigReaderLive` (`Layer.mergeAll` does not cross-feed the one already in `DepsLive`), and the remaining `WorkspaceDiscovery`/`PublishabilityDetector` arrive from `WorkspacesLive`. Unlike the CLI, the MCP does not hand-compose the `PointInTimeWorkspace` sub-graph over a minimal workspace trio because it already pulls in `WorkspacesLive` for the analyzer (see `../cli/architecture.md`). The leftover platform requirements (`CommandExecutor`, `FileSystem`, `Path`) flow up to the host layer, which `bin.ts` supplies at the edge via `NodeContext.layer`. `DepsRegen`'s tool error unions widened to add `PointInTimeReadError` and `ChangesetIOError`. See `src/runtime.ts` for the exact wiring.

`SilkRuntimeLive` composes its **own** stack rather than hoisting the CLI's `AppLive`: the two runtimes genuinely diverge (the CLI does not include the analyzer) and the only shared surface is the three-line workspace-trio wiring, so a shared layer would couple two diverging consumers for negligible gain. Extracting one is deferred until a second host needs the same composition. No CLI code is touched by this package.

The smoke tests in `__test__/` (`runtime.smoke.test.ts`, `server.smoke.test.ts`) are the layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at typecheck.

## The tools

Every tool follows the conventions proven by `workspace_info` (`src/tools/workspace-info.ts`):

- **Effect Schema is the source of truth** for input and output, with `.annotations()` carrying descriptions. The handler runs as `runtime.runPromise(Effect.gen(...))`, yielding silk-effects services; all logic stays in silk-effects and the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way `Schema.transformOrFail` (decode succeeds to markdown, encode is `Forbidden`), and the tool returns `{ content: [{ type: "text", text }], structuredContent: <json> }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool` accepts only zod schemas. The bridge (`src/schema/effect-to-zod.ts`) routes Effect Schema → `JSONSchema.make` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place the canonical Effect Schema crosses into the SDK's world.

`workspace_info` wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive projection** of `WorkspaceAnalysis`: `linked`/`fixed` collapse to arrays of workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in `AnalyzedWorkspace` (which the zod bridge cannot inline, see [Rationale](#why-a-flat-tool-projection-over-the-rich-analysis)) and is more token-efficient for the agent. See `src/tools/workspace-info.ts`.

`turbo_inspect` (`src/tools/turbo-inspect.ts`) wraps silk-effects' `Turbo.TurboInspector` — read-only Turborepo introspection that never executes a task (every path is `turbo … --dry=json`). Its result is a **discriminated union keyed by `mode`** (`cache` | `graph` | `affected`), each variant embedding the corresponding silk-effects `Turbo` result schema. Those embedded schemas are flat and non-recursive so the union round-trips cleanly through the effect→zod bridge. The handler resolves the workspace root via `WorkspaceRoot.find` from the requested (or fallback) `cwd` — the same walk-up `workspace_info` uses — then dispatches to the matching `TurboInspector` method.

`changeset_inspect` (`src/tools/changeset-inspect.ts`) follows the exact same pattern, backing the silk plugin's `changeset-manager` workflow. Its result is a **discriminated union keyed by `mode`** (`branch` | `config` | `classify`): `branch` wraps `Changesets.BranchAnalyzer.analyzeBranch` (diff-against-base file classification), `config` wraps `Changesets.ConfigInspector.inspect` (the resolved `.changeset/config.json`), and `classify` wraps `Changesets.ConfigInspector.classify` (an arbitrary file path → its owning package). All embedded schemas bridge safely. Because the server is long-lived and holds one shared `ConfigInspector` whose cache never self-expires, the handler calls `inspector.refresh()` **once up front, before dispatching on `mode`** — a per-call refresh so every mode observes on-disk edits made since the last tool call, `branch` included (its `BranchAnalyzer` reads through the same shared inspector). This is the staleness fix for #229 (superseding the narrower standalone `discovery.refresh()` from #262). The structured MCP result exists because the CLI's `--json` output is prefixed with an `Effect.log` line that breaks naive `JSON.parse`; the structured result sidesteps that fragility. The `classify`/`config show`/`analyze-branch`/`release-surface` inspection commands were removed from the `savvy changeset` CLI, so these MCP modes are now the inspection surface. See `src/tools/changeset-inspect.ts` and `../silk/plugin.md`.

`changeset_validate` (`src/tools/changeset-validate.ts`) is a read-only tool that validates the changeset files in `.changeset/` against the `@savvy-web/changesets` format rules via silk-effects' `Changesets.ChangesetLinter`. Its result carries the typed `LintMessage` diagnostics (file path, rule code, message) plus an `ok` boolean and `errorCount`, with the same one-way markdown transcript transform as the other tools. It is the structured counterpart to the `savvy changeset lint` CLI path, the tool side of the inspection surface alongside `changeset_inspect`. See `src/tools/changeset-validate.ts`.

`changeset_preview` (`src/tools/changeset-preview.ts`) is a read-only preview of the next release, backing the silk plugin's `changeset-preview` skill. It wraps silk-effects' `Changesets.ReleasePlanner.preview`, which runs the genuine changesets engine over the pending `.changeset/` files against a throwaway temp directory (never mutating the repo) and returns each package's version bump plus the rendered CHANGELOG block exactly as it would ship, dependency tables included. The handler resolves the workspace root via `WorkspaceRoot.find` then calls `preview`, with the same flat structured result and one-way markdown transcript transform (a bump table followed by per-package release notes) as the other tools. Only `preview` is exposed; `ReleasePlanner.apply` is the destructive native release and is intentionally kept off MCP — it lives behind the `savvy changeset version` CLI command instead (see `../cli/architecture.md` and `../silk-effects/architecture.md`). See `src/tools/changeset-preview.ts`.

`changeset_deps_detect` (`src/tools/changeset-deps-detect.ts`) is a read-only preview of the cumulative dependency diff (merge-base→working tree, or an explicit `base`/`package`), backing the silk plugin's `dependencies` skill. It resolves `WorkspaceRoot` then calls silk-effects' `Changesets.DepsRegen.plan({ includeDevDeps: true, ... })` — the read-only path, so devDependencies stay in the diff and no file is touched — and returns each affected package's resolved dependency-table rows exactly as a pure-dependency changeset would carry them (`catalog:`/`workspace:` specifiers resolved to concrete versions where possible). See `src/tools/changeset-deps-detect.ts` and `../silk-effects/architecture.md`.

`changeset_deps_regen` (`src/tools/changeset-deps-regen.ts`) regenerates pure-dependency changesets: it resolves `WorkspaceRoot`, calls `Changesets.DepsRegen.plan(...)`, and — unless `dryRun` is set — calls `execute(plan)`, deleting only the single-package Dependencies-only changesets the plan marked for replacement (the narrowed delete predicate — in-scope, rewritten this run, and authored on this branch, not at the merge base; see #258 in `../silk-effects/architecture.md`) and writing fresh ones from the current diff (devDependencies dropped, protocol specifiers resolved). Mixed changesets are left untouched. It is the **second mutating tool after `biome_check`**, a deliberate, documented exception to the read-only convention (see [Boundaries and invariants](#boundaries-and-invariants)); the mutation is never implicit — a bare call with `dryRun: true` only computes the plan — and `.changeset/*.md` writes are git-reversible. See `src/tools/changeset-deps-regen.ts`.

`biome_check` (`src/tools/biome-check.ts`) departs from the other tools in two ways: it is a **thin proxy that shells the Biome CLI directly** (no silk-effects service backs it — silk-effects is reused only for `Lint.Biome.findBiome()` binary resolution), and it is **one of the three savvy-mcp tools that mutate the working tree** (the others being `changeset_deps_regen` and `repos_manage` below). It does not run on the Effect runtime; the handler is a plain async `spawnSync` over Biome with optional `write`/`unsafe` fix params, both defaulting off. Its `BiomeCheckResult` schema is flat, with the same one-way markdown transcript transform as the other tools, and carries a fixed `guidance` guardrail that steers the agent to fix code rather than silence rules. The mutation departure is documented in [Boundaries and invariants](#boundaries-and-invariants). See `src/tools/biome-check.ts` for the schema, the gitlab parser and the handler, and `../silk/plugin.md` for the Biome LSP, the `biome-prefer-mcp` nudge hook and the `<biome_capability>` orientation block.

The execution flow is **fix-then-validate over the stable `gitlab` reporter** (not the experimental `json` reporter). When `write`/`unsafe` is set the handler runs a fix pass first, then always runs a read pass that reports what *remains* after any fix. stdout is parsed regardless of exit code (Biome's `0`/`1` both carry diagnostics; only `>1` means Biome itself failed and surfaces as a tool error); the gitlab severity scale maps onto the result's three-level `error`/`warning`/`info`. Returning structured data instead of Bash stdout sidesteps the Bash tool's output truncation.

`repos_inspect` (`src/tools/repos-inspect.ts`) follows the same discriminated-union pattern as `changeset_inspect` and `turbo_inspect`. Its result is keyed by `mode` (`status` | `config`): `status` wraps `Repos.ReposManager.status` (reports per-repo presence, the gitlink commit, working-tree dirtiness, and stale note ids), and `config` wraps `Repos.ReposConfigStore.read` (surfaces the validated `.repos/config.json` manifest and its entries). All output strings are markdown-escaped because vendored-repo content is untrusted input and may contain special characters or markdown syntax. The handler resolves the workspace root via `WorkspaceRoot.find` before dispatching on `mode`. See `src/tools/repos-inspect.ts`.

`repos_manage` (`src/tools/repos-manage.ts`) is the **third and final mutating tool**, a deliberate exception to the read-only convention (alongside `biome_check` and `changeset_deps_regen`; see [Boundaries and invariants](#boundaries-and-invariants)). It manages vendored repositories via `Repos.ReposManager` with an `action`-discriminated interface: `action=sync` runs `git submodule update --init --depth 1`, applies sparse-checkout from the manifest, and clears stale locks; `action=pin` fetches the new ref, checks it out (detached), and stages the updated gitlink and manifest ref, `action=add` adds a new repo entry to the manifest, and `action=note` appends a short note to a repo's metadata. All mutations write through: `.repos/config.json` edits, git submodule operations, and filesystem changes are git-reversible. The tool returns structured results for each action (versions, submodule links, rendered manifests, note metadata). The wire schema flattens the `action`-discriminated union into a single `repos_manage` tool because MCP clients render `oneOf` poorly; internally, an Effect `Schema.TaggedStruct` union names the missing field per action on decode failure, providing better error feedback. See `src/tools/repos-manage.ts`.

## Root resolution

The `savvy-mcp` bin resolves its base directory by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → `process.cwd()` (`src/bin.ts`). Because dev tooling launches the server from `packages/mcp/` rather than the repo root, the tool handlers additionally resolve the true workspace root by walking up from the base dir (or an explicit `cwd` argument) via `WorkspaceRoot.find` before analyzing — so the tools work from any subdirectory. The walk-up lives in the **mcp handler, not the analyzer**, so the analyzer/CLI contract stays unchanged.

## Plugin integration

A plugin declares the server via an `mcpServers` block in `.claude-plugin/plugin.json` whose command runs a `bin/start-mcp.sh` launcher (detect package manager → `exec <pm> savvy-mcp`), passing the project dir through `CLAUDE_PROJECT_DIR`. The same launcher and declaration are reused by both plugins that spawn the server — `plugins/silk` and `plugins/github-actions` — and each is registered in the repo's `.claude-plugin/marketplace.json`. The former `plugins/docs` plugin, which owned the removed corpus write-side, has been deleted.

**Information lives in the server, direction lives in the plugins.** Each plugin adds per-plugin SessionStart orientation hooks pointing the agent at the tools it should prefer — consult `workspace_info` before reporting workspace facts, reach for `changeset_inspect`/`changeset_validate`/`turbo_inspect`/`biome_check` rather than parsing bash stdout. The shared server carries every tool regardless of the current project; the plugin decides which to surface. See `../silk/plugin.md` for the silk orientation.

When both plugins are active in one session, each declares the server, so Claude Code may spawn one instance per plugin. The server is stateless and lightweight, so this is acceptable.

## Boundaries and invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from `silk-effects` (and `workspaces-effect`), preserving the cli↔silk↔mcp non-import invariant.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is canonical; zod is a boundary-only dependency** confined to the `effect-to-zod` bridge at the SDK registration edge.
- **`biome_check`, `changeset_deps_regen` and `repos_manage` are the three mutating tools — an intentional, documented exception to the read-only convention.** Every other tool registers with `annotations: { readOnlyHint: true }` and never touches the working tree; these three carry **no** `readOnlyHint`. `biome_check` edits files when `write`/`unsafe` is set (both default off, so a bare call only reads) and Biome `--write` is deterministic and git-reversible. `changeset_deps_regen` deletes/writes `.changeset/*.md` unless `dryRun` is set (so a bare call only computes the plan), and those writes are likewise git-reversible. `repos_manage` stages a gitlink, edits `.repos/config.json`, and runs git operations — manifest edits and submodule ops are git-reversible. `biome_check` is additionally the only tool that bypasses the Effect runtime and shells a CLI directly; `changeset_deps_regen` and `repos_manage` run on the Effect runtime like the rest.

## Rationale

### Convention deviations in `repos_manage`

`repos_manage` deliberately breaks two precedents set by earlier tools.

**One action-discriminated tool, not per-verb.** The `changeset_deps_*` tools split into two (`detect`/`regen`) because an agent's workflow is "read first, then act". `repos_manage` unifies four actions (`sync`, `pin`, `add`, `note`) into a single tool for the same reason — an agent needs to know all available operations and pick one per context. MCP clients struggle to render `oneOf` unions (they show as separate tools), so the wire schema is flat with a single `action` discriminant; internally an Effect `Schema.TaggedStruct` union names the missing required field per action on decode failure, surfacing better error guidance (e.g. `action:"pin"` without `ref` fails decoding by naming `ref` as the missing field). This is intentional coupling of the four verbs into one surface; splitting them would fragment the discovery burden for agents.

**Third mutating-tool exception with a materially larger surface.** Unlike `biome_check` (which shells a utility) and `changeset_deps_regen` (which only writes `.changeset/*.md` unless `dryRun`), `repos_manage` stages a gitlink (`git submodule add/update`), edits the committed `.repos/config.json` manifest (untrusted-input content, hence the markdown-escaping in `repos_inspect`), and runs multiple git operations. The three tools form an intentional hierarchy: `biome_check` is the smallest surface (files only, LSP-anchored semantics), `changeset_deps_regen` is medium (confined to `.changeset/` and the workspace catalog), and `repos_manage` is the broadest (git infrastructure, multi-repo orchestration). All three are marked non-read-only; `biome_check` and `changeset_deps_regen` default to non-mutating call paths, while `repos_manage` always mutates to stage git changes for the caller to review and commit.

### Why a standalone server, not a discovery host

A thin discovery host reading a contribution contract from installed packages was considered and dropped as premature coupling. A standalone server with a fixed tool surface ships value now, and keeping direction in the plugins already gives per-project tailoring without a discovery seam. The CLI remains the bridge for what tools cannot yet cover.

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the Effect-Schema → JSON-Schema → zod bridge cannot inline. Projecting to a flat, name-only result both satisfies the bridge and produces more token-efficient output for the consuming agent. The projection is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.
