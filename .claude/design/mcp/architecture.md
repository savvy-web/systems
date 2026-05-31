---
status: current
module: mcp
category: architecture
created: 2026-05-31
updated: 2026-05-31
last-synced: 2026-05-31
completeness: 90
related:
  - ../silk-effects/architecture.md
  - ../cli/architecture.md
  - ../silk/plugin.md
dependencies:
  - ../silk-effects/architecture.md
---

# @savvy-web/mcp architecture

The `savvy-mcp` server — a standalone, spawnable MCP server that serves Silk Suite tooling and
library knowledge to coding agents as structured tools and curated resources. Built on an Effect
`ManagedRuntime` over `@savvy-web/silk-effects` plus the `@modelcontextprotocol/sdk`.

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

`@savvy-web/mcp` owns the `savvy-mcp` binary: a long-lived MCP server, spawned (never typed by a
human) alongside an agent in the project working directory, shared across Claude Code plugins. It
exists to make Silk tooling cheaper for agents to consume than bash — structured JSON tool output
instead of parsed console text — and to serve library knowledge as MCP resources agents research
before guessing.

It is **not** a discovery host. An earlier silk-core framing imagined a thin host reading a
`./savvy` contribution contract from installed packages; that is dropped. The MCP is a
content-rich server with two concrete jobs (tools and resources) and no discovery seam. It reuses
`@savvy-web/silk-effects` for tool logic — the same business layer the `savvy` CLI uses.

**Package:** `@savvy-web/mcp`
**Location:** `packages/mcp` in `savvy-web/systems`
**Bin:** `savvy-mcp` → `src/bin.ts` → `startMcpServer()` in `src/server.ts`
**Build:** ESM-only via `@savvy-web/rslib-builder` (`NodeLibraryBuilder`)

This is Silk Core sub-project 2. The full as-built design and decision log live in
`docs/superpowers/specs/2026-05-31-savvy-mcp-host-design.md` (a walking skeleton: one real tool,
one real resource family) and the implementation record in
`docs/superpowers/plans/2026-05-31-savvy-mcp-host-skeleton.md`.

## Current State

Implemented and verified end-to-end via the MCP Inspector against the built `savvy-mcp` binary.
The skeleton ships one tool (`workspace_info`), the `silk://catalog` plus standards/packages/guides
resource layer (content inlined as TS constants), `plugins/silk` MCP wiring, and an empty
`plugins/github-actions` skeleton that spawns the same server. `private: true` in source; the
builder flips it on build.

`@savvy-web/mcp` depends on `@savvy-web/silk-effects` (`workspace:*`), `workspaces-effect`,
`@effect/platform`, `@effect/platform-node`, `effect`, `@modelcontextprotocol/sdk` and `zod` (v4).
Unlike `@savvy-web/silk`, which bundles silk-effects for CJS `require()` reasons, the MCP is a real
Node process so silk-effects is a normal runtime **dependency**, not bundled.

## The Information-vs-Direction Split

The load-bearing architectural principle. **Information lives in the MCP; direction lives in the
plugins.** The server carries every resource and tool regardless of the current project — including,
eventually, GitHub Actions knowledge. Each plugin decides which resources and tools to point the
agent at, so a non-Actions project never gets bloated with Actions context even though the shared
server could serve it. This split is why two plugins (`plugins/silk`, `plugins/github-actions`)
spawn the identical server but orient the agent differently. The MCP itself carries no per-project
gating.

## The Runtime Layer

One long-lived Effect `ManagedRuntime`, built from `SilkRuntimeLive` (`src/runtime.ts`), composed
**directly** from `silk-effects` and `workspaces-effect` exports — both of which mcp is allowed to
import, so the cli↔silk↔mcp non-import invariant holds without indirection.

