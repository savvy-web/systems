---
"@savvy-web/tsdown-plugins": minor
---

## Features

Threaded a new `emitDts?: boolean` option through the public build interfaces so `@savvy-web/bundler` can skip declaration generation on prod builds:

* `BuildTargetGroupsOptions`, `EmitManifestOptions`, `BuildEmittedManifestOptions`, and `TransformManifestOptions` all accept `emitDts`
* `transformExports` accepts the flag and, when dts is skipped, omits the `types` condition from generated `exports` entries so they never point at declarations that were never written
* Default is `true`, matching today's behavior when the option is omitted

See #198.
