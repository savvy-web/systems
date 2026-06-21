---
"@savvy-web/tsdown-plugins": minor
---

## Features

### BuildCollector and structured diagnostics

Adds a stateful `BuildCollector` class (and its Effect `BuildCollectorTag`) that accumulates build metrics, warnings, and errors across all phases of a build. Callers that want a unified snapshot instead of per-pass console output can instantiate one collector, pass it through `buildTargetGroups` and `runExeBuild`, then call `collector.snapshot(packageName)` to obtain the immutable `BuildReport`.

Warnings and errors from tsdown's logger, rolldown's `onLog`, and API Extractor's `messageCallback` are all funneled into the collector — the build runs silently to stdout and delivers a single structured report at the end.

```ts
import { BuildCollector, buildTargetGroups } from "@savvy-web/tsdown-plugins";

const collector = new BuildCollector();
await buildTargetGroups({ ...options, collector, verbose: false });
const [report] = collector.snapshot("my-package");
// report.targetGroups[0].passes   — per-pass file lists
// report.targetGroups[0].warnings — structured DiagnosticEntry[]
```

### createTsdownLogger and buildMetricsPlugin

`createTsdownLogger(collector, groupId)` returns a tsdown `customLogger` that routes warnings and errors into the collector. Pair it with `logLevel: "silent"` on the tsdown config to suppress console noise while still capturing all diagnostics.

`buildMetricsPlugin(collector, groupId, pass)` is a rolldown `writeBundle` plugin that records each emitted output file (path and byte size) into the collector after every bundle pass.

Both are exported from the package root and intended for use when integrating the collector into a custom build driver.

### Restructured BuildReport schema

The `BuildReport` and `TargetGroupReport` types have been restructured. If you import these types, update your code as follows.

Before:

```ts
interface TargetGroupReport {
  emittedFiles: string[];
  warnings: string[];
  errors: string[];
  // ...
}
```

After:

```ts
interface TargetGroupReport {
  passes: PassReport[];   // per-pass (js / dts / loose / exe / meta)
  warnings: DiagnosticEntry[];
  errors: DiagnosticEntry[];
  // ...
}

interface PassReport {
  id: "js" | "dts" | "loose" | "exe" | "meta";
  files: EmittedFile[];
  ms: number;
}

interface DiagnosticEntry {
  source: "tsdown" | "rolldown" | "api-extractor";
  level: "warn" | "error";
  text: string;
  file?: string;
  line?: number;
  column?: number;
}
```

New exported types: `DiagnosticEntry`, `DiagnosticInput`, `EmittedFile`, `PassKind`, `PassReport`, `TsdownLogger`.

### Quiet terminal output with optional verbose detail

The terminal formatter is now quiet by default: one summary line per target group showing file count and elapsed time. Pass `verbose: true` (via the collector options or the `--verbose` CLI flag on the bundler) to emit the full per-file listing. Markdown and CI-annotation formatters consume the structured `DiagnosticEntry` objects directly.
