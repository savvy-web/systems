---
status: current
module: tsdown-plugins
category: architecture
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 92
related:
  - ./architecture.md
  - ./build-loop.md
  - ./meta.md
  - ./dual-format.md
  - ../bundler/architecture.md
  - ../bundler/meta-wiring.md
  - ../silk/plugin.md
---

# The build report

How build facts are captured from three synchronous runtimes plus the meta pass's own sidecar work, rendered into one unified report and persisted as a machine-readable artifact. Part of the [tsdown-plugins architecture](./architecture.md).

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [The build collector](#the-build-collector)
- [The capture seams](#the-capture-seams)
- [The output reporter](#the-output-reporter)
- [The issues.json artifact](#the-issuesjson-artifact)
- [Boundaries and invariants](#boundaries-and-invariants)
- [Rationale](#rationale)

## Overview

The build emits its facts as side effects from tsdown's logger, rolldown's `writeBundle`/`onLog` and API Extractor's message callback, all of which call back synchronously. The `BuildCollector` bridges that sync write side to the Effect read side: callbacks write into it directly, `snapshot(packageName)` produces the immutable `ReadonlyArray<BuildReport>` the render pipeline consumes, and `writeIssuesArtifact` flattens the same snapshot to disk. The bundler and both self-hosting builders render and persist on every terminal path, success and failure alike.

## Current state

- **Collector:** `BuildCollector` and its `BuildCollectorTag` `Context.Service` (`src/report/collector.ts`).
- **Seams:** `createTsdownLogger` (`src/report/tsdown-logger.ts`), `buildMetricsPlugin` (`src/report/metrics-plugin.ts`), `mapExtractorMessage` (`src/meta/api-extractor.ts`).
- **Schema:** `BuildReport`/`TargetGroupReport`/`PassReport`/`EmittedFile`/`DiagnosticEntry` (`src/report/schema.ts`); the SchemaStore JSON Schema generator (`src/report/schema-export.ts`, internal — consumers read the emitted file).
- **Pipeline:** the four services under `src/report/services/`, `ReportPipeline`/`renderReport` (`src/report/pipeline.ts`), the formatters under `src/report/formatters/`, `createTimer`/`formatTime` (`src/report/timer.ts`).
- **Artifact:** `flattenIssues`/`serializeIssues`/`writeIssuesArtifact` and the `BuildIssues`/`PlainDiagnostic` types (`src/report/issues-artifact.ts`).

## The build collector

The write surface (`registerGroup`, `recordEmitted`, `recordPassTiming`, `recordWarning`, `recordError`, `recordSuppressed`) is plain synchronous so any callback can call it; only `snapshot` crosses to the Effect side, exposed as the `BuildCollectorTag` service. There is deliberately no `Logger.replace`.

- **First-write-wins per-path dedup.** `recordEmitted` counts each output path once per group, attributed to the first pass that emits it. A dual-format build's dts pass re-emits the same `.cjs` chunk (see [Dual-format output](./dual-format.md)), and rspress-builder's multi-partition passes share a group, so a naive count would double files.
- **Per-group diagnostic dedup** on source, level, code, text and location, so a warning firing in more than one pass is reported once. Suppressed messages accumulate on a separate `suppressed` channel that never counts toward totals but stays available for `--verbose`.
- **Per-pass timing.** The build loop wraps each pass in a timer feeding `recordPassTiming`; each `PassReport` carries its own `ms`.

The collector is optional on `buildTargetGroups` and `runExeBuild`: absent, the build is byte-identical raw tsdown output. See [The build loop](./build-loop.md#the-passes).

## The capture seams

- **Seam 1 — tsdown diagnostics via `createTsdownLogger`.** A tsdown `customLogger` routing `warn`/`warnOnce`/`error` into the collector (ANSI-stripped) and dropping `info`/`success`. Paired with `logLevel: "silent"` on the same config, silent muzzles tsdown's console while the custom logger still receives every diagnostic.
- **Seam 2 — emitted-file metrics and rolldown logs via `buildMetricsPlugin`.** Its `writeBundle` records each chunk/asset's byte size (gzip only under `verbose`, the expensive part) for the JS and dts passes. Its `onLog` is a separate channel from the tsdown muzzle: it records rolldown-level diagnostics and returns `false` for warnings so they do not print raw above the unified report; errors are recorded but *not* suppressed, so a build failure is never swallowed. Two special cases: a `SOURCEMAP_BROKEN` from an `@tsdown/css*` plugin is dropped without recording (the synthesized CSS-module locals emit no sourcemap — benign, unfixable upstream, noisy on every CSS-module dev build), and with `suppressMixedExports` set, a `MIXED_EXPORTS` warning routes to the `suppressed` bucket. `buildTargetGroups` sets that flag for exactly the passes that install `cjsDefaultInterop()`, because rolldown's suggested remedy changes no codegen for a default+named module and the consequence it warns about is precisely what the footer removes.
- **Seam 3 — API Extractor diagnostics via `mapExtractorMessage` + `onMessage`.** The pure mapper turns an extractor message into a `DiagnosticInput` preserving `file`/`line`/`column`; the callback routes it to the collector's group and marks it handled so API Extractor stops printing. Locations are accurate because diagnostics come from the per-module declarations run (see [Meta generation](./meta.md#the-two-input-split)); the synthesized `_base` of an Effect class mixin resolves to its `declarations/*.d.ts` mirror rather than `src/`, since rolldown-plugin-dts does not source-map it. Suppressed messages route through `onSuppressed` for accounting.

- **Seam 4 — meta-pass sidecar failures, recorded directly by `runMetaPass`.** The `tsdoctor.json` sidecar and its Open Graph image are not produced by any of the three runtimes, so their failures have no callback to hook; `runMetaPass` calls `recordError` itself with `source: "meta"` before rethrowing. Two codes exist: `tsdoctor-source-invalid` (a present-but-undecodable `tsdoctor.json`, with `file` set to its path, recorded on EVERY group because the sources load once per package) and `og-generate-failed` (the generator threw, returned no bytes or returned a non-image, recorded on the failing group). Both still fail the build; the seam exists so `issues.json` and the report name the cause instead of an opaque throw. See [Meta generation](./meta.md#failure-routing).

**tsdown's own `suppressWarnings` option is unreachable here.** tsdown's `createLogger` returns early when a `customLogger` is supplied, and this builder always supplies one whenever a collector exists — so every suppression decision has to live in these seams, never in tsdown config.

## The output reporter

Four `Context.Service` classes with `layer` statics — `EnvironmentDetector → ExecutorResolver → FormatSelector → OutputRenderer` — compose into the `ReportPipeline` layer; `renderReport(reports, options)` is the Effect program threading them, which the consumer runs via `Effect.runPromise`.

- **Executors:** `human` (pretty terminal), `agent` (markdown, failures-first, deduped and token-efficient) and `ci` (GitHub annotations). Environment is auto-detected via `std-env` (agent shell, then GitHub Actions, then generic CI, then TTY); an explicit format override wins. Precedence is settled in `FormatSelector.select`.
- **Formatter contract:** `render(reports, ctx) → RenderedOutput[]`, sync and pure. Formatters: `terminal`, `json`, `markdown`, `ci-annotations`, `silent`.
- **`BuildReport` schema:** per package → per TargetGroup, with `passes: PassReport[]` (each carrying `EmittedFile`s and `ms`), `warnings`/`errors`/`suppressed` as `DiagnosticEntry[]` (`source` — one of `tsdown`, `rolldown`, `api-extractor`, `meta` — level, text, optional code, `ciFatal` and location) and timings. See `src/report/schema.ts` for the `Schema.Struct`s. A SchemaStore-compatible JSON Schema is generated from core `effect`'s `Schema.toJsonSchemaDocument` so the structured output validates in editors.
- **Quiet by default, verbose table.** The terminal formatter prints a bold package name, one line per group, inline warnings/errors with `file:line` and an aggregate line; `verbose` switches to a per-pass file table with sizes.
- **Human-facing nudges only.** The shared helpers in `src/report/formatters/diagnostics.ts` render a `[fails CI]` tag on `ciFatal` warnings, a per-package fail-the-build callout and a one-line suppressed summary in `terminal` and `markdown`. `ci-annotations` and `json` carry the same fields but render no nudge — the machine-facing channels already fail the build or hand raw fields to a consumer.

## The issues.json artifact

`writeIssuesArtifact` is the persisted, structured counterpart to the rendered report: the same diagnostics, written to `dist/<target>/issues.json` for a tool to read. The tsdoctor agent and the tsdoc skill's verify step both key off it (see `../silk/plugin.md`), so its contract is load-bearing.

- **Flatten plus dedupe.** `flattenIssues` collapses the per-group channels into three flat arrays deduplicated on the identity-bearing fields — multiple registry groups carry byte-identical diagnostics, so a naive flatten would repeat each one per group.
- **Always written, on every terminal path.** Every dev and prod build writes it, on success and on failure (the bundler writes before rethrowing — a failed build is exactly when an agent wants to read why). An absent file means the package was not built.
- **`buildOk` is the outcome stamp a reader must gate on, never `errors.length`.** A crashed build can leave every diagnostic bucket empty, byte-identical to a clean gate, so `BuildIssues` carries `buildOk` plus an optional `failure` (`name`/`message`, present only when `buildOk` is false). `flattenIssues` defaults `buildOk` to `true`, so **a caller that writes on a failure path must pass `buildOk: false`** or its crash reads as a pass. A missing `buildOk` is unknown, not a pass.
- **Atomic write.** The JSON lands in a pid-suffixed sibling temp file that is renamed over the destination, so a concurrent reader — the tsdoc background monitor polls the file — observes either the previous artifact or the complete new one. A failed write removes the temp file and rethrows; the callers swallow it so a read-only filesystem never masks the build outcome.
- **`ae-*`/`tsdoc-*` and every `source: "meta"` entry are prod-only**, because the meta pass runs only in `--target prod`; `dist/dev/issues.json` carries tsdown/rolldown diagnostics only.

## Boundaries and invariants

- **The collector is sync-write, service-read and optional.** No `Logger.replace`; absent means raw tsdown behavior.
- **All warning suppression lives in the seams** (`buildMetricsPlugin.onLog`, `suppressWarnings` via `onSuppressed`), never in tsdown config, which cannot reach a build that supplies a `customLogger`.
- **Errors are recorded, never suppressed.** `onLog` returns `undefined` for error-level logs so rolldown's default error reporting still fires; the `meta`-source sidecar errors are recorded and then rethrown.
- **The issues artifact is always written and is a consumed contract.** Absence means not-built; presence means read `buildOk` first.
- **`flattenIssues` defaults `buildOk` to `true`**; failure-path callers must pass `false` explicitly.
- **Nudges are human-only.** `json` and `ci-annotations` carry `code`/`ciFatal`/`suppressed` but render no persuasion.

## Rationale

### Why no `Logger.replace`

Swapping Effect's logger was the prior source of non-determinism in the bundled Effect runtime, and none of the three producers are Effect code anyway — they are synchronous callbacks from tsdown, rolldown and API Extractor. A plain accumulator with a single Effect-side read is the smallest bridge that keeps every producer synchronous and every consumer typed.

### Why the reporter is copied, not shared

The pipeline mirrors the `vitest-agent-reporter` pattern but `BuildReport` is intentionally simpler than its `AgentReport`. Owning the code keeps the bundler shippable without coupling to an external reporter's release cadence; a shared reporting package is a later consolidation if it earns its keep.

### Why the artifact stamps the outcome

Before `buildOk`, "present but empty" was read as clean, and a crash before any diagnostic was recorded produced exactly that file. Making the outcome explicit and defaulting it to success keeps every success-path caller's output unchanged while forcing failure-path callers to say so.
