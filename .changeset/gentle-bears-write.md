---
"@savvy-web/api-extractor-llms": minor
---

## Features

### Shared API-Extractor-to-Markdown Rendering Library

`@savvy-web/api-extractor-llms` is a new shared library that renders Microsoft API Extractor `.api.json` models into LLM-lean markdown. It is designed for use in documentation pipelines and MCP resource layers where compact, machine-readable API reference output is required.

The rendering pipeline is split into a shared body-rendering core and two injectable services — a `FrontmatterRenderer` and a `RouteFormatter` — so consumers can share the same item rendering logic while controlling how frontmatter blocks and crosslink URLs are generated.

**Model loading and per-item rendering:**

```typescript
import { loadApiModel, renderItem, renderPackage } from "@savvy-web/api-extractor-llms";

const model = await loadApiModel("path/to/my-package.api.json");
const docs = renderPackage(model, {
  packageName: "@my-scope/my-package",
  frontmatter: myFrontmatterRenderer,
  routeFor: myRouteFormatter,
});

// docs is an array of RenderedDoc — one per exported API item
for (const doc of docs) {
  console.log(doc.slug, doc.markdown);
}
```

**TSDoc extraction helpers** — low-level utilities for pulling structured content out of any TSDoc node:

```typescript
import {
  getSummary,
  getParams,
  getReturns,
  getExamples,
  getDeprecation,
  getReleaseTag,
  hasModifierTag,
  extractPlainText,
} from "@savvy-web/api-extractor-llms";
```

**Type-signature formatting and crosslinks:**

```typescript
import { TypeSignatureFormatter, CrossLinker } from "@savvy-web/api-extractor-llms";

const formatter = new TypeSignatureFormatter();
const linker = new CrossLinker(myRefs, myRouteFormatter);
```

**Exported types:** `ApiItemRef`, `DocMeta`, `RouteFormatter`, `FrontmatterRenderer`, `RenderedDoc`, `RenderPackageOptions`, `ItemKindSlug`.
