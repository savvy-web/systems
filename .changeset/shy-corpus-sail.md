---
"@savvy-web/mcp": patch
---

## Bug Fixes

- The generated `silk://packages/<pkg>/api/**` reference docs and inflated manifest are now shipped in the published package. Previously they were gitignored and never committed, so every `silk://packages/<pkg>/api/...` read failed with `ENOENT` on a clean release machine and `silk_docs_search` could not surface any API symbol.
- Each documented package now serves an API index page at the bare `silk://packages/<pkg>/api` URI, listing every documented symbol with a link to its page.
- A missing `silk://` resource now returns a clean not-found error referencing the requested URI instead of a raw `ENOENT` that leaked the server's absolute install path.
- `silk_docs_search` now returns an empty result set for a real query that matches nothing, instead of a fallback package listing with `confidence: 0` and `matchedOn: []` that read like real hits. A keyword-free browse (only stop-words) still returns the low-confidence priority listing.
- The bundled documentation corpus no longer describes the defunct `@savvy-web/rslib-builder`; the builder overview, "choosing a builder," and API-model-pipeline docs now cover `@savvy-web/bundler` (the `defineBuild`/`runBuild` front door).
