---
id: packages/tsdown-plugins/api/function/extractambientdts
title: "extractAmbientDts — tsdown-plugins function"
summary: "Extract the types-only `.d.ts` exports from a package's `exports` map. Pure. Throws ConfigValidationError on a mixed export (Decision 2) or an ambient-vs-ambie…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# extractAmbientDts

Extract the types-only `.d.ts` exports from a package's `exports` map. Pure. Throws [ConfigValidationError](silk://packages/tsdown-plugins/api/class/configvalidationerror) on a mixed export (Decision 2) or an ambient-vs-ambient output-name collision.

```ts
function extractAmbientDts(pkg: PackageJsonLike, options?: ExtractAmbientOptions): ReadonlyArray<AmbientDtsEntry>;
```
