# BuildConfig options

Every field is optional; pass any subset to `build({ … })` or `defineBuild({ … })`.

## `BuildConfigInput`

| Option | Type | What it does |
| --- | --- | --- |
| `format` | `("esm" \| "cjs")[]` | Output formats; default ESM-only. Add `"cjs"` for dual-format. |
| `externals` | `string[]` | Packages kept external (not bundled) in **both** JS and `.d.ts`. |
| `bundle` | `string[]` | Force-inline these packages into JS output (inverse of `externals`); does **not** inline their declarations. |
| `bundledPackages` | `string[]` | External packages whose **declarations** are inlined into the bundled `.d.ts`. |
| `dtsExternals` | `string[]` | Packages externalized in the **dts pass only** (kept as `import` in `.d.ts`) while JS still bundles them; for deps whose types can't be safely inlined (e.g. `effect`'s `declare module`). |
| `bundleNodeModules` | `boolean` | Force-bundle all non-external node_modules/workspace JS into a self-contained per-entry file; dts posture tracks JS. Default `false`. |
| `emitDts` | `boolean` | Emit bundled `.d.ts` (dev + prod). Default `true`; `false` = JS-only. |
| `minify` | `boolean` | Minify **prod** output only. Default `false`. |
| `overrides` | `BuildEntryOverride[]` | Per-entry format/bundling/platform partitions — see the sub-table below. |
| `meta` | `MetaOptions \| false` | API-model generation; omit = defaults, object = override, `false` = opt out. See `references/api-extractor.md`. |
| `exe` | `ExeConfig \| ExeConfig[]` | SEA binary spec(s). See `references/sea.md`. |
| `jsx` | `JsxConfig` | JSX runtime override (defaults tsconfig-inferred). |
| `devManifest` | `"preserve" \| "resolve"` | How the **dev** `package.json` handles `catalog:`/`workspace:` specifiers. Default `"preserve"`. |
| `transform` | `(args: { pkg, targetGroup }) => Json` | Final `package.json` mutation; **replaces** the default `defaultManifestTransform` if supplied. |
| `output` | `OutputConfig` | Console/report format — see the sub-table below. |
| `looseFiles` | `LooseFiles` | Standalone bundled files emitted at literal paths, outside the `exports` graph. |
| `define` | `Record<string, string>` | Compile-time global replacements (merged with the auto version define). |
| `plugins` | `Plugin[]` | Custom rolldown plugins forwarded to every tsdown pass. |
| `formats` | `("esm")[]` | Legacy inert field superseded by `format` — do not use. |

## `BuildEntryOverride`

| Field | What it does |
| --- | --- |
| `entries` | Glob/paths this partition applies to. |
| `format` | Per-partition output format override. |
| `bundle` | Per-partition force-inline list. |
| `externals` | Per-partition external list. |
| `bundleNodeModules` | Per-partition bundle-everything toggle. |
| `bundledPackages` | Per-partition declaration-inlining list. |
| `dtsExternals` | Per-partition dts-only external list. |
| `platform` | `"node" \| "browser" \| "neutral"`. |
| `css` | CSS handling forwarded to tsdown's `css` option (JS pass only). |
| `outSubdir` | Build this entry's partition into its own `<outSubdir>/` sub-package directory. |

Overrides let one entry (e.g. a browser runtime) build differently from the rest.

## `OutputConfig`

| Field | Type | What it does |
| --- | --- | --- |
| `console` | `{ human?, agent?, ci? }` (booleans) | Which console renderers run. |
| `format` | `"terminal" \| "json" \| "markdown" \| "ci-annotations" \| "silent"` | Report output format. |