`SilkRuntimeLive` exposes two services: `SilkWorkspaceAnalyzer` (the skeleton's one tool) and
`WorkspaceRoot` (for root walk-up — see [Root Resolution](#root-resolution)). It is built by
providing `SilkWorkspaceAnalyzerLive` + `WorkspaceRootLive` with a `DepsLive` merge of
`WorkspacesLive` (the workspace trio plus `DependencyGraph` and `TopologicalSorter` the analyzer
needs), `ChangesetConfigReaderLive`, `TagStrategyLive` and `VersioningStrategyLive` (itself fed
`ChangesetConfigReaderLive`, since `Layer.mergeAll` does not cross-feed siblings). The layer still
requires `FileSystem` + `Path`; `bin.ts` supplies them at the edge via `NodeContext.layer`. See
`src/runtime.ts` for the exact wiring.

`SilkRuntimeLive` composes its **own** stack rather than hoisting the CLI's. The CLI's `AppLive`
does not include the analyzer (the two runtimes genuinely diverge) and the only shared surface is
the three-line workspace-trio wiring, so a shared layer would couple two diverging consumers for
negligible gain. Extracting one is deferred until a second host needs the same composition (YAGNI).
No CLI code is touched by this package.

The smoke tests (`__test__/runtime.smoke.test.ts`, `server.smoke.test.ts`) are the
layer-completeness gate, exactly as in the CLI: a missing service names itself at runtime, not at
typecheck.

## The Tool Half

Every tool follows the conventions proven by `workspace_info` (`src/tools/workspace-info.ts`):

- **Effect Schema is the source of truth** for input and output, with `.annotations()` carrying
  descriptions. The handler runs as `runtime.runPromise(Effect.gen(...))`, yielding silk-effects
  services; all logic stays in silk-effects and the tool file is glue.
- **Dual-channel return.** The structured result is rendered to a markdown transcript via a one-way
  `Schema.transformOrFail` (decode succeeds to markdown, encode is `Forbidden`), and the tool
  returns `{ content: [{ type: "text", text }], structuredContent: <json> }`.
- **Effect Schema bridges to zod at the SDK boundary.** `@modelcontextprotocol/sdk`'s `registerTool`
  accepts only zod schemas, not raw JSON Schema. The bridge (`src/schema/effect-to-zod.ts`) routes
  Effect Schema → `JSONSchema.make` → inlined `$ref`s → `z.fromJSONSchema`. This is the one place
  the canonical Effect Schema crosses into the SDK's world; `zod` (v4) is a boundary dependency only.

`workspace_info` wraps `SilkWorkspaceAnalyzer`. Its output is a deliberately **flat, non-recursive
projection** of `WorkspaceAnalysis` (`WorkspaceInfoResult`): `linked`/`fixed` collapse to arrays of
workspace names and `targets` to registry URL strings. This avoids the recursive `Schema.suspend` in
`AnalyzedWorkspace` (which the zod bridge cannot inline) and is more token-efficient for the agent.
See `src/tools/workspace-info.ts` for the schema, the `toWorkspaceInfoResult` mapper and the
transcript transform.

## The Resource Half

Resources serve hand-authored library knowledge behind a stable URI scheme. Two discovery surfaces
coexist: a curated catalog and native SDK listing.

- **`silk://catalog`** is a single token-cheap resource listing every available resource grouped by
  tier, each line a URI plus a "load when …" hint. It is the agent's mandated first read.
- Every resource is **also** registered natively with the SDK (title + description) so MCP-client
  enumeration works alongside the catalog.

The URI taxonomy is the load-bearing contract, designed to stay stable when `packages/*` content
later swaps from hand-authored to generated-from-API-model:

- `silk://standards/<topic>` — Silk development standards (commits, changesets, lint, testing).
- `silk://packages/<pkg>/<topic>` — per-package API/usage docs.
- `silk://guides/<slug>` — higher-level conceptual articles layered over the packages.

A catalog-integrity test (`__test__/resources/catalog.test.ts`) asserts every URI listed in the
catalog resolves to registered content — a cheap guard against drift in the hand-authored catalog.
For the skeleton, content is **inlined as TS string constants** (`src/resources/content.ts`) to
avoid any build-output path-resolution failure mode; scaling to bundled markdown files behind the
same catalog and URI scheme is a later concern. See `src/resources/{catalog,index}.ts` for the
model and registration.

## Root Resolution

The `savvy-mcp` bin resolves its base directory by precedence `argv[2]` → `SAVVY_MCP_PROJECT_DIR` →
`CLAUDE_PROJECT_DIR` → `process.cwd()` (`src/bin.ts`). Because dev tooling launches the server from
`packages/mcp/` rather than the repo root, the `workspace_info` handler additionally resolves the
true workspace root by walking up from its base dir (or an explicit `cwd` argument) via
`WorkspaceRoot.find` before analyzing — so the tool works from any subdirectory. The walk-up lives
in the **mcp handler, not the analyzer**, so the analyzer/CLI contract stays unchanged.

## Plugin Integration

A plugin declares the server via an `mcpServers` block in `.claude-plugin/plugin.json` whose command
runs a `bin/start-mcp.sh` launcher (detect package manager → `exec <pm> savvy-mcp`), passing the
project dir through `CLAUDE_PROJECT_DIR`. The same launcher and declaration are reused by both
`plugins/silk` and `plugins/github-actions`, and each plugin is registered in the repo's
`.claude-plugin/marketplace.json`.

Direction is added per plugin as a lightweight SessionStart orientation hook telling the agent to
read `silk://catalog` before researching and to prefer `workspace_info` over bash for workspace
questions. `plugins/github-actions` ships deliberately empty of Actions content — a manifest, the
shared launcher and one orientation hook — to validate the information-vs-direction split with two
real consumers and leave a buildout-ready shell. See `../silk/plugin.md` for the `plugins/silk`
merge and the orientation-hook wiring.

When both plugins are active in one session, each declares the server, so Claude Code may spawn one
instance per plugin. The server is stateless and lightweight, so this is acceptable; in practice a
project enables the general (`silk`) or specialized (`github-actions`) plugin as appropriate.

## Boundaries and Invariants

- **`@savvy-web/mcp` imports neither `@savvy-web/cli` nor `@savvy-web/silk`.** All logic comes from
  `silk-effects` (and `workspaces-effect`), preserving the cli↔silk↔mcp non-import invariant.
- **ESM-only, real Node process.** silk-effects is a normal runtime dependency, not bundled — the
  opposite of `@savvy-web/silk`'s dual-format CJS-bundling requirement.
- **Effect Schema is canonical; zod is a boundary-only dependency** confined to the
  `effect-to-zod` bridge at the SDK registration edge.

## Rationale

### Why a standalone server, not a discovery host

The parent silk-core spec framed the MCP as a thin discovery host peer to the CLI reading a
contribution contract. That framing is dropped as premature coupling. A content-rich standalone
server with a fixed tool/resource surface ships value now; the discovery seam — if it ever returns —
is a future concern, and the information-vs-direction split already gives per-project tailoring
without one. The CLI remains the bridge for what tools cannot yet cover.

### Why a flat tool projection over the rich analysis

`WorkspaceAnalysis` uses recursive `Schema.suspend` for `linked`/`fixed` cross-references, which the
Effect-Schema → JSON-Schema → zod bridge cannot inline. Projecting to a flat, name-only result both
satisfies the bridge and produces more token-efficient output for the consuming agent. The projection
is the tool's contract; the rich analysis stays the analyzer's contract in silk-effects.
