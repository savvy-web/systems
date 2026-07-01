---
"@savvy-web/bundler": minor
---

## Features

Added an `emitDts` option to the build front door (`build()` / `defineBuild`), default `true`. Set it to `false` to skip declaration generation on prod builds:

```ts
export default defineBuild({
	emitDts: false
});
```

* Skips the self-contained `.d.ts` generation pass (loads the TypeScript compiler, ~13s per build) and the downstream API-Extractor meta pass
* JS output, byte-variant target folders, catalog/`workspace:` resolution, and the transformed `package.json` are still emitted as usual
* The emitted `package.json` exports omit their `types` conditions when dts is skipped, so they never point at nonexistent declarations; hand-authored ambient `.d.ts` exports are unaffected
* Backward compatible — omitting the option preserves current behavior byte-for-byte
* Intended for JS-only artifacts that never consume declarations (e2e fixture harnesses, bins, internal tools); cuts this repo's e2e suite from ~90s to ~20s

See #198.
