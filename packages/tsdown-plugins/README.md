# @savvy-web/tsdown-plugins

[![npm](https://img.shields.io/npm/v/@savvy-web%2Ftsdown-plugins?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/tsdown-plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The plugin pack behind [`@savvy-web/bundler`](https://www.npmjs.com/package/@savvy-web/bundler). It holds every build behavior the bundler drives — entry detection, manifest emission and catalog resolution, the dts tsconfig port, the per-target build loop and the build-output reporter — as composable helpers and one [rolldown](https://rolldown.rs/) plugin. It is authored against rolldown's plugin _type_ only, so it imports no `tsdown` runtime and declares no `tsdown` peer dependency: bring your own `tsdown`.

Most packages should use `@savvy-web/bundler` directly. Reach for this package when you have outgrown the bundler's front door and want to compose the same building blocks in a hand-written `tsdown.config.ts`.

## Install

```bash
npm install --save-dev @savvy-web/tsdown-plugins tsdown
# or
pnpm add -D @savvy-web/tsdown-plugins tsdown
```

`tsdown` is a peer of your own choosing — the plugin pack never pins it.

## Quick start

Compose the helpers in a `tsdown.config.ts` to reproduce the bundler's front door yourself:

```ts
// tsdown.config.ts
import { packageJsonEntries, emitManifest } from "@savvy-web/tsdown-plugins";
import { defineConfig } from "tsdown";

const sourceDir = process.cwd();

export default defineConfig({
  entry: packageJsonEntries({ cwd: sourceDir }),
  // emitManifest writes a transformed, catalog-resolved package.json into the output pkg/
  plugins: [emitManifest({ sourceDir, targetGroup: { id: "npm", isProd: true } })],
});
```

`packageJsonEntries` reads a package's `exports` and `bin` and returns the `Record<name, path>` that `tsdown` accepts as `entry`. `emitManifest` reads the `package.json` under `sourceDir`, writes the transformed manifest and copies `LICENSE`/`README.md` into the output folder.

## Features

- **Entry detection** — `packageJsonEntries` and `extractEntries` derive build entries from a package's `exports` and `bin`, matching the rules used across the Silk Suite builders.
- **Manifest transforms** — `transformManifest`, `transformExports`, `transformBin` and `normalizeBinPaths` rewrite a source `package.json` into a publishable one; `emitManifest` is the rolldown plugin that writes it.
- **Catalog resolution** — `resolveManifest` resolves `catalog:` and `workspace:` specifiers against the workspace, delegating to `workspaces-effect`'s `CatalogResolver`.
- **Multi-target resolution** — `resolveTargets` turns a `publishConfig.targets` map into the distinct byte-variant groups to build and the registry bindings for each; `writeTargetsBinding` persists that resolution as `dist/prod/targets.json` for the release step.
- **dts tsconfig port** — `buildResolvedTsconfig` and `writeResolvedTsconfig` write a temp tsconfig with absolute paths so type declarations emit cleanly under pnpm symlinks.
- **Per-target build loop** — `deriveTargetGroupOptions` and `buildTargetGroups` map a target to its `tsdown` options and run the build once per target, exposed as a helper so the escape hatch gets multi-target builds too.
- **API Extractor meta** — `generateMeta` runs [API Extractor](https://api-extractor.com/) over a package's emitted `.d.ts` to write an api-model bundle (`.api.json`, `tsdoc-metadata.json`, resolved `tsconfig.json`); `normalizeMetaOptions` fills the `MetaOptions` defaults that drive it.
- **Output reporter** — `renderReport` plus the `BuildReport` schema and a set of formatters (terminal, JSON, markdown, CI annotations, silent) render a build report for humans, agents or CI.

## Effect

The package is implemented in [Effect](https://effect.website/), but Effect runs behind the plugin boundary: the catalog wrapper returns a `Promise` and the reporter is rendered with `Effect.runPromise` at the call site. The plugin and helper values you compose are plain rolldown-conformant objects. `effect` is a peer dependency.

## License

[MIT](LICENSE)
