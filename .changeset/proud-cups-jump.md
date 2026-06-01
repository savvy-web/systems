---
"@savvy-web/mcp": minor
---

## Features

### Ephemeral API-Doc Generation Pipeline

The server now generates per-package API-reference docs at startup from in-monorepo library packages' API Extractor models, via `@savvy-web/api-extractor-llms`. The generated docs occupy the `silk://packages/<pkg>/api/*` tier of the resource tree and are available immediately to agents via `silk_docs_search` and the `silk://{+path}` resource template. Generation is ephemeral — docs are produced on demand during the build phase and are not checked into the repo.

### Body-Content Search

The Fuse index backing `silk_docs_search` now indexes document bodies at low weight (0.03), in addition to title (0.55), tags (0.30), and summary (0.12). Queries that have no strong title or tag match now surface relevant documents based on body content rather than falling through to the priority-ordered fallback.

### Related-Graph See-Also Boost

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

### Structured Query Logging

The server now emits structured stderr log lines for every `silk_docs_search` invocation. Each line records the raw query string, the resolved result count, and whether the response was a fallback (no Fuse match). Logging goes to stderr only, so it does not affect the MCP stdio protocol.

### New Hand-Authored Content (4 Standards + 3 Guides)

Seven new documents are now part of the Silk knowledge corpus and are indexed at launch:

Standards:
- `silk://standards/api-model-pipeline` — API Extractor model pipeline conventions
- `silk://standards/changeset-format` — changeset file format and style rules
- `silk://standards/dependency-conventions` — dependency declaration conventions
- `silk://standards/semver` — SemVer versioning policy for the Silk Suite

Guides:
- `silk://guides/api-docs-from-api-extractor` — generating API docs from API Extractor models
- `silk://guides/building-a-github-action` — building a GitHub Action with Silk tooling
- `silk://guides/choosing-a-builder` — selecting the right rslib builder for a package
