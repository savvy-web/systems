---
id: standards/api-model-pipeline
title: API Extractor as docs source of truth
summary: How package API surfaces become generated silk://packages/<pkg>/api docs via API Extractor models.
tier: standards
source: hand
tags: [api, build]
priority: 0.5
related: [packages/mcp/resource-taxonomy]
---

## Rule

Package API-reference docs are **generated** from Microsoft API Extractor models,
not hand-written. Do not edit generated docs directly — changes are overwritten on
the next build.

### Pipeline

1. A library package sets `apiModel` in its rslib config.
2. `build:prod` emits `<unscoped>.api.json` (a Microsoft API Extractor model file).
3. The `@savvy-web/api-extractor-llms` library renders that model into LLM-lean
   markdown.
4. The rendered docs appear in the MCP resource layer under
   `silk://packages/<pkg>/api/<kind>/<name>`.
5. The `silk://catalog` lists these entries marked `(generated)`.

Generated docs carry a provenance marker indicating they must not be hand-edited.

### Coverage scope

Only public API surfaces are included. Internal and `@internal`-tagged members are
excluded. Quality tracks TSDoc coverage: undocumented public members degrade the
model and produce sparse rendered output.

## Why

Hand-written API docs drift from code. Generating docs from the type surface and
TSDoc comments keeps them accurate by construction: a renamed export, a removed
parameter, or a new option surfaces automatically in the next build. The API
Extractor model format is the standard Microsoft toolchain for TypeScript API
management, making the pipeline compatible with upstream tooling.

## Examples

A package `@savvy-web/silk-effects` with `apiModel` in its rslib config builds
`silk-effects.api.json`. The renderer produces entries such as:

```text
silk://packages/silk-effects/api/class/SilkPublishability
silk://packages/silk-effects/api/namespace/Changesets
silk://packages/silk-effects/api/class/ChangesetConfig
```

These appear in `silk://catalog` as `(generated)` entries alongside hand-authored
docs.

## See also

The resource taxonomy that governs where generated and hand-authored docs live is at
`silk://packages/mcp/resource-taxonomy`. The `@savvy-web/api-extractor-llms` library
is the renderer; the `@savvy-web/rslib-builder` build tool exposes the `apiModel`
config option.
