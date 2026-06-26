---
id: packages/bundler/api
title: "@savvy-web/bundler — API reference"
summary: "@savvy-web/bundler API reference: 9 documented symbols."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.4
related: []
---

# @savvy-web/bundler — API reference

## function

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
