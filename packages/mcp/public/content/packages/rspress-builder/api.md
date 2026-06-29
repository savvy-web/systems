---
id: packages/rspress-builder/api
title: "@savvy-web/rspress-builder — API reference"
summary: "@savvy-web/rspress-builder API reference: 4 documented symbols."
tier: packages
source: generated
tags: [rspress-builder, api]
priority: 0.4
related: []
---

# @savvy-web/rspress-builder — API reference

## function

- [`build`](silk://packages/rspress-builder/api/function/build) — Front door for building an RSPress plugin. Applies the definePlugin preset and runs the build, deriving `cwd` and `argv` from `process.argv`. For advanced use, definePlugin and `runBuild` remain exported.
- [`definePlugin`](silk://packages/rspress-builder/api/function/defineplugin) — Build an RSPress plugin package: a Node plugin entry (`.`) plus a browser, bundleless, CSS-module React runtime entry (`./runtime`). Returns a standard `BuildConfig`; hand it to `runBuild` from a self-executing `savvy.build.ts`.

## interface

- [`RspressBundleOptions`](silk://packages/rspress-builder/api/interface/rspressbundleoptions) — Per-bundle externals tuning for a single partition (plugin or runtime).
- [`RspressPluginOptions`](silk://packages/rspress-builder/api/interface/rspresspluginoptions) — Options for `definePlugin`. Deliberately small — RSPress plugins have a fixed shape.
