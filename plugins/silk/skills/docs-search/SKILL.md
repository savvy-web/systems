---
name: docs-search
description: >
  Use when querying the Silk Suite documentation corpus through the savvy MCP —
  searching with silk_docs_search, browsing silk://catalog, or deciding which
  docs to load for a Silk convention, package API, or standards question. Covers
  how to phrase a query, scope by tier, and read ranked results.
---

# Querying the Silk docs corpus

The savvy MCP serves the Silk Suite knowledge corpus. Query it well rather than
guessing or grepping source.

## Start at the catalog

Read `silk://catalog` first. It lists every resource grouped by tier with a
short "load when" hint:

- **Standards** — durable Silk development rules (commit/changeset/lint
  conventions, testing, publishability).
- **Packages** — per-package usage and API reference.
- **Guides** — higher-level conceptual articles.

Fetch a resource with its `silk://<id>` URI only once the catalog tells you it
is relevant. Do not assume a path exists.

## Search by keyword

Use `silk_docs_search` for keyword lookup. It returns ranked hits with scores
over titles, summaries, tags, and body content. Prefer it over filesystem grep
for any convention, API, or standards question — it is scoped to curated docs
and ranks by relevance.

Tips:

- Search concepts, not filenames ("changeset dependency table", not
  "config.json").
- If results are dominated by generated API reference pages and you want
  conceptual docs, narrow your query terms. (Tier/`api` include-exclude filters
  are planned — see the project roadmap.)

## When to stop searching

Once the catalog plus one or two searches surface the relevant doc, read it and
proceed. You do not need to enumerate the whole corpus.
