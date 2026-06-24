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
  format: ["esm"],
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
    "build:prod": "node savvy.build.ts --target prod"
  }
}
```

```bash
npm run build:prod
# writes dist/prod/npm/pkg — the tarball root, with a resolved manifest and built code
```

`--target dev` writes `dist/dev/pkg`, the local-link target with `catalog:`/`workspace:` specifiers preserved. `--target prod` writes `dist/prod/npm/pkg` with those specifiers resolved to concrete ranges, ready to publish — and emits the API Extractor api-model alongside it. A third target, `--target exe`, compiles SEA binaries and is covered below.

Every build emits per-module JavaScript alongside a single rolled-up, self-contained `.d.ts` per public entry. Each entry's declaration file pulls in every re-exported type, so a consumer that infers a type from your public API never has to reach into a deep sibling module that no export subpath addresses.

## TypeScript config

The bundler ships its shared TypeScript base as a subpath export. Extend it from your package's `tsconfig.json` so source and declaration emit line up with what the bundler expects:

```json
{
 "$schema": "https://json.schemastore.org/tsconfig",
 "extends": ["@savvy-web/bundler/tsconfig/ecma.json"]
}
```

`ecma.json` sets ESNext libs, NodeNext resolution, strict mode and `composite` declaration output. Override any of it in your own `tsconfig.json`.

## Multi-target publishing

By default `--target prod` builds a single group named after the package and writes it to `dist/prod/npm/pkg`. To publish the same package to more than one registry, or under more than one name, declare a `publishConfig.targets` map in `package.json`:

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

Each key is a target. `true` publishes under the package's own name to a well-known registry (`npm`, `github`); a string renames the group for that target; an object form takes `{ registry }` plus either `name` (a rename) or `from` (reuse another target's built bytes). `--target prod` then builds one byte-variant group per distinct name, applies the rename to each group's manifest and writes `dist/prod/<group>/pkg`. It also writes `dist/prod/targets.json`, the group-to-registry binding the release step consumes to know what to publish where.

With no `targets` map the build falls back to the single-`npm` group above.

## API Extractor meta

`savvy build --target prod` generates an [API Extractor](https://api-extractor.com/) api-model from each prod group's resolved `.d.ts`. For every group it writes the bundle (`<unscoped>.api.json`, `tsdoc-metadata.json` and a resolved `tsconfig.json`) into `dist/prod/<group>/meta` as a release asset alongside `pkg/`, and copies the canonical group's bundle into any `localPaths` directories. Because it reads the prod build, the meta `package.json` carries concrete dependency versions rather than `catalog:`/`workspace:` specifiers.

API Extractor's analyzer messages — forgotten exports, missing release tags and TSDoc issues — surface in the build log rather than being dropped. A forgotten export (a type reachable from your public API but not itself exported) fails the build under CI (`CI` or `GITHUB_ACTIONS` set); locally it stays a warning so an incremental build is not blocked. Listing the message in `tsdoc.suppressWarnings` suppresses both the local warning and the CI failure, and the build log accounts for what it suppressed.

The `meta` field on `defineBuild` is tri-state:

- **Omitted** (or `undefined`) — generation runs with default options. This is the default; you do not need a `meta` field for `--target prod` to emit the api-model.
- **An object** — override the defaults: `localPaths` (directories the canonical api-model is copied into), `tsdoc` (warning suppression and custom tags) and `optimistic` (see below).
- **`false`** — opt out entirely; the prod meta asset becomes a no-op.

```ts
const config = defineBuild({
  format: ["esm"],
  meta: {
    // directories the generated api-model is copied into
    localPaths: ["../mcp/models/@savvy-web/bundler"],
    tsdoc: {
      suppressWarnings: [{ messageId: "ae-undocumented" }],
      tagDefinitions: [{ tagName: "@internal", syntaxKind: "modifier" }],
    },
  },
});

