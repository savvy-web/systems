---
"@savvy-web/bundler": minor
---

## Features

### `plugins` option on `defineBuild`

`defineBuild` now accepts a `plugins?: ReadonlyArray<Plugin>` option (the rolldown `Plugin` type, re-exported from `@savvy-web/bundler`). The supplied plugins are forwarded to EVERY tsdown run the build performs — the JS pass, the bundled-dts pass, the per-module declarations pass, and each `looseFiles` pass — so build-time codegen and virtual-module plugins fire across the whole build.

The driver is the pnpm config-dependency flow: a consumer's `looseFiles` pnpmfile can `import` a virtual module that a config plugin serves via `resolveId`/`load`, because the user plugin runs on the `looseFiles` pass where the pnpmfile is bundled.

The rolldown `Plugin` type is also re-exported by name from `@savvy-web/bundler` so consumers do not need a direct dependency on `rolldown` to type their plugins. `rolldown` is now a direct dependency of `@savvy-web/bundler` (previously transitive via `tsdown`) so the `Plugin` type stays an external reference in the emitted declarations and resolves for consumers.

```ts
import { defineBuild, runBuild, type Plugin } from "@savvy-web/bundler";
import { PnpmConfigPlugin } from "pnpm-config-builder";

export default defineBuild({
	plugins: [PnpmConfigPlugin()],
	bundleNodeModules: true,
	looseFiles: {
		"pnpmfile.mjs": "./src/pnpmfile.ts",
		"pnpmfile.cjs": "./src/pnpmfile.ts",
	},
});
```

Forwarding the plugins to each pass needed no change to `@savvy-web/tsdown-plugins` — the per-pass `extraPlugins` plumbing already existed.
