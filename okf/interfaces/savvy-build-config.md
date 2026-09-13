---
type: Interface
title: savvy.build.ts contract
description: "The build() front door and defineBuild/runBuild config surface every package's savvy.build.ts is written against — what a consumer can depend on staying stable across a bundler release."
status: draft
kind: config
resource: ../../packages/bundler/src/config.ts
tags: [build]
sources:
  - id: bundler-arch-doc
    resource: ../../packages/bundler/src/run.ts
  - id: build-options-doc
    resource: ../../packages/bundler/src/config.ts
  - id: tsdown-plugins-arch-doc
    resource: ../../packages/tsdown-plugins/src/build/build-target-groups.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 03893afc6173d5f79383a13271ab7284ccd87d53b67dc21fc4b7028ce42179df
---

# savvy.build.ts contract

## What a package author writes, and what stays stable

A package configures `@savvy-web/bundler` with a self-executing
`savvy.build.ts` calling the `build()` front door:

```ts
import { build } from "@savvy-web/bundler";

await build({
  format: ["esm", "cjs"],
  externals: ["typescript"],
});
```

- **No bin, no boilerplate.** `package.json` scripts run the file
  directly (`"build:dev": "node savvy.build.ts --target dev"`) under
  Node 24's native type-stripping. `build()` derives `cwd` from
  `dirname(process.argv[1])` and `argv` from `process.argv.slice(2)`, so
  the build file itself reads no process metadata.[^bundler-arch-doc]
- **Arg surface:** `--target <dev|prod|meta|exe>` (default `dev`),
  `--watch`, `--no-exe`, `--verbose`. `--target meta` is accepted but is
  a deprecated no-op — meta generation is a function of `--target
  prod`.[^bundler-arch-doc]
- **`build`, `defineBuild`, and `runBuild` are three composable layers, not
  one opaque entry point.** `build(input?, overrides?)` calls
  `runBuild(defineBuild(input), { cwd, argv, ...overrides })`.
  `defineBuild` is pure normalization (fills in defaults like
  `devManifest: "preserve"`, `minify: false`, `emitDts: true`) and never
  runs a build; `runBuild` is the orchestrator. A hand-written escape
  hatch, or a test, calls `defineBuild`/`runBuild` directly — every IO
  dependency `runBuild` needs is an injectable override, so nothing about
  the front door is privileged.[^bundler-arch-doc]
- **Config validation is structural and runs before any build branch.**
  A bad `savvy.build.ts` (a malformed `exe` spec resolving to more than
  one binary, a types-only package with no JS entry, contradictory
  `looseFiles` format/extension, a non-canonical override export path)
  fails fast with a typed `ConfigValidationError` on every target
  path.[^bundler-arch-doc]
- **The build/publish distinction that matters when reading a
  `savvy.build.ts`:** `--target` selects the build *mode* — `prod`
  builds `dist/prod/`. A publish-target *name* (`npm`, `github`, or a
  custom key) is a `publishConfig.targets` key and the
  `dist/prod/<name>/` folder id; it is a manifest concern, not a
  `savvy.build.ts` flag.[^bundler-arch-doc]
- **Every `defineBuild` option is pure wiring onto
  `@savvy-web/tsdown-plugins`' `buildTargetGroups`.** The bundler itself
  does real work in exactly one place: resolving per-entry `overrides`
  into entry partitions before the build runs (each override's `entries`
  list must use canonical `./`-prefixed export paths that are real build
  entries of the package, or `runBuild` throws).[^build-options-doc]
- **The knobs a consumer relies on staying stable:** `format` (dual
  esm+cjs support), the four bundling-posture knobs
  (`bundleNodeModules`, `bundle`, `bundledPackages`, `dtsExternals`),
  `overrides` (with the additive `platform`/`css`/`outSubdir`
  web-runtime fields), `looseFiles` (standalone bundled outputs outside
  the exports/dts/meta graph, driven by pnpm config-dependency
  consumers), `define`/`plugins`, `transform` (defaults to
  `defaultManifestTransform`, replaced wholesale by a custom transform,
  never merged), `minify` (prod-only, defaults off), `emitDts` (default
  `true`; `false` also skips the meta pass, since it has nothing left to
  read), and the ambient `.d.ts` export shape (a bare `.d.ts` string or
  `{ types }`).[^build-options-doc]
- **The bundler's responsibility ends at `dist/{group}/pkg` plus
  `dist/prod/targets.json`.** Registry upload and attestation are the
  release action's job, not this config surface's.[^bundler-arch-doc]
- **Everything the front door does is also an importable helper from
  `@savvy-web/tsdown-plugins`.** A power user's hand-written build
  script composes the same building blocks the front door does — there
  is no second-class path a `savvy.build.ts` author is missing
  out on.[^tsdown-plugins-arch-doc]

## Related

- [modules/bundler.md](../modules/bundler.md) — the module this config
  surface belongs to.
- [modules/tsdown-plugins.md](../modules/tsdown-plugins.md) — the
  package that owns every build behavior this config wires.
- [decisions/bundler-tsdown-plugins-split.md](../decisions/bundler-tsdown-plugins-split.md)
  — why the config surface and the build behavior live in separate
  packages.

[^bundler-arch-doc]: `../../packages/bundler/src/run.ts`
[^build-options-doc]: `../../packages/bundler/src/config.ts`
[^tsdown-plugins-arch-doc]: `../../packages/tsdown-plugins/src/build/build-target-groups.ts`
