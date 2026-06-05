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

`--target dev` writes `dist/dev/pkg`, the local-link target with `catalog:`/`workspace:` specifiers preserved. `--target npm` writes `dist/prod/npm/pkg` with those specifiers resolved to concrete ranges, ready to publish.

## Features

- **One self-executing config** — `savvy.build.ts` exports a `defineBuild` object for tooling to introspect and runs the build when invoked directly. No factory-notation config file.
- **Two build targets** — a `dev` target for local linking and an `npm` target with a resolved, publishable manifest, on disjoint `dist/dev` and `dist/prod` output paths for clean caching.
- **Manifest resolution** — `catalog:` and `workspace:` specifiers are resolved against the workspace for the published target, and preserved for the linked dev target.
- **One devDependency** — `tsdown` is a regular dependency, pinned and tested transitively, so you never carry it or its plugin peers in your own tree.
- **Injectable orchestration** — `runBuild` takes its IO dependencies as options, so the build is testable without spawning a real bundle.
- **Escape hatch** — every build behavior lives in [`@savvy-web/tsdown-plugins`](https://www.npmjs.com/package/@savvy-web/tsdown-plugins); compose the same helpers in a hand-written `tsdown.config.ts` when you outgrow the front door.

## API

- `defineBuild(input)` — normalizes a build config (`formats`, `externals`, `devManifest`, `transform`, `output`), applying defaults. Pure; it does not run the build.
- `runBuild(config, options)` — the orchestrator. Parses `--target`/`--watch` from `options.argv`, reads `package.json` at `options.cwd`, derives entries, drives the build for the selected target and renders a report. Every IO dependency on `options` is injectable for tests.
- `parseArgs(argv)` — the argument parser behind `runBuild`, exported for embedding.

## License

[MIT](LICENSE)