// Or opt out of api-model generation altogether:
// const config = defineBuild({ meta: false });
```

`optimistic` (`"auto"`, the default, or a boolean) forward-looks the meta bundle's own `version` and its workspace-sibling dependency versions to their next release version from pending changesets. `"auto"` is off under CI (`CI` or `GITHUB_ACTIONS` set) and on locally, so a locally generated bundle matches what the CI release build would emit. Set it to `true` or `false` to pin the behavior:

```ts
const config = defineBuild({
  meta: { optimistic: false }, // always use the current package.json versions
});
```

`--target meta` is deprecated: it warns and no-ops. Generate the api-model with `--target prod` instead.

## Executable binaries

Set the optional `exe` field to compile a single-executable application (SEA) from a bin entry, via [`@tsdown/exe`](https://www.npmjs.com/package/@tsdown/exe):

```ts
const config = defineBuild({
  format: ["esm"],
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
  format: ["esm"],
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

Dependencies you declare in `package.json` are externalized automatically — they stay `import`ed from the published `.js` and referenced from the `.d.ts`, and the consumer resolves them from their own `node_modules`. You don't list declared deps anywhere; `externals` exists only to externalize a package tsdown would otherwise bundle (a transitive dep you reference but don't declare). Four fields change the bundling posture, for the cases where a dependency cannot be left external:

```ts
const config = defineBuild({
  // force-inline these specific packages into the .js, even ones declared in package.json
  bundle: ["some-declared-dep"],
  // force-bundle every non-externalized node_modules and workspace dep into the output
  bundleNodeModules: true,
  // inline only these packages' types into the bundled .d.ts; the rest stay external
  bundledPackages: ["some-types-only-dep"],
  // externalize these in the declaration pass only — referenced via import in the .d.ts,
  // still bundled in the .js
  dtsExternals: ["effect"],
});
```

- `bundle` inlines the listed packages into the JavaScript output, the inverse of `externals`, even for packages declared in `package.json` that would otherwise be auto-externalized. Declarations are not inlined by this option — pair it with `bundledPackages` to roll a package's types into the `.d.ts` too.
- `bundleNodeModules` inlines node_modules and workspace JavaScript into the output so the published package is self-contained, and inlines their types into the bundled `.d.ts` to match.
- `bundledPackages` inlines only the listed packages' declarations into the `.d.ts` while every other dependency stays external. Use it for a types-only dependency you don't want consumers to install.
- `dtsExternals` keeps a package out of the declaration bundle when its types cannot be safely inlined — effect's cross-module `declare module` augmentations, for one, inline into conflicting interface extensions in consumers. The package is referenced by `import` in the `.d.ts` and still bundled in the JavaScript, so declare it as a package dependency.

## Per-entry overrides

The format and bundling fields above apply to every export entry. Use `overrides` to pin a subset of entries to their own format and bundling, layered onto the base config. The base build stays as configured; only the listed `entries` (by export subpath) get the override:

```ts
const config = defineBuild({
  format: ["esm"], // base entries are ESM-only
  overrides: [
    {
      // this one entry is also require-able, and inlines its node_modules so a
      // CommonJS caller never has to resolve an ESM-only dependency
      entries: ["./changesets/markdownlint"],
      format: ["esm", "cjs"],
      bundleNodeModules: true,
    },
  ],
});
```

Each override carries the same `format`, `bundle`, `externals`, `bundleNodeModules`, `bundledPackages` and `dtsExternals` fields as the base config, plus three partition-only fields: `platform` (the JS-pass target, `"node"` by default or `"browser"` for a client runtime), `css` (forwarded to tsdown's `css` option to enable `@tsdown/css`) and `outSubdir` (builds the partition into an isolated `<group>/pkg/<subdir>/` sub-package, for which exactly one export path may be pinned). An override does not inherit the base `externals` — list what that partition needs. The build errors if an override names an export path the package does not declare. These partition fields are what [`@savvy-web/rspress-builder`](https://www.npmjs.com/package/@savvy-web/rspress-builder) composes to build an RSPress plugin's browser runtime bundle.

## Loose files

Every output above lands at a path the package's `exports` map addresses. Some files have to sit at a fixed name the runtime resolves by convention, outside that graph — a pnpm config dependency, for one, forbids runtime `dependencies` and resolves its `pnpmfile.mjs`/`pnpmfile.cjs` by filename at the package root. Use `looseFiles` to emit a standalone bundled file at a literal output path, with no exports entry, no declaration and no api-model:

```ts
const config = defineBuild({
  bundleNodeModules: true,
  looseFiles: {
    "pnpmfile.mjs": "./src/pnpmfile.ts",
    "pnpmfile.cjs": "./src/pnpmfile.ts",
  },
});
```

Each key is the literal output filename written into the package root; each value is a source path (a bare string) or a `{ source, format }` object. The format is inferred from the key extension — `.mjs` is ESM, `.cjs` is CJS — so the example above bundles the one source into both an ESM and a CJS file from a single config. A `.js` key is format-ambiguous and needs an explicit `format`. Pair `looseFiles` with `bundleNodeModules` so each file is self-contained, since a config dependency cannot resolve runtime `dependencies` of its own.

## Plugins

Pass your own tsdown/rolldown plugins with the `plugins` field. They are forwarded to every tsdown pass the build performs — the JavaScript pass, the bundled-declaration pass, the per-module declarations pass and each `looseFiles` pass — so a plugin's `resolveId`/`load` hooks are available everywhere your source is compiled. The use case is build-time codegen and virtual modules: a plugin can serve a module that exists only at build time, and any of your sources can `import` it.

```ts
import { defineBuild } from "@savvy-web/bundler";
import { PnpmConfigPlugin } from "pnpm-config-builder";

const config = defineBuild({
  plugins: [PnpmConfigPlugin()],
  bundleNodeModules: true,
  looseFiles: {
    "pnpmfile.mjs": "./src/pnpmfile.ts",
    "pnpmfile.cjs": "./src/pnpmfile.ts",
  },
});
```

Because the plugins run on the `looseFiles` pass too, a `pnpmfile` source can `import` a virtual module the plugin resolves — here a config-dependency plugin serves the module the pnpmfile needs, and the pnpmfile lands at the package root as a self-contained bundle. Plugins are a rolldown concept; the supplied plugin objects are passed through to tsdown untouched.

## Minified output

Prod output is not minified by default. This builder targets Node libraries, where readable output matters more than bundle size — minified code degrades stack traces and trips some security scanners. Set `minify` to opt back in:

```ts
const config = defineBuild({
  minify: true, // applies to prod target groups only; dev is never minified
});
```

## Manifest transform

Every build runs a manifest transform after resolving `publishConfig.targets`, to produce the published `package.json`. By default it strips build- and dev-only fields (`devDependencies`, `scripts`, `publishConfig` and the like). Supplying your own `transform` replaces that default — import `defaultManifestTransform` and call it from yours if you still want the stripping:

```ts
import { defaultManifestTransform, defineBuild } from "@savvy-web/bundler";

const config = defineBuild({
  transform: ({ pkg }) => {
    // custom manifest work here
    return defaultManifestTransform({ pkg });
  },
});
```

## Build-time constants

The build injects `process.env.__PACKAGE_VERSION__` as a compile-time constant set to the package's version, so source can read its own version without importing `package.json` at runtime:

```ts
// somewhere in src/
const version = process.env.__PACKAGE_VERSION__;
// the reference is replaced at build time with the package's version as a string literal
```

Add your own compile-time replacements with the `define` field. Values are inserted verbatim, so string literals must be pre-quoted:

```ts
const config = defineBuild({
  define: {
    "process.env.FLAG": JSON.stringify("on"),
  },
});
```

`define` merges with the auto-injected version constant; a key of `process.env.__PACKAGE_VERSION__` in your own `define` wins.

## Features

- **One self-executing config** — `savvy.build.ts` exports a `defineBuild` object for tooling to introspect and runs the build when invoked directly. No factory-notation config file.
- **Build targets** — `dev` for local linking, `prod` for a resolved publishable manifest (which also emits an API Extractor api-model) and `exe` for SEA binaries, on disjoint `dist/dev` and `dist/prod` output paths for clean caching.
- **Bundled declarations** — per-module JavaScript with a single rolled-up `.d.ts` per public entry, so re-exported types stay reachable through your published export subpaths.
- **Shared tsconfig base** — extend `@savvy-web/bundler/ecma.json` for the ESNext/NodeNext/strict settings the build expects.
- **Manifest resolution** — `catalog:` and `workspace:` specifiers are resolved against the workspace for the published target, and preserved for the linked dev target.
- **Multi-target publishing** — a `publishConfig.targets` map publishes one package to several registries or under several names; `--target prod` builds the distinct byte variants and writes a `targets.json` binding for the release step.
- **Executable binaries** — an `exe` config compiles SEA binaries from a bin entry via `@tsdown/exe`, inferring the platform from the package's `os`/`cpu` when targets are omitted.
- **JSX, config-first** — JSX transform is inherited from `tsconfig.json` and overridable via the `jsx` field, feeding both the dts tsconfig and the tsdown transform.
- **Dual-format output** — esm-only by default; set `format` to `["esm", "cjs"]` for a require-able CJS output with default-export interop, `.d.cts` declarations and dual `import`/`require` export conditions.
- **Dependency bundling** — declared dependencies stay external by default; `bundle`, `bundleNodeModules`, `bundledPackages` and `dtsExternals` force-inline specific packages or all node_modules into the output, inline select declarations into the `.d.ts` or hold a package out of the declaration bundle when its types cannot be inlined.
- **Per-entry overrides** — `overrides` pins a subset of export entries to their own format and bundling, so one entry can ship dual-format CJS in an otherwise ESM-only package without changing the rest; partition-only `platform`, `css` and `outSubdir` fields also let an entry build for the browser with CSS modules into its own sub-package.
- **Loose files** — `looseFiles` emits standalone bundled files at literal output paths outside the exports/declaration/api-model graph, with the format inferred from the key extension; pair with `bundleNodeModules` for self-contained pnpm config-dependency pnpmfiles.
- **Custom plugins** — `plugins` forwards your own rolldown plugins to every tsdown pass, including the `looseFiles` pass, so build-time codegen and virtual modules resolve everywhere your source is compiled.
- **Readable prod output** — prod output is unminified by default to keep stack traces legible and pass security scanners; `minify` opts back in.
- **Default manifest stripping** — the published `package.json` drops build- and dev-only fields automatically; a custom `transform` replaces the default and can re-apply it via `defaultManifestTransform`.
- **Build-time constants** — the package version is injected as `process.env.__PACKAGE_VERSION__`, and the `define` field adds your own verbatim compile-time replacements.
- **Fast-fail config validation** — `runBuild` validates the config (`publishConfig.targets`, `exe`, `meta`) before any build work, raising a typed `ConfigValidationError` on the first violation.
- **One devDependency** — `tsdown` is a regular dependency, pinned and tested transitively, so you never carry it or its plugin peers in your own tree.
- **Injectable orchestration** — `runBuild` takes its IO dependencies as options, so the build is testable without spawning a real bundle.
- **Escape hatch** — every build behavior lives in [`@savvy-web/tsdown-plugins`](https://www.npmjs.com/package/@savvy-web/tsdown-plugins); compose the same helpers in a hand-written `tsdown.config.ts` when you outgrow the front door.

## API

- `defineBuild(input)` — normalizes a build config (`externals`, `bundle`, `bundleNodeModules`, `bundledPackages`, `dtsExternals`, `minify`, `devManifest`, `transform`, `output`, `meta`, `jsx`, `exe`, `format`, `overrides`, `looseFiles`, `define`, `plugins`), applying defaults. The `format` field controls the output module formats forwarded to tsdown (esm-only by default; add `"cjs"` for a dual-format esm+cjs build). `minify` defaults to false, `transform` defaults to a manifest stripper, and `overrides` pins a subset of entries to their own format and bundling. Pure; it does not run the build.
- `runBuild(config, options)` — the orchestrator. Parses `--target`/`--watch`/`--verbose` from `options.argv`, reads `package.json` at `options.cwd`, derives entries, drives the build for the selected target and renders a report. `--verbose` expands the report to a per-file table; the report is quiet by default. Every IO dependency on `options` is injectable for tests.
- `parseArgs(argv)` — the argument parser behind `runBuild`, exported for embedding.

## Turbo tasks

`pnpm turbo run build:prod` produces the publishable output and the api-model bundle in one pass, writing the canonical group's api-model into the `localPaths` configured in each package's `savvy.build.ts`. The standalone `build:meta` task is deprecated — its `--target meta` now warns and no-ops.

## License

[MIT](LICENSE)
