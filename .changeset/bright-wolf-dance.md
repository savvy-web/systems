---
"@savvy-web/bundler": minor
---

## Features

### Unified build log

`runBuild` now threads a `BuildCollector` through every phase (dev, prod, exe, meta) and renders a single unified build report at the end, replacing the previous output that interleaved raw tsdown console lines with a hollow "0 files emitted" summary. The report groups output by target group, shows file counts and timing per pass, and surfaces any warnings or errors collected during the run.

### --verbose flag

Pass `--verbose` to `savvy build` to include a full per-file listing (path and size) in the build report.

```sh
savvy build --target dev
# npm   3 files  1.24s
# prod  6 files  2.01s

savvy build --target dev --verbose
# npm
#   dist/dev/pkg/index.js          12.4 kB
#   dist/dev/pkg/index.d.ts         3.1 kB
#   ...
```

### Diagnostics surfaced on failure

When a build phase fails, any warnings and errors collected up to that point are rendered before the error propagates. Previously diagnostics were swallowed and only the raw exception was shown.

The escape-hatch `savvy.build.ts` self-host scripts emit the same unified log.
