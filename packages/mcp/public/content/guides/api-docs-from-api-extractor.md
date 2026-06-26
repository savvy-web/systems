---
id: guides/api-docs-from-api-extractor
title: Generating API docs from API Extractor
summary: Configure the meta option, build the model, and render LLM-lean markdown with api-extractor-llms.
tier: guides
source: hand
tags: [api, build]
priority: 0.5
related: [standards/api-model-pipeline, packages/bundler/overview]
---

## Overview

The Silk Suite generates API-reference docs from Microsoft API Extractor models
rather than hand-authoring them. The pipeline has three stages: emit a model,
render it to markdown, and compile rendered docs into the MCP resource corpus.
This guide walks through each stage as implemented in this repo.

For the policy contract (what is generated, what must not be edited, where docs
land), see `silk://standards/api-model-pipeline`.

## Step 1 — Emit the API model from the build

A library built by `@savvy-web/bundler` emits an API Extractor model on its
production build by default — there is nothing to enable. The model is controlled
by the `meta` option in `savvy.build.ts`:

```typescript
import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
  // meta omitted → API model is generated with default options on --target prod.
  // Pass an object only to override defaults, e.g. to register custom TSDoc tags:
  meta: {
    tsdoc: {
      tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
    },
  },
});

export default config;

if (import.meta.main) {
  await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
```

Omitting `meta` generates the model with defaults; pass `false` to opt out
entirely (the MCP server itself does this — it is an executable host, not a
documented API). The entry point and package name are derived from `exports`.
Only public surfaces are captured; members annotated `@internal` are excluded.

See `silk://packages/bundler/overview` for the full builder surface.

## Step 2 — Build the model

```bash
pnpm --filter @savvy-web/your-package run build:prod
```

The production build writes `dist/prod/npm/meta/<unscoped-name>.api.json` and
stages a copy into each consumer declared in `meta.localPaths` — for the MCP
corpus that is `packages/mcp/lib/models/<dir>/<unscoped-name>.api.json`. For
example, `@savvy-web/silk-effects` emits `silk-effects.api.json`. The generator
reads the staged copy under `lib/models/`, so its inputs stay inside the mcp
package and Turborepo can cache it.

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

`packages/mcp/lib/scripts/generate-api-docs.ts` is the reference implementation of
steps 3 and 4 for the MCP resource corpus. It iterates `API_TARGETS` (defined in
`packages/mcp/lib/scripts/api-targets.ts`), loads each model, injects silk-specific
frontmatter and `silk://` crosslink routes, writes one page per symbol under
`public/content/packages/<dir>/api/<kind>/<slug>.md`, and writes a per-package
index page at `public/content/packages/<dir>/api.md` (served at the bare
`silk://packages/<dir>/api` URI).

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
`github-action-effects`, `github-action-builder`, `bundler`, `tsdown-plugins`,
`rspress-builder`. The MCP package itself and `cli`/`silk` are excluded (a
generate→mcp build dependency would create a Turborepo cycle; cli and silk are
not library APIs).

## Step 5 — Compile into the corpus

After `generate-api-docs.ts` writes the markdown files, `build:catalog` picks them
up along with hand-authored docs and compiles the unified manifest. Generated docs
appear in `silk://catalog` marked `(generated)`. The rendered markdown and the
inflated manifest are committed tracked source — only the raw `.api.json` models
under `lib/models/` are gitignored — so the published package ships the corpus
even though a release machine does not regenerate it.

In Turborepo the pipeline is:

```text
build:prod (each library) → generate-api-docs → build:catalog → mcp build:prod
```

## Authoring notes

- TSDoc coverage determines output quality. Undocumented public members produce
  sparse rendered docs with no summary or parameter descriptions.
- The slug is the lowercased display name. A class `MyService` maps to
  `silk://packages/foo/api/class/myservice`.
- Cross-links in prose (`{@link OtherClass}`) resolve only if `OtherClass` is in
  the same package's rendered set.
- Do not hand-edit files under `public/content/packages/*/api/` (or the `api.md`
  index) — they are overwritten on the next `generate-api-docs` run; change the
  source TSDoc instead.

## See also

- `silk://standards/api-model-pipeline` — policy: what is generated, provenance
  markers, coverage scope
- `silk://packages/bundler/overview` — configuring the builder that emits the model
