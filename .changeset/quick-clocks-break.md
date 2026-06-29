---
"@savvy-web/bundler": major
---

## Breaking Changes

### Public asset output flattens to the package root

Packages built with `@savvy-web/bundler` that have a `public/` directory now see their assets copied directly to the package root in the built output — the `public/` directory segment is dropped. An asset at `public/ecma.json` previously landed at `dist/dev/pkg/public/ecma.json`; it now lands at `dist/dev/pkg/ecma.json`.

Update your `package.json` `exports` values to reflect the new paths:

```json
{
  "exports": {
    "./ecma.json": "./ecma.json"
  }
}
```

Previously:

```json
{
  "exports": {
    "./ecma.json": "./public/ecma.json"
  }
}
```

## Features

### `build()` front door

`build(input?, overrides?)` is the new canonical form for `savvy.build.ts` files. It combines `defineBuild` and `runBuild` in a single call, deriving `cwd` from the entry script directory (`process.argv[1]`) and `argv` from `process.argv.slice(2)` — the faithful equivalent of `import.meta.dirname` without requiring ESM module metadata.

```ts
import { build } from "@savvy-web/bundler";

await build({ /* BuildConfigInput options */ });
```

`defineBuild` and `runBuild` remain exported. The second argument of `build()` accepts `Partial<RunOptions>` for injectables useful in tests or custom IO.
