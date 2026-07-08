---
name: build
description: >
  Configure and run @savvy-web/bundler builds (and its rspress-builder
  sibling) from a savvy.build.ts. The build() front door, the full
  BuildConfig option surface, the build:dev/build:prod/types:check/prepare
  workspace + Turborepo wiring, SEA executables, and the API Extractor meta
  pass. Auto-loads when editing savvy.build.ts; user-invokable as /silk:build.
when_to_use: >
  "set up savvy.build.ts", "configure the bundler", "build:dev vs build:prod",
  "how do I add prepare", "wire turbo build tasks", "dual-format esm cjs",
  "bundle a dependency", "externals vs bundledPackages vs dtsExternals",
  "build a single executable", "SEA binary", "--target exe", "generate api
  model", "suppress api extractor warning", "rspress plugin build",
  "definePlugin", "what does <option> do in savvy.build.ts"
paths:
  - "**/savvy.build.ts"
---

# Building with @savvy-web/bundler

`savvy.build.ts` is the per-package build entry: run it with `node savvy.build.ts --target dev|prod`. It builds JS + `.d.ts`, transforms the manifest, and — on `prod` — runs the API Extractor meta pass.

## Front door (preferred)

```ts
import { build } from "@savvy-web/bundler";

await build();
```

Zero-config `build()` reads `package.json` `exports`/`bin`, derives the target from `process.argv` (`--target dev|prod|exe`, `--watch`, `--no-exe`, `--verbose`), and builds. Pass overrides as `build({ … })` using any `BuildConfig` field — see `references/options.md` for the full surface.

## Escape hatch (secondary)

```ts
import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({ /* … */ });
// inspect / snapshot / transform `config` here
await runBuild(config, { cwd: process.cwd(), argv: process.argv.slice(2) });
```

Use only when you must inspect or programmatically transform the resolved config, or inject `RunOptions` IO hooks (testing/self-host). Default builds use `build()`.

## Which reference do I need

| Reference | Covers |
| --- | --- |
| `references/options.md` | Every `BuildConfig` field |
| `references/workspace-setup.md` | `build:dev`/`build:prod`/`types:check`/`prepare` scripts + Turborepo wiring |
| `references/sea.md` | Single Executable Application (SEA) binaries |
| `references/api-extractor.md` | The meta pass + a bundling-knob decision guide |
| `references/rspress-builder.md` | Building RSPress plugins |

For TSDoc release tags and fixing `ae-*`/`tsdoc-*` diagnostics, use `/silk:tsdoc` — this skill owns build *config*, `tsdoc` owns doc *comments*.
