---
"@savvy-web/tsdown-plugins": minor
---

## Features

### Ambient `.d.ts` exports

A package can now declare a types-only `exports` entry whose source is a hand-authored declaration file — either a bare `.d.ts` string or an object with a `types` key pointing at a `.d.ts` — and the build handles everything automatically. No custom `transform` and no post-build step required.

Both forms are accepted in `package.json`:

```json
{
  "exports": {
    "./virtual": "./src/virtual.d.ts",
    "./types": { "types": "./src/types.d.ts" }
  }
}
```

The published manifest is rewritten so each key maps to a dist path derived from the export key:

```json
{
  "exports": {
    "./virtual": { "types": "./virtual.d.ts" },
    "./types":   { "types": "./types.d.ts" }
  }
}
```

The source file is copied verbatim into every built target dir (`dist/dev/pkg` for `--target dev`; `dist/prod/<group>/pkg` for each prod group).

**Constraints** — each a `ConfigValidationError` that fails the build immediately:

- The source must be self-contained. A relative `import`, `export … from`, `import("…")` type node, or `/// <reference path="…" />` is rejected with the offending specifier(s) listed.
- A mixed export — a hand-authored `types` `.d.ts` alongside a compilable runtime `import`/`require`/`default` entry — throws. The bundler generates types from runtime sources; only types-only entries may be hand-authored.
- An output name colliding with another ambient entry or with a JS build entry throws.

**Compatibility:** Existing exports whose _key_ is itself a `.d.ts` path (the RSPress public-asset pattern, e.g. `"./rspress-env.d.ts": …`) are untouched — only entries whose _value_ is a declaration path are classified as ambient.

New exports:

- `extractAmbientDts(pkg, options?)` — extract all types-only `.d.ts` exports from a package's `exports` map; throws `ConfigValidationError` on mixed exports or output-name collisions.
- `classifyDtsExport(value)` — classify a single export value as `"ambient"`, `"mixed"`, or `"none"`.
- `ambientOutName(exportKey, source, exportsAsIndexes?)` — derive the output basename from an export key, preserving the source's declaration extension.
- `declarationExt(path)` — return `.d.ts`, `.d.cts`, or `.d.mts` if the path is a declaration file, otherwise `undefined`.
- `assertNoEntryCollisions(jsEntryNames, ambient)` — throw if any ambient output name (extension-stripped) collides with a JS build entry.
- `mixedDtsExportError(exportKey)` — construct the shared `ConfigValidationError` for a mixed export.
- `findRelativeSpecifiers(source, fileName?)` — parse a declaration source and return every relative `import`/`export`/reference specifier; pure, no I/O.
- `copyAmbientDts(options)` — copy each resolved ambient source verbatim into `outDir/<outName>`, byte-stable (unchanged files keep their timestamp).
- Types: `AmbientDtsEntry`, `DtsExportClass`, `ExtractAmbientOptions`, `CopyAmbientDtsOptions`.
