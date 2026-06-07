# @savvy-web/bundler

[![npm](https://img.shields.io/npm/v/@savvy-web%2Fbundler?label=npm&color=cb3837)](https://www.npmjs.com/package/@savvy-web/bundler)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)

The zero-config bundler for [Silk Suite](https://github.com/savvy-web/systems) TypeScript packages. Configure a package with a single self-executing `savvy.build.ts`, run it against the `dev` or `npm` target and get a clean, publishable `dist/<target>/pkg`. Install one devDependency; `tsdown` is pinned and tested transitively, so a toolchain upgrade is a bundler release rather than a peer bump across your repos.

## Install

```bash
npm install --save-dev @savvy-web/bundler
# or
pnpm add -D @savvy-web/bundler
```

## Quick start

Add a `savvy.build.ts` to the package root. It both exports a config object and runs the build when invoked directly:

```ts
// savvy.build.ts
import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
  formats: ["esm"],
  externals: ["typescript"],
  devManifest: "preserve",
});

export default config;

if (import.meta.main) {
  await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
```

Wire the two targets into `package.json` scripts and run them with Node's native TypeScript support (Node 24.11+):

```json
{
  "scripts": {
    "build:dev": "node savvy.build.ts --target dev",
    "build:prod": "node savvy.build.ts --target npm"
  }
}
```

```bash
npm run build:prod
# writes dist/prod/npm/pkg — the tarball root, with a resolved manifest and built code
```

`--target dev` writes `dist/dev/pkg`, the local-link target with `catalog:`/`workspace:` specifiers preserved. `--target npm` writes `dist/prod/npm/pkg` with those specifiers resolved to concrete ranges, ready to publish. Two further targets, `--target meta` and `--target exe`, are covered below.

Every build emits per-module JavaScript alongside a single rolled-up, self-contained `.d.ts` per public entry. Each entry's declaration file pulls in every re-exported type, so a consumer that infers a type from your public API never has to reach into a deep sibling module that no export subpath addresses.

## TypeScript config

The bundler ships its shared TypeScript base as a subpath export. Extend it from your package's `tsconfig.json` so source and declaration emit line up with what the bundler expects:

```json
{
  "extends": ["@savvy-web/bundler/ecma.json"]
}
```

`ecma.json` sets ESNext libs, NodeNext resolution, strict mode and `composite` declaration output. Override any of it in your own `tsconfig.json`.

## Multi-target publishing

By default `--target npm` builds a single group named after the package and writes it to `dist/prod/npm/pkg`. To publish the same package to more than one registry, or under more than one name, declare a `publishConfig.targets` map in `package.json`:

```json
{
  "publishConfig": {
    "targets": {
      "npm": true,
      "github": "@scope/internal-name",
      "mirror": { "registry": "https://registry.example.com", "from": "npm" }
    }
  }
}
```

Each key is a target. `true` publishes under the package's own name to a well-known registry (`npm`, `github`); a string renames the group for that target; an object form takes `{ registry }` plus either `name` (a rename) or `from` (reuse another target's built bytes). `--target npm` then builds one byte-variant group per distinct name, applies the rename to each group's manifest and writes `dist/prod/<group>/pkg`. It also writes `dist/prod/targets.json`, the group-to-registry binding the release step consumes to know what to publish where.

With no `targets` map the build falls back to the single-`npm` group above.

## API Extractor meta

Set the optional `meta` field on `defineBuild` to generate an [API Extractor](https://api-extractor.com/) api-model from a package's type declarations:

```ts
const config = defineBuild({
  formats: ["esm"],
  meta: {
    // directories the generated api-model is copied into on `--target meta`
    localPaths: ["../mcp/models/@savvy-web/bundler"],
    tsdoc: {
      suppressWarnings: [{ messageId: "ae-undocumented" }],
      tagDefinitions: [{ tagName: "@internal", syntaxKind: "modifier" }],
    },
  },
});
```

With `meta` set, two behaviors come online:

- `savvy build --target meta` runs API Extractor over the dev build's `.d.ts` — no tsdown build, so it depends only on a prior `--target dev`. It writes the api-model (`<unscoped>.api.json`, `tsdoc-metadata.json` and a resolved `tsconfig.json`) into each `localPaths` directory.
- `savvy build --target npm` additionally emits the same bundle into `dist/prod/npm/meta` as a release asset alongside `pkg/`.

`meta` is optional; omit it and neither behavior runs. `--target meta` errors if the config has no `meta` field.

## Executable binaries

Set the optional `exe` field to compile a single-executable application (SEA) from a bin entry, via [`@tsdown/exe`](https://www.npmjs.com/package/@tsdown/exe):

```ts
const config = defineBuild({
  formats: ["esm"],
  exe: {
    fileName: "savvy",
    entry: "./src/bin.ts",
    // targets default to the package's own os/cpu when omitted
    targets: [{ platform: "linux", arch: "x64" }],
  },
});
```

`savvy build --target exe` compiles each declared binary into `dist/dev/pkg/bin`. Pass an array to `exe` to compile several. When `targets` is omitted the platform is inferred from the package's `os`/`cpu` fields. `--target exe` errors if the config has no `exe` field.

## JSX

Packages that emit JSX inherit their transform from `tsconfig.json` (`compilerOptions.jsx`/`jsxImportSource`) with no extra config. Set the optional `jsx` field on `defineBuild` to override it:

```ts
const config = defineBuild({
  formats: ["esm"],
  jsx: { runtime: "automatic", importSource: "preact" },
});
```

The resolved JSX settings feed both the dts tsconfig and the tsdown transform. Omit `jsx` to inherit the tsconfig value.

## Dual-format output

Builds are esm-only by default. Set the `format` field to add a CommonJS output alongside the ESM one:

```ts
const config = defineBuild({
  format: ["esm", "cjs"],
});
```

A dual-format build emits an ESM `.js` and a require-able CJS `.cjs` plus matching `.d.ts` and `.d.cts` declarations, and writes a manifest carrying both `import` and `require` export conditions. The CJS output uses default-export interop — `module.exports` is the module's default export, so a `require()` of the package yields that value directly. Omit `format`, or pass `["esm"]`, for an ESM-only build.

## Bundling dependencies

By default a build leaves your dependencies external — they stay `import`ed from the published `.js` and referenced from the `.d.ts`, and the consumer resolves them from their own `node_modules`. Three fields change that, for the cases where a dependency cannot be left external:

```ts
const config = defineBuild({
  // force-bundle every non-externalized node_modules and workspace dep into the output
  bundleNodeModules: true,
  // inline only these packages' types into the bundled .d.ts; the rest stay external
  bundledPackages: ["some-types-only-dep"],
  // externalize these in the declaration pass only — referenced via import in the .d.ts,
  // still bundled in the .js
  dtsExternals: ["effect"],
});
```

- `bundleNodeModules` inlines node_modules and workspace JavaScript into the output so the published package is self-contained, and inlines their types into the bundled `.d.ts` to match.
- `bundledPackages` inlines only the listed packages' declarations into the `.d.ts` while every other dependency stays external. Use it for a types-only dependency you don't want consumers to install.
- `dtsExternals` keeps a package out of the declaration bundle when its types cannot be safely inlined — effect's cross-module `declare module` augmentations, for one, inline into conflicting interface extensions in consumers. The package is referenced by `import` in the `.d.ts` and still bundled in the JavaScript, so declare it as a package dependency.

## Features

- **One self-executing config** — `savvy.build.ts` exports a `defineBuild` object for tooling to introspect and runs the build when invoked directly. No factory-notation config file.
- **Four build targets** — `dev` for local linking, `npm` for a resolved publishable manifest, `meta` for an API Extractor api-model and `exe` for SEA binaries, on disjoint `dist/dev` and `dist/prod` output paths for clean caching.
- **Bundled declarations** — per-module JavaScript with a single rolled-up `.d.ts` per public entry, so re-exported types stay reachable through your published export subpaths.
- **Shared tsconfig base** — extend `@savvy-web/bundler/ecma.json` for the ESNext/NodeNext/strict settings the build expects.
- **Manifest resolution** — `catalog:` and `workspace:` specifiers are resolved against the workspace for the published target, and preserved for the linked dev target.
- **Multi-target publishing** — a `publishConfig.targets` map publishes one package to several registries or under several names; `--target npm` builds the distinct byte variants and writes a `targets.json` binding for the release step.
- **Executable binaries** — an `exe` config compiles SEA binaries from a bin entry via `@tsdown/exe`, inferring the platform from the package's `os`/`cpu` when targets are omitted.
- **JSX, config-first** — JSX transform is inherited from `tsconfig.json` and overridable via the `jsx` field, feeding both the dts tsconfig and the tsdown transform.
- **Dual-format output** — esm-only by default; set `format` to `["esm", "cjs"]` for a require-able CJS output with default-export interop, `.d.cts` declarations and dual `import`/`require` export conditions.
- **Dependency bundling** — dependencies stay external by default; `bundleNodeModules`, `bundledPackages` and `dtsExternals` force-bundle node_modules into the output, inline select declarations into the `.d.ts` or hold a package out of the declaration bundle when its types cannot be inlined.
- **Fast-fail config validation** — `runBuild` validates the config (`publishConfig.targets`, `exe`, `meta`) before any build work, raising a typed `ConfigValidationError` on the first violation.
- **One devDependency** — `tsdown` is a regular dependency, pinned and tested transitively, so you never carry it or its plugin peers in your own tree.
- **Injectable orchestration** — `runBuild` takes its IO dependencies as options, so the build is testable without spawning a real bundle.
- **Escape hatch** — every build behavior lives in [`@savvy-web/tsdown-plugins`](https://www.npmjs.com/package/@savvy-web/tsdown-plugins); compose the same helpers in a hand-written `tsdown.config.ts` when you outgrow the front door.

## API

- `defineBuild(input)` — normalizes a build config (`externals`, `bundleNodeModules`, `bundledPackages`, `dtsExternals`, `devManifest`, `transform`, `output`, `meta`, `jsx`, `exe`, `format`), applying defaults. The `format` field controls the output module formats forwarded to tsdown (esm-only by default; add `"cjs"` for a dual-format esm+cjs build). Pure; it does not run the build.
- `runBuild(config, options)` — the orchestrator. Parses `--target`/`--watch` from `options.argv`, reads `package.json` at `options.cwd`, derives entries, drives the build for the selected target and renders a report. Every IO dependency on `options` is injectable for tests.
- `parseArgs(argv)` — the argument parser behind `runBuild`, exported for embedding.

## Turbo tasks

`pnpm turbo run build:meta` regenerates api-models into the `localPaths` configured in each package's `savvy.build.ts`, reading the dev build's `dist/dev/pkg` dts; it depends on `build:dev` and is intentionally uncached because it writes outside the package's own cache scope.

## License

[MIT](LICENSE)
