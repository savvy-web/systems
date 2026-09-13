---
type: Module
title: rspress-builder
description: Thin bundler sibling that builds RSPress plugin packages as a dual-bundle (node plugin + browser runtime) preset over @savvy-web/bundler.
kind: package
resource: ../../packages/rspress-builder
status: draft
tags: [build]
sources:
  - id: arch
    resource: ../../packages/rspress-builder/src/index.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 4251c418ce964f98a8c21c4afb8303c7c7604d5e30652953f35e130286fcd0de
---

# rspress-builder

## Boundary

`@savvy-web/rspress-builder` (`packages/rspress-builder`) owns no build logic of its own. `definePlugin(options?)` assembles a standard `BuildConfig` (the [bundler](bundler.md)'s `defineBuild` shape) with the RSPress runtime baked in as a `BuildEntryOverride` partition; `build(options?, overrides?)` applies `definePlugin` and calls the bundler's `runBuild`.[^arch] `src/index.ts` is the whole public surface and is authoritative for the option types (`RspressPluginOptions`, `RspressBundleOptions`) and their defaults.[^arch] The package self-hosts via its own `savvy.build.ts` through the bundler's front-door `build()`.[^arch] The reference consumer, `spencerbeggs/rspress-plugin-api-extractor`, is outside this repo.[^arch]

## Owner

Sibling of [bundler](bundler.md) and [tsdown-plugins](tsdown-plugins.md): the shared machinery (override-partition loop, two-pass build, meta pipeline, targets derivation) lives there; this package only presets rspress-specific knobs.[^arch]

## The dual-bundle model

An RSPress plugin package is a dual-bundle the general-purpose Node-library bundler does not express:[^arch]

- **Plugin entry (`.`)** — Node target, bundled JS, bundled `.d.ts`; `@rspress/core` stays external.
- **Runtime entry (`./runtime`)** — browser target, bundleless per-file JS with CSS modules, React externalized, `import.meta.env` preserved, emitted into an isolated `runtime/` subdir.

`definePlugin` expresses the runtime as a single override partition for the `./runtime` export using the web-runtime override fields (`outSubdir: "runtime"`, `platform: "browser"`, a `css` block with camelCase-only CSS modules and `inject: true`) plus runtime externals.[^arch] CSS auto-load rides `inject: true`: tsdown's default CSS-module output exports the locals map but does not re-import the emitted `.css`, so a consumer importing a runtime component would otherwise get no styles.[^arch]

**The runtime is an isolated subdir, not a shared-outDir partition**, because a partition sharing the base `pkg/` outDir is unsafe two ways: any module reachable by both the plugin and the runtime would emit to the same path under the two-pass `clean: false` layering, silently overwriting the node build with browser output, and the runtime barrel's output path is computed from its import graph so the `./runtime` manifest target could silently move.[^arch] `outSubdir: "runtime"` removes both — both passes emit into `<group>/pkg/runtime/` with a single barrel named `index`, so `./runtime` maps to `./runtime/index.js` deterministically.[^arch]

**Dependency posture resolves per bundle, with per-bundle tuning winning over the build-wide value.** The bundler's partitions do NOT inherit from the base build, so `definePlugin` threads `runtimeTuning.<field> ?? options.<field>` onto the runtime override explicitly for `bundledPackages`, `dtsExternals` and `bundleNodeModules`; only `externals` is additive across both bundles.[^arch]

## Boundaries and invariants

- **The builder owns no build behavior.** Every behavior is a bundler/tsdown-plugins helper; `build()` is a thin wrapper.[^arch]
- **`runtime` is explicit, not filesystem-detected.** A plugin with no runtime must pass `runtime: false`.[^arch]
- **The React/RSPress contract is peer-only; the CSS one is not.** `@rspress/core`, `react`, `react-dom` are peers of this package and never reach the core bundler. `@tsdown/css` is a regular dependency here, lazily loaded by tsdown only when a CSS file is encountered.[^arch]
- **The shipped `./tsconfig/plugin.json` preset uses no `extends` at all** — fully inlined, since TypeScript `extends` replaces array-valued options (`types`/`lib`) rather than merging them, and a chain of presets compounds that risk. `./tsconfig/ecma.json` is a byte-identical copy of the bundler's canonical preset, guarded by `packages/rspress-builder/__test__/ecma-sync.test.ts`.[^arch]
- **The runtime's API model is enabled**, not disabled: the plugin (`.`) entry contributes the plugin-factory/options model and `./runtime` contributes the component/prop-type model, merging into one `.api.json`.[^arch]
- **No sass.** lightningcss-backed `@tsdown/css` is sufficient for the reference consumer; sass is a non-goal until a real consumer needs it.[^arch]

[^arch]: `../../packages/rspress-builder/src/index.ts`
