---
"@savvy-web/github-action-effects": minor
---

Pin the dlx-fetched npm to v11 and read npm 12's `pack --json` shape; guard against unpublishable manifests

`getNpmCommand` fetched an **unpinned** `npm` through `pnpm dlx npm` / `bun x npm`, so npm's next major landed in every consumer's release pipeline the day it published. When npm 12.0.0 took the `latest` dist-tag on 2026-07-08 it changed `pack --json` from an array of entries to an object keyed by package name (npm's changelog: "the `--json` output of `npm pack` and `npm publish` have changed. They are now always consistent"). Indexing `[0]` into that object yields `undefined`, so every publish failed with `npm pack returned empty result`, and Phase-2 sticky comments reported a package size of zero files.

- **Pin the npm spec to `npm@11`.** Not 12: npm 12.0.0's `publish` is broken outright — `libnpmpublish` declares `sigstore@^5` but the tarball does not bundle it, so `provenance.js` throws `MODULE_NOT_FOUND` at require time on *any* publish, with or without `--provenance` (npm/cli#9722). `yarn npm` is unaffected, being yarn's own implementation.
- **Read every `pack --json` shape** via the new `parseNpmPackJson`: npm ≤ 11's array, npm ≥ 12's name-keyed object, and a single unwrapped entry. Moving the pin to `npm@12` once npm ships the sigstore fix now needs no parser change. npm's `{ error: { code, summary } }` envelope is surfaced verbatim instead of being misreported as an empty result.
- **Refuse manifests carrying `catalog:` or `workspace:` specifiers** before `pack`/`dryRun` invoke npm. These pnpm-only protocols are uninstallable from a registry (`EUNSUPPORTEDPROTOCOL`); a manifest carrying one was packed from an unresolved workspace directory. This is the `yaml-effect@0.7.1` failure shape.
- **Refuse a tarball with zero files** in both `pack` and `dryRun`. npm exits cleanly on an empty package; Phase 2 now blocks the release PR rather than rendering "0 files" and letting auto-merge proceed.

Refs #144.
