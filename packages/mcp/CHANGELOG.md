# @savvy-web/mcp

## 0.4.0

### Features

* [`09dc242`](https://github.com/savvy-web/systems/commit/09dc24206868d50fa885adb6985d7d7d8ec62578) Adds the `turbo_inspect` tool — a read-only Turborepo inspector over silk-effects' `Turbo` namespace, returning a discriminated-union result keyed by mode (cache|graph|affected) — plus the `silk://standards/turbo/*` corpus docs.

### Build System

* [`09dc242`](https://github.com/savvy-web/systems/commit/09dc24206868d50fa885adb6985d7d7d8ec62578) Now built with `@savvy-web/bundler`.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.6.1 | 1.0.0 |

## 0.3.1

### Other

* [`6511053`](https://github.com/savvy-web/systems/commit/651105346f97d6e486106c4a2f992e0b2cbbac0f) Upgrades to pnpm v11 deployments
  | Dependency              | Type       | Action  | From  | To    |
  | ----------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/silk-effects | dependency | updated | 0.6.0 | 0.6.1 |

## 0.3.0

## 0.2.1

### Documentation

* [`a9ea047`](https://github.com/savvy-web/systems/commit/a9ea04701507a3d5fb290dbaa1eeb3d5f599a67b) Added package READMEs for `@savvy-web/silk`, `@savvy-web/cli`, and `@savvy-web/mcp`. Each covers installation, quick-start usage, and the package's public surface — the `savvy` commands for the CLI, the drop-in config shim export map for silk, and the tool and resource surface for the MCP server. These READMEs ship with each package and render on its npm page.

## 0.2.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

* **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
* **`silk_docs_search` tool** — a read-only intent search across the Silk documentation corpus using an in-memory Fuse index over each document's title, tags, and summary. Accepts a plain-keyword query plus optional `limit` and `tier` filters; returns ranked matches with the document URI, title, summary, tags, and a normalized high/medium/low confidence label, tie-broken by curated priority. It never returns empty — a no-match query falls back to the top entries with a catalog nudge. Agents use this to locate the right document before fetching it with the resource layer.
* **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs.
* **`silk://{+path}` resource template** — serves individual documents from the on-disk corpus by URI path. Documents live under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`; the catalog lists every addressable path.

The document corpus is compiled at build time by a `build:catalog` script into a validated `manifest.json`. At runtime the server hydrates the Fuse search index from the manifest and serves each document on demand through the resource template.

The `McpContext` public export carries the resource layer, so the barrel also re-exports the types reachable through it — `DocIndex`, `Manifest`, `ManifestEntry`, `SearchResult`, and `SearchOptions` — letting consumers that embed or extend the server work with the manifest and search shapes directly.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary. It consumes the external unscoped `api-extractor-llms` npm package as a build-time devDependency to render the generated API-reference tier (see below).

### API-doc generation pipeline

The server's per-package API-reference docs are rendered from in-monorepo library packages' API Extractor models, via `api-extractor-llms`. They occupy the `silk://packages/<pkg>/api/*` tier of the resource tree and are available to agents via `silk_docs_search` and the `silk://{+path}` resource template. The rendered markdown is tracked source content that ships in the published package; only the upstream `.api.json` Extractor models stay out of version control. The catalog `manifest.json` is likewise tracked, and every resource carries an accurate `lastModified` drawn from its git history.

### Body-content search

The Fuse index backing `silk_docs_search` now indexes document bodies at low weight (0.03), in addition to title (0.55), tags (0.30), and summary (0.12). Queries that have no strong title or tag match now surface relevant documents based on body content rather than falling through to the priority-ordered fallback.

### Related-graph see-also boost

`silk_docs_search` results now include a `related` field on each hit, carrying the related document URIs declared in the manifest. The top three ranked results pull in their related neighbors as low-confidence see-also entries (if not already present in the result set), giving agents a broader view of connected content.

```typescript
// Each search hit now includes:
{
  uri: "silk://packages/mcp/overview",
  title: "...",
  related: ["silk://standards/api-model-pipeline", "silk://guides/api-docs-from-api-extractor"],
  // ...
}
```

### Structured query logging

The server emits structured stderr log lines for every `silk_docs_search` invocation. Each line records the raw query string, the resolved result count, and whether the response was a fallback (no Fuse match). Logging goes to stderr only, so it does not affect the MCP stdio protocol.

### Hand-authored corpus content (4 standards + 3 guides)

Seven new documents are part of the Silk knowledge corpus and are indexed at launch:

Standards:

* `silk://standards/api-model-pipeline` — API Extractor model pipeline conventions
* `silk://standards/changeset-format` — changeset file format and style rules
* `silk://standards/dependency-conventions` — dependency declaration conventions
* `silk://standards/semver` — SemVer versioning policy for the Silk Suite

Guides:

* `silk://guides/api-docs-from-api-extractor` — generating API docs from API Extractor models
* `silk://guides/building-a-github-action` — building a GitHub Action with Silk tooling
* `silk://guides/choosing-a-builder` — selecting the right rslib builder for a package

### Docs authoring plugin for the savvy MCP corpus

A new `docs` Claude Code plugin ships alongside the savvy MCP server, turning the documentation corpus into something agents can author and maintain, not just read. The plugin spawns the same shared `savvy-mcp` server and adds a guided authoring workflow on top of it.

What a plugin user gets:

* **`mcp` corpus agent** — an authoring agent that resolves a savvy-web/systems checkout, reads the live front-matter contract, drafts or edits a doc under the standards, packages, or guides tier, verifies it through the `build:catalog` integrity gate, and commits with DCO sign-off or opens a PR. It orients itself through `silk://catalog` and `silk_docs_search` before touching source, so subagent runs follow the same catalog-first discipline as the main session.
* **`/docs:write-guide [topic] [--pr]`** — author a new corpus doc from a topic, defaulting to the guides tier, checking for an overlapping doc first.
* **`/docs:improve [doc-id-or-path] [--pr]`** — improve an existing doc: stale content, over-budget bodies, broken related links, or outdated status.
* **`corpus-authoring` skill** — encodes the front-matter schema, tier assignment, the controlled tag vocabulary with a propose-then-add workflow, and related-id rules, reading the live contract so values never drift from the server's schema.
* **`corpus-verify` skill** — runs the `build:catalog` gate (schema, id uniqueness, tier/directory double-check, tag and related resolution, dead-name check, per-tier body budgets) and reports errors versus body-budget warnings, with both human-readable and JSON output.

A SessionStart orientation hook points the agent at the shared MCP catalog and search tools at the start of each session.

## 0.1.0

### Features

* [`38574e2`](https://github.com/savvy-web/systems/commit/38574e29f1e69afde2a52fc7761eda511fa8fabd) ### savvy-mcp server

`@savvy-web/mcp` is the Silk Suite MCP server: the `savvy-mcp` binary starts a stdio Model Context Protocol server that exposes Silk tooling and library knowledge to coding agents. It is spawned by the Silk Suite Claude Code plugins and shares the `@savvy-web/silk-effects` business logic with the `savvy` CLI.

It exposes:

* **`workspace_info` tool** — returns a structured snapshot of the current Silk workspace: runtime, package manager, and a per-workspace summary (name, version, publishability, versioning/tag/release state, and linked/fixed group membership by name). The result is delivered both as a markdown summary and as typed structured JSON. The server resolves the workspace root by walking up from its launch directory, so the tool works even when started from a subdirectory; override the base directory with a bin argument or the `SAVVY_MCP_PROJECT_DIR` environment variable.
* **`silk_docs_search` tool** — a read-only intent search across the Silk documentation corpus using an in-memory Fuse index over each document's title, tags, and summary. Accepts a plain-keyword query plus optional `limit` and `tier` filters; returns ranked matches with the document URI, title, summary, tags, and a normalized high/medium/low confidence label, tie-broken by curated priority. It never returns empty — a no-match query falls back to the top entries with a catalog nudge. Agents use this to locate the right document before fetching it with the resource layer.
* **`silk://catalog` resource** — a curated catalog of Silk knowledge grouped by tier (Standards, Packages, Guides), each entry carrying a "load when" hint so agents read the catalog first and fetch only the resource a task needs.
* **`silk://{+path}` resource template** — serves individual documents from the on-disk corpus by URI path. Documents live under `silk://standards/*`, `silk://packages/<pkg>/*`, and `silk://guides/*`; the catalog lists every addressable path.

The document corpus is compiled at build time by a `build:catalog` script into a validated `manifest.json`. At runtime the server hydrates the Fuse search index from the manifest and serves each document on demand through the resource template.

The `McpContext` public export carries the resource layer, so the barrel also re-exports the types reachable through it — `DocIndex`, `Manifest`, `ManifestEntry`, `SearchResult`, and `SearchOptions` — letting consumers that embed or extend the server work with the manifest and search shapes directly.

The server is built on `@modelcontextprotocol/sdk` with Effect-based service wiring over `@savvy-web/silk-effects`. Effect Schema is the source of truth for tool input and output, bridged to Zod only at the MCP registration boundary. It consumes the external unscoped `api-extractor-llms` npm package as a build-time devDependency to render the generated API-reference tier (see below).

### Ephemeral API-doc generation pipeline

The server generates per-package API-reference docs at startup from in-monorepo library packages' API Extractor models, via `api-extractor-llms`. The generated docs occupy the `silk://packages/<pkg>/api/*` tier of the resource tree and are available immediately to agents via `silk_docs_search` and the `silk://{+path}` resource template. Generation is ephemeral — docs are produced on demand during the build phase and are not checked into the repo.

### Body-content search

The Fuse index backing `silk_docs_search` now indexes document bodies at low weight (0.03), in addition to title (0.55), tags (0.30), and summary (0.12). Queries that have no strong title or tag match now surface relevant documents based on body content rather than falling through to the priority-ordered fallback.

### Related-graph see-also boost

`silk_docs_search` results now include a `related` field on each hit, carrying the related document URIs declared in the manifest. The top three ranked results pull in their related neighbors as low-confidence see-also entries (if not already present in the result set), giving agents a broader view of connected content.

```typescript
// Each search hit now includes:
{
  uri: "silk://packages/mcp/overview",
  title: "...",
  related: ["silk://standards/api-model-pipeline", "silk://guides/api-docs-from-api-extractor"],
  // ...
}
```

### Structured query logging

The server emits structured stderr log lines for every `silk_docs_search` invocation. Each line records the raw query string, the resolved result count, and whether the response was a fallback (no Fuse match). Logging goes to stderr only, so it does not affect the MCP stdio protocol.

### Hand-authored corpus content (4 standards + 3 guides)

Seven new documents are part of the Silk knowledge corpus and are indexed at launch:

Standards:

* `silk://standards/api-model-pipeline` — API Extractor model pipeline conventions
* `silk://standards/changeset-format` — changeset file format and style rules
* `silk://standards/dependency-conventions` — dependency declaration conventions
* `silk://standards/semver` — SemVer versioning policy for the Silk Suite

Guides:

* `silk://guides/api-docs-from-api-extractor` — generating API docs from API Extractor models
* `silk://guides/building-a-github-action` — building a GitHub Action with Silk tooling
* `silk://guides/choosing-a-builder` — selecting the right rslib builder for a package

### Docs authoring plugin for the savvy MCP corpus

A new `docs` Claude Code plugin ships alongside the savvy MCP server, turning the documentation corpus into something agents can author and maintain, not just read. The plugin spawns the same shared `savvy-mcp` server and adds a guided authoring workflow on top of it.

What a plugin user gets:

* **`mcp` corpus agent** — an authoring agent that resolves a savvy-web/systems checkout, reads the live front-matter contract, drafts or edits a doc under the standards, packages, or guides tier, verifies it through the `build:catalog` integrity gate, and commits with DCO sign-off or opens a PR. It orients itself through `silk://catalog` and `silk_docs_search` before touching source, so subagent runs follow the same catalog-first discipline as the main session.
* **`/docs:write-guide [topic] [--pr]`** — author a new corpus doc from a topic, defaulting to the guides tier, checking for an overlapping doc first.
* **`/docs:improve [doc-id-or-path] [--pr]`** — improve an existing doc: stale content, over-budget bodies, broken related links, or outdated status.
* **`corpus-authoring` skill** — encodes the front-matter schema, tier assignment, the controlled tag vocabulary with a propose-then-add workflow, and related-id rules, reading the live contract so values never drift from the server's schema.
* **`corpus-verify` skill** — runs the `build:catalog` gate (schema, id uniqueness, tier/directory double-check, tag and related resolution, dead-name check, per-tier body budgets) and reports errors versus body-budget warnings, with both human-readable and JSON output.

A SessionStart orientation hook points the agent at the shared MCP catalog and search tools at the start of each session.

### Patch Changes

| Dependency              | Type       | Action  | From  | To    |
| ----------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/silk-effects | dependency | updated | 0.5.0 | 0.6.0 |
