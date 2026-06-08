---
id: packages/mcp/resource-taxonomy
title: The silk:// resource taxonomy
summary: Load to understand how silk:// docs are addressed, tiered, and discovered.
tier: packages
source: hand
tags: [mcp]
priority: 0.5
related: [packages/silk-effects/]
---

## What

`@savvy-web/mcp` serves a curated documentation corpus over the `silk://` URI
scheme. The load-bearing principle is **information lives in the MCP, direction
lives in the plugins**: the server carries every resource regardless of project,
and each plugin points an agent at the subset it needs. Docs are markdown files
with YAML front-matter under three tiers — `standards`, `packages`, `guides`.

## API

Every doc has a stable `id` — the URI suffix, tier-prefixed and slash-separated.
`silk://<id>` is the address skills hard-code, `related[]` entries point at, and
the catalog and search return. **The `id` is the contract; the URI derives from
`id`, not the file path** — a `git mv` or filename tidy never silently breaks an
inbound link. A directory-index doc uses a trailing-slash id (e.g.
`packages/silk-effects/`) so its URI resolves to `index.md`.

Front-matter carries `id`, `title`, `summary` (the "is this the doc I need" hook),
`tier`, `source` (`hand` | `generated`), `status`, `tags` (a controlled
vocabulary), `priority`, and `related`. The compile step
(`scripts/build-catalog.ts`) fails the build on any integrity violation: `id`
uniqueness, the file living under the directory matching its `tier`, every
`related[]` resolving to a known id, every tag resolving against `tags.json`, the
per-tier body budget, and a dead-name gate against the pre-rename identifiers.

## Layer

The tier rule: a doc's `tier` MUST equal its top-level content directory, and its
`id` MUST start with `<tier>/`. `priority` follows a tier-based rubric —
launch-core ≈ 0.8 (standards), fast-follow ≈ 0.5 (packages, guides), deep reference
≈ 0.3 — so it is real data and doubles as a search tie-break. Each tier ships a
one-screen structure template (standards: Rule / Why / Examples / See also;
package topic: What / API / Layer / Usage / Related).

## Usage

Discovery surfaces, in priority order:

1. `silk://catalog` — token-cheap orientation, grouped by tier, each line a URI +
   `summary` hint; an agent's first read.
2. The `silk_docs_search` tool — the primary path, plain-keyword input.
3. `resources/read` by explicit URI — how skills point precisely.
4. `resources/list` via one `ResourceTemplate` — fallback enumeration, excluding
   `silk://catalog`.

The compiler emits `manifest.json`, the single source the catalog, search, and
`list()` all derive from, so there is no drift. Bodies stay in the markdown files;
the manifest indexes them.

## Related

The library these docs describe: `silk://packages/silk-effects/`.
