# @savvy-web/rspress-builder

## 1.1.12

### Maintenance

* Removed a stale Biome suppression comment from the `./env` ambient declarations (`env.d.ts`) that no longer suppressed anything [#477][#477]

### Patch Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#477]: https://github.com/savvy-web/systems/pull/477

## 1.1.11

### Dependencies

| Dependency         | Type       | Action  | From   | To     |
| ------------------ | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler | dependency | updated | 2.1.10 | 2.1.11 |

## 1.1.10

### Dependencies

| Dependency         | Type       | Action  | From  | To     |
| ------------------ | ---------- | ------- | ----- | ------ |
| @savvy-web/bundler | dependency | updated | 2.1.9 | 2.1.10 |

## 1.1.9

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.8 | 2.1.9 |

## 1.1.8

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.7 | 2.1.8 |

## 1.1.7

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.6 | 2.1.7 |

## 1.1.6

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.5 | 2.1.6 |

* | Dependency         | Type       | Action  | From  | To    |                                                                       |
  | ------------------ | ---------- | ------- | ----- | ----- | --------------------------------------------------------------------- |
  | @savvy-web/bundler | dependency | updated | 2.1.4 | 2.1.5 | [#436][#436] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#436]: https://github.com/savvy-web/systems/pull/436

## 1.1.5

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.4 | 2.1.5 |

## 1.1.4

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.3 | 2.1.4 |

## 1.1.3

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.2 | 2.1.3 |

## 1.1.2

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.1 | 2.1.2 |

## 1.1.1

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 2.1.0 | 2.1.1 |

## 1.1.0

### Features

* Move the ambient RSPress declarations from the public asset rspress-env.d.ts to src/env.d.ts, published as the types-only ./env export. Consumers reference them with a triple-slash types directive pointing at savvy-web/rspress-builder/env, and the builder copies the file verbatim into every target directory through its zero-config ambient-dts path. The old ./rspress-env.d.ts export is removed.

  The declarations augment ImportMeta by declaring the interface at top level rather than wrapping it in declare global. A global script cannot carry a declare global block, and under skipLibCheck the resulting error is suppressed while the augmentation is silently discarded, leaving consumers with no import.meta.env at all.

  The tsconfig/plugin.json preset is now self-contained rather than extending the local ecma base, since a relative extends out of the published path is a resolution hazard for consumers.

- Resolve each package's own tsconfig for the declaration pass instead of synthesizing one that extends nothing, so declarations compile under the real effective compiler options rather than TypeScript defaults.

  Align rspress-builder's public options with the bundler's own names. dtsBundledPackages becomes bundledPackages, apiModel becomes meta, and dtsExternals plus bundleNodeModules are exposed at both the build-wide and per-bundle levels.

### Bug Fixes

* The published tsconfig presets (bundler's ecma.json, and rspress-builder's ecma.json and plugin.json) now set `composite: false` instead of `composite: true`. Nothing in this repo uses project references, and both tsconfigs the suite emits already force `composite: false` independently, so this changes no emitted build artifact. It only removes the console warnings consumer `tsc` runs produce when a non-referenced project inherits `composite: true`. [#398][#398]

- Move tsdown-plugins from a dependency to a devDependency of rspress-builder. Its types reach consumers through the bundler, which declares it as a regular dependency, so the direct entry was redundant.

  The shared ecma.json base now globs types/*.d.ts rather than types/*.ts and additionally includes src/\*.d.ts, so hand-authored ambient declarations under src are part of the program. [#398][#398]

### Dependencies

| Dependency         | Type       | Action  | From   | To    |
| ------------------ | ---------- | ------- | ------ | ----- |
| @savvy-web/bundler | dependency | updated | 2.0.14 | 2.1.0 |

### Other

* Both the TsconfigResolver removal and the rspress-builder option renames are released as minor rather than major, a deliberate SemVer deviation, because nothing outside this suite consumes either surface yet. [#398][#398]

- The shipped tsconfig presets now carry an inline note about how TypeScript resolves extends. The types and lib compiler options replace the base list rather than merging with it, so overriding either one in a consumer tsconfig means re-listing every entry still needed, node included, or losing access to console, process and Buffer with no warning from the compiler.

  ecma.json in bundler and rspress-builder, plugin.json in rspress-builder, and action.json in github-action-builder each carry a top-level note key documenting this. The bundler README also gains a short section explaining the behavior and pointing at plugin.json as the working example, since it already re-lists node alongside react and react-dom. [#398][#398]

### Minor Changes

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#398]: https://github.com/savvy-web/systems/pull/398

## 1.0.31

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 2.0.13 | 2.0.14 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.2.2  | 2.2.3  |

## 1.0.30

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 2.0.12 | 2.0.13 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.2.1  | 2.2.2  |

## 1.0.29

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 2.0.11 | 2.0.12 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.2.0  | 2.2.1  |

## 1.0.28

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 2.0.10 | 2.0.11 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.9  | 2.2.0  |

## 1.0.27

### Dependencies

| Dependency                | Type       | Action  | From  | To     |
| ------------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/bundler        | dependency | updated | 2.0.9 | 2.0.10 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.8 | 2.1.9  |

## 1.0.26

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.8 | 2.0.9 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.7 | 2.1.8 |

## 1.0.25

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.7 | 2.0.8 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.6 | 2.1.7 |

## 1.0.24

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.6 | 2.0.7 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.5 | 2.1.6 |

## 1.0.23

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.5 | 2.0.6 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.4 | 2.1.5 |

* | Dependency  | Type       | Action  | From    | To       |                                                                       |
  | ----------- | ---------- | ------- | ------- | -------- | --------------------------------------------------------------------- |
  | @tsdown/css | dependency | updated | ^0.22.9 | ^0.22.12 | [#342][#342] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#342]: https://github.com/savvy-web/systems/pull/342

## 1.0.22

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.4 | 2.0.5 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.3 | 2.1.4 |

## 1.0.21

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.3 | 2.0.4 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.2 | 2.1.3 |

## 1.0.20

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.2 | 2.0.3 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.1 | 2.1.2 |

* | Dependency  | Type       | Action  | From    | To      |                                                          |
  | ----------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | @tsdown/css | dependency | updated | ^0.22.7 | ^0.22.9 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.0.19

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.1 | 2.0.2 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.1.0 | 2.1.1 |

## 1.0.18

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 2.0.0 | 2.0.1 |
| @savvy-web/tsdown-plugins | dependency | updated | 2.0.0 | 2.1.0 |

## 1.0.17

### Dependencies

| Dependency                | Type       | Action  | From   | To    |
| ------------------------- | ---------- | ------- | ------ | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.14 | 2.0.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.13 | 2.0.0 |

## 1.0.16

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 1.1.13 | 1.1.14 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.12 | 1.1.13 |

* | Dependency  | Type       | Action  | From    | To      |                                                          |
  | ----------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | @tsdown/css | dependency | updated | ^0.22.5 | ^0.22.7 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.0.15

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 1.1.12 | 1.1.13 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.11 | 1.1.12 |

## 1.0.14

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 1.1.11 | 1.1.12 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.10 | 1.1.11 |

* | Dependency  | Type       | Action  | From    | To      |                                                          |
  | ----------- | ---------- | ------- | ------- | ------- | -------------------------------------------------------- |
  | @tsdown/css | dependency | updated | ^0.22.4 | ^0.22.5 | Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

## 1.0.13

### Dependencies

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 1.1.10 | 1.1.11 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.9  | 1.1.10 |

## 1.0.12

### Dependencies

| Dependency                | Type       | Action  | From  | To     |
| ------------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/bundler        | dependency | updated | 1.1.9 | 1.1.10 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.8 | 1.1.9  |

* | Dependency                 | Type           | Action  | From                  | To      |                                                                       |
  | -------------------------- | -------------- | ------- | --------------------- | ------- | --------------------------------------------------------------------- |
  | @typescript/native-preview | peerDependency | removed | ^7.0.0-dev.20260612.1 | —       |                                                                       |
  | @tsdown/css                | dependency     | updated | ^0.22.3               | ^0.22.4 |                                                                       |
  | typescript                 | peerDependency | updated | ^6.0.0                | ^7.0.0  | [#278][#278] Thanks [@spencerbeggs](https://github.com/spencerbeggs)! |

### Patch Changes

[#278]: https://github.com/savvy-web/systems/pull/278

## 1.0.11

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.8 | 1.1.9 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.7 | 1.1.8 |

## 1.0.10

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.7 | 1.1.8 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.6 | 1.1.7 |

## 1.0.9

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.6 | 1.1.7 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.5 | 1.1.6 |

## 1.0.8

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.5 | 1.1.6 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.4 | 1.1.5 |

## 1.0.7

### Dependencies

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.1.4 | 1.1.5 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.3 | 1.1.4 |

## 1.0.6

### Dependencies

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 1.1.3 | 1.1.4 |

* | Dependency  | Type           | Action  | From    | To      |
  | ----------- | -------------- | ------- | ------- | ------- |
  | @types/node | peerDependency | updated | ^26.0.0 | ^26.1.0 |

## 1.0.5

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.2 | 1.1.3 |
| @savvy-web/bundler        | dependency | updated | 1.1.2 | 1.1.3 |

## 1.0.4

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.1 | 1.1.2 |
| @savvy-web/bundler        | dependency | updated | 1.1.1 | 1.1.2 |

## 1.0.3

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 1.1.0 | 1.1.1 |
| @savvy-web/bundler        | dependency | updated | 1.1.0 | 1.1.1 |

## 1.0.2

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 1.0.1 | 1.1.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 1.0.1 | 1.1.0 |

## 1.0.1

### Maintenance

* [`8941f4c`](https://github.com/savvy-web/systems/commit/8941f4c8c54f2020d00689269fb16ea05ea94fcb) Coordinated re-release alongside the `@savvy-web/pnpm-plugin-silk` monorepo migration so the package picks up the refreshed `catalog:silkPeers` peer-dependency ranges. Also adds a `LICENSE` file and minor `tsconfig.json` corrections. No runtime behavior changes.
  | Dependency                | Type       | Action  | From  | To    |
  | ------------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/bundler        | dependency | updated | 1.0.0 | 1.0.1 |
  | @savvy-web/tsdown-plugins | dependency | updated | 1.0.0 | 1.0.1 |

## 1.0.0

### Features

* [`ceeca34`](https://github.com/savvy-web/systems/commit/ceeca34f4ac4b7fdca7321c5016321f5be084768) ### `build()` front door

`@savvy-web/rspress-builder` now exposes a `build()` front door matching `@savvy-web/bundler`'s. It applies the `definePlugin` preset internally and runs the build, deriving `cwd` from the entry script directory and `argv` from `process.argv`, so an RSPress plugin's `savvy.build.ts` is a single call:

```ts
import { build } from "@savvy-web/rspress-builder";

await build();
```

Options pass straight through to `definePlugin` — `await build({ runtime: false })` builds a plugin with no runtime bundle. `definePlugin` and the re-exported `runBuild` remain available for advanced or escape-hatch use.

### Patch Changes

| Dependency                | Type       | Action  | From   | To    |
| ------------------------- | ---------- | ------- | ------ | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.12.0 | 1.0.0 |
| @savvy-web/bundler        | dependency | updated | 0.12.0 | 1.0.0 |

## 0.12.0

### Patch Changes

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/tsdown-plugins | dependency | updated | 0.11.2 | 0.12.0 |
| @savvy-web/bundler        | dependency | updated | 0.11.2 | 0.12.0 |

## 0.11.2

### Patch Changes

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 0.11.1 | 0.11.2 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.11.1 | 0.11.2 |

## 0.11.1

### Patch Changes

| Dependency         | Type       | Action  | From   | To     |
| ------------------ | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler | dependency | updated | 0.11.0 | 0.11.1 |

## 0.11.0

### Patch Changes

| Dependency                | Type       | Action  | From   | To     |
| ------------------------- | ---------- | ------- | ------ | ------ |
| @savvy-web/bundler        | dependency | updated | 0.10.0 | 0.11.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.10.0 | 0.11.0 |

## 0.10.0

### Patch Changes

| Dependency                | Type       | Action  | From  | To     |
| ------------------------- | ---------- | ------- | ----- | ------ |
| @savvy-web/bundler        | dependency | updated | 0.9.2 | 0.10.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.2 | 0.10.0 |

## 0.9.2

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.1 | 0.9.2 |
| @savvy-web/bundler        | dependency | updated | 0.9.1 | 0.9.2 |

## 0.9.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/tsdown-plugins | dependency | updated | 0.9.0 | 0.9.1 |
| @savvy-web/bundler        | dependency | updated | 0.9.0 | 0.9.1 |

## 0.9.0

### Documentation

* [`81f90f3`](https://github.com/savvy-web/systems/commit/81f90f3e6acc11c0b70be856c676292578fdc7c2) Added `@public` release tags to `RspressBundleOptions`, `RspressPluginOptions`, and `definePlugin` so they register correctly in the generated API model and pass the `ae-missing-release-tag` check. Fixed TSDoc syntax warnings: `{@link}` references replaced with backtick code spans, and bare scoped package names in prose escaped to satisfy the TSDoc parser.
  | Dependency                | Type       | Action  | From  | To    |
  | ------------------------- | ---------- | ------- | ----- | ----- |
  | @savvy-web/tsdown-plugins | dependency | updated | 0.8.0 | 0.9.0 |
  | @savvy-web/bundler        | dependency | updated | 0.8.0 | 0.9.0 |

### Dependencies

* | [`a0a96ee`](https://github.com/savvy-web/systems/commit/a0a96ee748297ead67590d8ccbc3eaba4f8f0802) | Dependency    | Type    | Action                | From                  | To |
  | :------------------------------------------------------------------------------------------------ | :------------ | :------ | :-------------------- | :-------------------- | -- |
  | @types/react-dom                                                                                  | dependency    | added   | —                     | ^19.2.0               |    |
  | react-dom                                                                                         | dependency    | added   | —                     | ^19.2.0               |    |
  | @typescript/native-preview                                                                        | devDependency | updated | ^7.0.0-dev.20260612.1 | ^7.0.0-dev.20260621.1 |    |
  | @types/node                                                                                       | devDependency | updated | ^25.9.0               | ^26.0.0               |    |

## 0.8.0

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.7.0 | 0.8.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.7.0 | 0.8.0 |

## 0.1.3

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.6.1 | 0.7.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.6.0 | 0.7.0 |

## 0.1.2

### Patch Changes

| Dependency         | Type       | Action  | From  | To    |
| ------------------ | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler | dependency | updated | 0.6.0 | 0.6.1 |

## 0.1.1

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.5.0 | 0.6.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.5.0 | 0.6.0 |

## 0.1.0

### Features

* [`db4bc25`](https://github.com/savvy-web/systems/commit/db4bc2580ac9c42d0174763b3343b10a308657a4) `@savvy-web/rspress-builder` is a new package for building RSPress plugin packages. RSPress plugins have a fixed shape — a Node plugin entry (`.`) and an optional browser React runtime entry (`./runtime`) — so the package exposes a single configuration function that wires everything correctly.

### `definePlugin()`

Returns a standard `BuildConfig` for a package that ships both a Node plugin bundle and a browser-targeted, bundleless, CSS-module React runtime bundle. Hand the result to `runBuild` from a self-executing `savvy.build.ts`:

```ts
// savvy.build.ts
import { definePlugin, runBuild } from "@savvy-web/rspress-builder";

const config = definePlugin({
  // runtime: true (default) — builds the ./runtime browser bundle
  // runtime: false — plugin-only, no runtime
  // runtime: { externals: ["my-extra-dep"] } — tunes runtime externals
  dtsBundledPackages: ["@rspress/core"], // inline @rspress/core declarations into dts
});

export default config;

if (import.meta.main) {
  await runBuild(config, {
    cwd: import.meta.dirname,
    argv: process.argv.slice(2),
  });
}
```

The plugin bundle externalizes `@rspress/core`. The runtime bundle externalizes `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `@rspress/core`, and `@theme` — these are provided by RSPress at site-build time. `import.meta.env` is preserved as-is so RSPress can resolve `SSG_MD` and other env flags per site.

### Shipped consumer tsconfig preset

`@savvy-web/rspress-builder/tsconfig/plugin.json` is a ready-to-use TSConfig for RSPress plugin source: self-contained (extends a colocated `./ecma.json` copy so it resolves even when `@savvy-web/bundler` is only a transitive dependency), sets `jsx: "react-jsx"`, includes the `dom` lib, and types `node`/`react`/`react-dom`. Reference it from your package's `tsconfig.json` with `"extends": "@savvy-web/rspress-builder/tsconfig/plugin.json"`.

### Ambient CSS and `import.meta.env` typings

`@savvy-web/rspress-builder/rspress-env.d.ts` provides:

* `*.module.css` and `*.css` ambient module declarations for CSS module imports.
* `ImportMetaEnv` with `SSG_MD?: boolean` and an open string index.

Reference it from a `types/*.d.ts` in your package with a triple-slash directive — `/// <reference types="@savvy-web/rspress-builder/rspress-env.d.ts" />` — to get correct types for CSS imports and `import.meta.env` in your runtime source.

### Patch Changes

| Dependency                | Type       | Action  | From  | To    |
| ------------------------- | ---------- | ------- | ----- | ----- |
| @savvy-web/bundler        | dependency | updated | 0.4.2 | 0.5.0 |
| @savvy-web/tsdown-plugins | dependency | updated | 0.4.2 | 0.5.0 |
