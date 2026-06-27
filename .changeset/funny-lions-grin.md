---
"@savvy-web/bundler": minor
---

## Features

### Ambient `.d.ts` exports

`runBuild` now validates types-only hand-authored declaration exports early — on every target path, before any build step runs — and copies each source verbatim into every built package dir (`dist/dev/pkg` on `--target dev`; `dist/prod/<group>/pkg` per prod group on `--target prod`).

New injectable on `RunOptions`:

```ts
/** Injectable ambient-.d.ts copier (defaults to copyAmbientDts from @savvy-web/tsdown-plugins). */
readonly copyAmbientDts?: (o: CopyAmbientDtsOptions) => void;
```

`extractAmbientDts` and `AmbientDtsEntry` are re-exported from `@savvy-web/bundler` for use in a custom `transform` that needs to inspect the ambient entry list without a direct `@savvy-web/tsdown-plugins` import.
