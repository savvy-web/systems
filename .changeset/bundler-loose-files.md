---
"@savvy-web/bundler": minor
---

## Features

- A `looseFiles` option on `defineBuild` for emitting standalone, self-contained bundled files at literal output paths outside the exports, declaration, and API-model graph. Keys are literal output filenames; values are a source path or a source-plus-format object. Module format is inferred from a `.mjs` or `.cjs` key and required for an ambiguous `.js` key. Pair with `bundleNodeModules` to make each file fully self-contained. This supports building pnpm config dependencies, which forbid runtime dependencies and resolve their `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root.
