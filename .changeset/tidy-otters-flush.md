---
"@savvy-web/github-action-effects": patch
---

## Bug Fixes

* `ActionLogger.withBuffer` now flushes its buffered transcript on every exit — success, failure, or interruption — instead of only on failure. Previously a clean run silently discarded all `info`-level output captured during the run.
* `withBuffer` now also honors the runner's `RUNNER_DEBUG=1` environment variable directly, passing logs through unbuffered. Previously the debug bypass only checked the ambient `MinimumLogLevel`, which consumers setting their log level inside the wrapped effect could never satisfy.
* `ActionLoggerTest.withBuffer` mirrors the corrected live semantics: `flushedBuffers` now records a flush on every exit and the `RUNNER_DEBUG=1` pass-through applies, so tests written against the test layer match production behavior.
