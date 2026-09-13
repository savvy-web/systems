---
type: Interface
title: dist/<target>/issues.json
description: "The structured, machine-readable diagnostics artifact every dev and prod build writes: what a reader may rely on staying stable, gated on buildOk."
status: draft
kind: wire
resource: ../../packages/tsdown-plugins/src/report/issues-artifact.ts
tags: [build, tooling]
sources:
  - id: issues-artifact
    resource: ../../packages/tsdown-plugins/src/report/issues-artifact.ts
  - id: report-design
    resource: ../../packages/tsdown-plugins/src/report/pipeline.ts
  - id: meta-design
    resource: ../../packages/tsdown-plugins/src/meta/generate.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 29751c3ce2b1795f6a63baf2dc76163436438b15173a947d85c2b5350326b0dd
---

# dist/\<target\>/issues.json

## The contract

Every dev and prod build of every package writes `dist/<target>/issues.json`
— on success and on failure alike — as the persisted, structured counterpart
to the human-facing build report. A consumer reads the file, never the
terminal output, to learn what a build produced.[^issues-artifact]

- **Presence means built; absence means not-built.** There is no other
  reliable signal a consumer should infer from a missing file.[^report-design]
- **`buildOk` is the outcome stamp, gated first — never `errors.length`.** A
  build that crashes before recording any diagnostic can leave `warnings`,
  `errors`, and `suppressed` all empty, which is byte-identical to a clean
  pass. `buildOk: false` is the only reliable signal of a crash. A missing
  `buildOk` field (an artifact from before the field existed) reads as
  unknown, never as a pass.[^issues-artifact]
- **`failure` is present only when `buildOk` is `false`.** It carries an
  optional `name` and a `message` truncated to 2000 characters — enough for a
  stack-free error, not a log dump.[^issues-artifact]
- **`warnings`/`errors`/`suppressed` are flat, de-duplicated arrays of
  `PlainDiagnostic`.** Each carries `source` (one of `tsdown`, `rolldown`,
  `api-extractor`, `meta`), `level`, `text`, and optionally `code`,
  `ciFatal`, `file`, `line`, `column`. De-duplication is on the
  identity-bearing fields together, so a diagnostic byte-identical across
  multiple registry target-groups appears once, not once per group.[^issues-artifact]
- **`ae-*`/`tsdoc-*` diagnostics and every `source: "meta"` entry are
  prod-only.** The API Extractor meta pass runs only under `--target prod`;
  a dev build's `issues.json` carries `tsdown`/`rolldown` diagnostics
  only.[^report-design]
- **The write is atomic.** The file lands via a pid-suffixed temp file
  renamed over the destination, so a concurrent reader — the tsdoc
  background monitor polls this file — observes either the previous
  complete artifact or the new complete one, never a torn write.[^issues-artifact]
- **`generatedAt`, `package`, and `target` (`"dev" | "prod"`) are always
  present**, independent of `buildOk`.[^issues-artifact]

## What a consumer must not assume

- Do not infer a passing build from an empty `errors` array; check `buildOk`
  first.
- Do not assume ordering within `warnings`/`errors`/`suppressed` is stable
  across builds — the arrays are deduplicated, not sorted.
- Do not expect `ae-*`/`tsdoc-*`/`source: "meta"` entries in a dev build's
  artifact.
- A sidecar failure while composing the meta pass's own `tsdoctor.json` (see
  [meta generation](../modules/tsdown-plugins.md)) surfaces here too, tagged
  `source: "meta"`, and still fails the build — it is not a separate,
  quieter failure channel.[^meta-design]

## Related

- [`modules/tsdown-plugins.md`](../modules/tsdown-plugins.md) — the package
  that writes this artifact, as part of its build-report subsystem.
- [`modules/silk-plugin.md`](../modules/silk-plugin.md) — the tsdoc
  background monitor and tsdoctor agent that consume this file.

[^issues-artifact]: ../../packages/tsdown-plugins/src/report/issues-artifact.ts
[^report-design]: `../../packages/tsdown-plugins/src/report/pipeline.ts`
[^meta-design]: `../../packages/tsdown-plugins/src/meta/generate.ts`
