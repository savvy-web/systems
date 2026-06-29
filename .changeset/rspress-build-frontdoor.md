---
"@savvy-web/rspress-builder": minor
---

## Features

### `build()` front door

`@savvy-web/rspress-builder` now exposes a `build()` front door matching `@savvy-web/bundler`'s. It applies the `definePlugin` preset internally and runs the build, deriving `cwd` from the entry script directory and `argv` from `process.argv`, so an RSPress plugin's `savvy.build.ts` is a single call:

```ts
import { build } from "@savvy-web/rspress-builder";

await build();
```

Options pass straight through to `definePlugin` — `await build({ runtime: false })` builds a plugin with no runtime bundle. `definePlugin` and the re-exported `runBuild` remain available for advanced or escape-hatch use.
