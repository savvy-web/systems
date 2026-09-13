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
  at: 2026-09-13T01:18:00Z
  body_sha256: 8f5d106db33a6e933183bf832fd6683be6cf642d4183650fa8e11f9803be7702
---

# @savvy-web/silk export map

## The contract

A consumer imports one of these subpaths from `@savvy-web/silk`; the
`exports` field of `../../packages/silk/package.json` is the authoritative
wiring. Each subpath is a **shim**: it reproduces the exact module shape
(default vs named export, array vs object) the target tool's config loader
expects, not merely the underlying symbols.[^silk-architecture]

```text
./changesets                    ← changeset class/services API surface
./changesets/changelog          ← ChangelogFunctions default (CJS)
./changesets/markdownlint       ← markdownlint-cli2 rules (CJS)
./changesets/remark             ← remark plugins + presets + lint rules
./commitlint                    ← CommitlintConfig facade + types
./commitlint/static             ← static config default
./commitlint/prompt             ← commitizen adapter
./commitlint/formatter          ← custom error formatter
./lint                          ← handlers / Preset / createConfig / utils
./biome                         ← static public/biome/silk.json asset
./tsconfig/node/root.json       ← Node monorepo ROOT preset
./tsconfig/rspress/website.json ← RSPress SITE preset (browser/SSG)
```

The export map above is documented in full.[^silk-architecture]

## What stays stable

- **A shim import that worked against a retired standalone package
  (`@savvy-web/changesets`, `@savvy-web/commitlint`, `@savvy-web/lint-staged`)
  keeps working after swapping the import to the matching silk subpath** —
  the drop-in-replacement guarantee this contract exists to keep.[^silk-architecture]
- **`./changesets/changelog` and `./changesets/markdownlint` are CJS-capable
  exports**, because the Changesets CLI and markdownlint-cli2 load them via
  `require()`. Every other subpath is ESM-only. A consumer's own loader
  determines which it needs; both keep working regardless of how silk
  builds internally.[^silk-architecture]
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
- Whether a given entry builds ESM-only or dual-format, and any bundling
  posture that follows from that, as long as the module shape a consumer's
  loader observes is unchanged.
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
