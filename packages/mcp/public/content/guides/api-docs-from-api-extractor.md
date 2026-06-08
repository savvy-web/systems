---
id: guides/api-docs-from-api-extractor
title: Generating API docs from API Extractor
summary: Configure apiModel, build the model, and render LLM-lean markdown with api-extractor-llms.
tier: guides
source: hand
tags: [api, build]
priority: 0.5
related: [standards/api-model-pipeline, packages/rslib-builder/overview]
---

## Overview

The Silk Suite generates API-reference docs from Microsoft API Extractor models
rather than hand-authoring them. The pipeline has three stages: emit a model,
render it to markdown, and compile rendered docs into the MCP resource corpus.
This guide walks through each stage as implemented in this repo.

For the policy contract (what is generated, what must not be edited, where docs
land), see `silk://standards/api-model-pipeline`.

## Step 1 — Enable the API model in `rslib.config.ts`

A library package opts in by passing an `apiModel` option to `NodeLibraryBuilder.create()`:

```typescript
import { NodeLibraryBuilder } from "@savvy-web/rslib-builder";

export default NodeLibraryBuilder.create({
  apiModel: {
    tsdoc: {
      tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
    },
  },
});
```

Passing any truthy value for `apiModel` enables model emission. Options under
`apiModel` are forwarded to the API Extractor TSDoc runner. A plain `apiModel: true`
works when no custom tag definitions are needed.

The entry point and package name are derived from the package's `exports` field.
Only public API surfaces are captured; members annotated `@internal` are excluded.

See `silk://packages/rslib-builder/overview` for full builder configuration.

## Step 2 — Build the model

```bash
pnpm --filter @savvy-web/your-package run build:prod
```

The production build writes `dist/npm/<unscoped-name>.api.json`. For example,
`@savvy-web/silk-effects` emits `dist/npm/silk-effects.api.json`. The filename
is the unscoped package name with an `.api.json` suffix.

`dist/dev/` may also contain a model depending on the build configuration.
The generator script probes `dist/dev/` first, then `dist/npm/`.

## Step 3 — Render with `api-extractor-llms`

The rendering library takes a model path, two injectable callbacks, and returns
one `RenderedDoc` per top-level public member.

### Core API

```typescript
import { loadApiModel, renderPackage } from "api-extractor-llms";
import type { FrontmatterRenderer, RouteFormatter } from "api-extractor-llms";

const pkg = await loadApiModel("/path/to/silk-effects.api.json");

const routeFor: RouteFormatter = (ref) =>
  `silk://packages/silk-effects/api/${ref.kind}/${ref.slug}`;

const frontmatter: FrontmatterRenderer = (meta) =>
  `---\nid: packages/silk-effects/api/${meta.kind}/${meta.slug}\ntitle: "${meta.name}"\n---\n\n`;

const docs = renderPackage(pkg, { packageName: "@savvy-web/silk-effects", routeFor, frontmatter });

for (const doc of docs) {
  // doc.markdown = frontmatter block + rendered body
  // doc.kind, doc.name, doc.slug identify the item
}
```

### What `renderPackage` produces

For each top-level public member, the shared body renderer emits:

- An ATX `# Name` heading
- The TypeScript signature in a fenced `ts` code block (via `TypeSignatureFormatter`)
- TSDoc summary paragraph
- `## Parameters` list with types and descriptions (if any)
- `## Returns` section (if documented)
- `## Members` section listing class/interface/namespace members with signatures and summaries
- `## Examples` blocks with language-tagged fences (from `@example` TSDoc tags)
- Cross-links in prose resolved through the injected `routeFor` (via `CrossLinker`)

The two injectable callbacks — `routeFor` (URL scheme) and `frontmatter` (YAML
block) — are the only consumer-specific pieces. The body rendering is shared
across all consumers.

## Step 4 — The MCP generator script

`packages/mcp/scripts/generate-api-docs.ts` is the reference implementation of
steps 3 and 4 for the MCP resource corpus. It iterates `API_TARGETS` (defined in
`packages/mcp/scripts/api-targets.ts`), loads each model, injects silk-specific
frontmatter and `silk://` crosslink routes, and writes output under
`content/packages/<dir>/api/<kind>/<slug>.md` (gitignored).

```typescript
// The silk crosslink scheme
const routeFor = (target: ApiTarget) => (ref: ApiItemRef) =>
  `silk://${target.idPrefix}/api/${ref.kind}/${ref.slug}`;

// The silk frontmatter renderer (derives id, title, summary, tags)
const frontmatter = (meta: DocMeta) => toYaml(frontMatterFor(target, meta));

const docs = renderPackage(pkg, {
  packageName: target.packageName,
  routeFor: routeFor(target),
  frontmatter,
});
```

Current targets (from `api-targets.ts`): `silk-effects`, `templates`,
`github-action-effects`, `github-action-builder`. The MCP package itself and `cli`/`silk`
are excluded (a generate→mcp build dependency would create a Turborepo cycle; cli
and silk are not library APIs).

## Step 5 — Compile into the corpus

After `generate-api-docs.ts` writes the markdown files, `build:catalog` picks them
up along with hand-authored docs and compiles the unified manifest. Generated docs
appear in `silk://catalog` marked `(generated)`.

In Turborepo the pipeline is:

```text
build:prod (each library) → generate-api-docs → build:catalog
```

## Authoring notes

- TSDoc coverage determines output quality. Undocumented public members produce
  sparse rendered docs with no summary or parameter descriptions.
- The slug is the lowercased display name. A class `MyService` maps to
  `silk://packages/foo/api/class/myservice`.
- Cross-links in prose (`{@link OtherClass}`) resolve only if `OtherClass` is in
  the same package's rendered set.
- Do not edit generated files under `content/packages/*/api/` — changes are
  overwritten on the next `generate-api-docs` run.

## See also

- `silk://standards/api-model-pipeline` — policy: what is generated, provenance
  markers, coverage scope
- `silk://packages/rslib-builder/overview` — configuring the builder that emits
  the model
