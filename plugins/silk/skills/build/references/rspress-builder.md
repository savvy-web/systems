# RSPress plugin builds

`@savvy-web/rspress-builder` is a thin preset over `@savvy-web/bundler` for building RSPress plugins that ship a Node plugin entry plus an optional browser runtime.

## Front-door example

```ts
import { build } from "@savvy-web/rspress-builder";

await build({ apiModel: { localPaths: ["../../website/lib/models/my-plugin"] } });
```

`definePlugin(options)` returns a standard `BuildConfig` if you need the escape hatch (`runBuild` is re-exported).

## `RspressPluginOptions`

| Option | What it does |
| --- | --- |
| `plugin` | `{ externals }` — the Node plugin entry `.`; externalizes `@rspress/core`. |
| `runtime` | `boolean \| { externals }` — the isolated browser `./runtime` entry: bundleless, CSS-module, React, externalizes react, react/jsx-runtime, react/jsx-dev-runtime, `@theme`, `@rspress/core`. |
| `dtsBundledPackages` | Forwarded to the bundler's `bundledPackages`. |
| `apiModel` | Forwarded to the bundler's `meta` (defaults to on — the meta pass runs by default). |
| `transform` | Final `package.json` mutation; defaults to the bundler's `defaultManifestTransform`. |
| `jsx` | JSX runtime override; defaults to tsconfig-inferred. |
| `define` | Compile-time global replacements, forwarded to every partition. |

`runtime` defaults to `true` (the runtime bundle is built) and does **not** auto-detect the filesystem — pass `runtime: false` explicitly for a plugin with no `./runtime` entry.

## Peer contract

The consumer must provide these peer dependencies: `@rspress/core`, `react`, `react-dom`, `@tsdown/css`.
