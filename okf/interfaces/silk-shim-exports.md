---
type: Interface
title: "@savvy-web/silk export map"
description: "The subpath exports a config file imports from @savvy-web/silk: the module shape each shim promises to reproduce, stable independent of how silk-effects implements it."
status: draft
kind: api
resource: ../../packages/silk/package.json
tags: [tooling]
sources:
  - id: silk-architecture
    resource: ../../packages/silk/package.json
generated:
  by: okfit/claude-code
  at: 2026-09-18T02:06:56Z
  body_sha256: f1440d91e5f7b0c5cb633b3f2c4520fe6350348273b9d2bc56e7e79d30acb55d
---

# @savvy-web/silk export map

## The contract

A consumer imports one of these subpaths from `@savvy-web/silk`; the
`exports` field of `../../packages/silk/package.json` is the authoritative
wiring. Each subpath is a **shim**: it reproduces the exact module shape
(default vs named export, array vs object) the target tool's config loader
expects, not merely the underlying symbols.[^silk-architecture]

```text
./changesets/markdownlint       ← markdownlint-cli2 rules
./commitlint                    ← CommitlintConfig facade + types
./lint                          ← handlers / Preset / createConfig / utils
./biome                         ← static public/biome/silk.json asset
./tsconfig/node/root.json       ← Node monorepo ROOT preset
./tsconfig/rspress/website.json ← RSPress SITE preset (browser/SSG)
./package.json                  ← the manifest itself
```

The export map above is the whole surface.[^silk-architecture] The
changelog generator is deliberately absent: it ships as
[`@savvy-web/changelog`](../modules/changelog.md), the package a
`.changeset/config.json` names by id. The `./changesets`,
`./changesets/changelog`, `./changesets/remark`, `./commitlint/static`,
`./commitlint/prompt` and `./commitlint/formatter` subpaths that were
deprecated when that package was split out no longer exist; a config still
importing one fails to resolve rather than loading a stale shim.

## What stays stable

- **A shim import that worked against a retired standalone package
  (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`)
  keeps working after swapping the import to the matching silk subpath** —
  the drop-in-replacement guarantee this contract exists to keep.[^silk-architecture]
- **Every subpath is ESM-only.** The tools that load these shims —
  markdownlint-cli2 (0.23+, `customRules` via `import()`), commitlint
  (v19+) and lint-staged — all `import()` their config modules, so no
  subpath carries a `require` condition and none ships a `.cjs` twin. A
  consumer whose loader can only `require()` a config is outside this
  contract.[^silk-architecture]
- **`./lint` exposes the lint-staged consumer surface only** — handlers,
  `Preset`, `createConfig`, workspace utilities, section/template data. CLI
  commands are never re-exported here; that surface belongs to
  [`modules/cli.md`](../modules/cli.md).[^silk-architecture]
- **A config that infers a return type from `./commitlint` or `./lint`
  (e.g. `export default CommitlintConfig.silk()`) gets a `.d.ts` that names
  its type from `@savvy-web/silk`, never from the transitive
  `@savvy-web/silk-effects`.** This is the type-portability invariant: the
  factory's signature is declared in a silk-local facade, so a consumer
  workspace type-checks cleanly without needing silk-effects as a direct
  dependency.[^silk-architecture]
- **`./biome` and the two `./tsconfig/**` presets are static assets**, not
  generated from a build step that could reshape them at will — a consumer
  extending them gets the file as published.[^silk-architecture]

## What may change without notice

- The internal shape of `@savvy-web/silk-effects` behind any shim.
- The bundling posture behind an entry — what is inlined and what is
  externalized — as long as the module shape a consumer's loader observes
  is unchanged.
- Which `dependencies` silk declares to support a shim's emitted types,
  beyond the guarantee that any type a shim's `.d.ts` names resolves for the
  consumer without an extra install.

## Related

- [`modules/silk.md`](../modules/silk.md) — the carrier package this export
  map belongs to.
- [`decisions/silk-pins-siblings-as-dependencies.md`](../decisions/silk-pins-siblings-as-dependencies.md)
  — why `cli`/`mcp`/`changelog`/`silk-effects` are exact-pinned regular
  dependencies rather than peers, which is what keeps this export map
  resolvable without a consumer install step of its own.

[^silk-architecture]: `../../packages/silk/package.json`
