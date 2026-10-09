---
type: Decision
title: OG image renders are cached only under a named salt
description: "tsdown-plugins caches openGraph.generate renders across builds only when openGraph.cacheSalt is a string or the generator carries its own cacheSalt; otherwise, and when cacheSalt is false, it always regenerates — because the cache cannot see a generator's code."
status: stable
tags: [build, performance, dx]
generated:
  by: okfit/claude-code
  at: 2026-10-09T17:54:20Z
  body_sha256: d2eb7e8ae821cf55f8b1f6862d58e7c039cb0767ee2a2ab98c95ab2155b712a1
sources:
  - id: og-image
    resource: ../../packages/tsdown-plugins/src/meta/og-image.ts
  - id: tsdoctor-config
    resource: ../../packages/tsdown-plugins/src/meta/tsdoctor-config.ts
  - id: generate
    resource: ../../packages/tsdown-plugins/src/meta/generate.ts
  - id: bundler-og
    resource: ../../packages/bundler/src/og.ts
  - id: owner
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-09T00:00:00Z
verified:
  - by: human:spencer
    at: 2026-10-09T17:59:10Z
---

# OG image renders are cached only under a named salt

## Context

`@savvy-web/tsdown-plugins` renders a package's Open Graph image at build
time through a configured `openGraph.generate` function, and since moving
from `image-size` to `@effected/images` it can keep those renders across
builds in `ImageCache`, under `<pkg>/node_modules/.cache/tsdown-plugins/og`.
The cache key is SHA-256 over a salt plus the canonical encoding of the
`OgImageInfo` the generator receives.[^og-image] That key sees the input,
never the generator: if someone edits a renderer's layout, font or colors,
the same input maps to the same key. Unless the salt changes as well, the
cache keeps serving the old image and nothing signals that it is stale.

## Decision

Caching is on only when something names the generator's identity in a
salt. `TsdoctorMetaOptions.openGraph.cacheSalt?: string | false` decides,
through the exported pure function `resolveOgCacheSalt(generate,
cacheSalt)`:[^og-image][^tsdoctor-config]

- a string caches under that salt;
- `false` always regenerates;
- omitted, the generator's own `cacheSalt` is used if it has one — the
  exported `OgImageGenerator` interface is the generate function plus an
  optional `readonly cacheSalt` — and otherwise the build always
  regenerates.

`@savvy-web/bundler/og`'s `ogImage.satori()` carries its own salt, the JSON
of its renderer id, `process.env.__PACKAGE_VERSION__` (`"source"` when
unbuilt), the installed `satori` and `@resvg/resvg-js` versions, and the
resolved colors, so the built-in card is cached by default.[^bundler-og]
The maintainer chose this policy.[^owner]

## Alternatives rejected

- **Opt-in-only salt (cache only when `openGraph.cacheSalt` is set).**
  Safe, but the built-in card, whose author can name everything that
  shapes its bytes, would go uncached unless every package added config to
  get a benefit the renderer can already vouch for.
- **Default the salt to the `tsdown-plugins` version.** That version covers
  only the plugin, not an arbitrary user generator. Editing a custom
  renderer without bumping tsdown-plugins would serve the stale image with
  no signal, which is the failure the policy exists to prevent.

## Consequences

- Arbitrary generators stay correct by default: they regenerate every
  build until their author supplies a salt.
- A generator that sets `cacheSalt` takes on the duty to change it whenever
  its output for the same input changes.
- Known limitation: running unbuilt source, `ogImage.satori()`'s version
  component is `"source"`, so a local edit to `og.ts` does not invalidate
  the cache. Deleting `node_modules/.cache` does.
- `generateMeta` still `rmSync`s `meta/og` each build. The cache lives
  outside it, so clearing the output never clears the cache.[^generate]

[^og-image]: `../../packages/tsdown-plugins/src/meta/og-image.ts`
[^tsdoctor-config]: `../../packages/tsdown-plugins/src/meta/tsdoctor-config.ts`
[^bundler-og]: `../../packages/bundler/src/og.ts`
[^generate]: `../../packages/tsdown-plugins/src/meta/generate.ts`
[^owner]: conversation with the repository owner
