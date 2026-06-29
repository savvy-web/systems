---
"@savvy-web/tsdown-plugins": major
---

## Breaking Changes

### `syncPublicDir` removed; public assets flatten to the package root

`syncPublicDir` has been removed from the public API. Replace it with `copyPublicDir`:

```ts
// Before
import { syncPublicDir } from "@savvy-web/tsdown-plugins";
syncPublicDir(sourceDir, targetDir);

// After
import { copyPublicDir } from "@savvy-web/tsdown-plugins";
copyPublicDir(sourceDir, outDir);
```

`copyPublicDir` flattens `sourceDir` into `outDir` additively — the `public/` directory segment is stripped, so a file at `sourceDir/<rel>` lands at `outDir/<rel>`. A `public/ecma.json` asset therefore publishes at the package root (`<pkg>/ecma.json`) instead of a `public/` subdirectory (`<pkg>/public/ecma.json`).

Behavioral differences from `syncPublicDir`:

- Additive only — never deletes files from `outDir`; a `clean: true` build handles stale-asset pruning.
- Collision guard — if a built output already occupies the destination and its bytes differ, `copyPublicDir` throws `ConfigValidationError` rather than overwriting.
- Timing — runs after all build passes (JS, dts, declarations, looseFiles) rather than after the base JS pass only.
