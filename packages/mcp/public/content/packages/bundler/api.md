---
id: packages/bundler/api
title: "@savvy-web/bundler — API reference"
summary: "@savvy-web/bundler API reference: 10 documented symbols."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.4
related: []
---

# @savvy-web/bundler — API reference

## function

- [`build`](silk://packages/bundler/api/function/build) — Sugar front door: define + run in one call, deriving `cwd`/`argv` from process globals. `cwd` is the directory of the entry script (`process.argv[1]`) — the faithful equivalent of the old `import.meta.dirname`, correct even when invoked by an explicit path from another directory. `argv` is `process.argv.slice(2)`, so `--target` and friends are read internally; the package.json build scripts stay `node savvy.build.ts --target <t>`. `overrides` merges last as the test/advanced IO seam (the same injectables as RunOptions).
- [`defineBuild`](silk://packages/bundler/api/function/definebuild) — Normalize + validate a defineBuild config. Pure when imported; self-runs when entry (see run.ts).
- [`parseArgs`](silk://packages/bundler/api/function/parseargs) — Parse the build CLI argv into the normalized target/flags shape.
- [`runBuild`](silk://packages/bundler/api/function/runbuild) — Run a build from a normalized config. Pure orchestration; all IO injectable.

## interface

- [`BuildConfig`](silk://packages/bundler/api/interface/buildconfig)
- [`BuildConfigInput`](silk://packages/bundler/api/interface/buildconfiginput)
- [`BuildEntryOverride`](silk://packages/bundler/api/interface/buildentryoverride)
- [`OutputConfig`](silk://packages/bundler/api/interface/outputconfig)
- [`ParsedArgs`](silk://packages/bundler/api/interface/parsedargs)
- [`RunOptions`](silk://packages/bundler/api/interface/runoptions)
