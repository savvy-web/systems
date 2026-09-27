---
"@savvy-web/cli": minor
---

## Features

* A usage error now exits `64` with the help text on stderr and stdout left empty, so a caller parsing stdout never sees help mixed in with an error. Passing `--help` or invoking a command group bare still prints help on stdout and exits `0`.
* An unexpected defect — a bug in `savvy`, not an expected failure — now prints a multi-line issue report: a headline, the full pretty-printed cause with its stack, and where to file it. A typed failure still reads as a single line (its own message, else its tag and fields).

## Bug Fixes

* Fixed `ERR_MODULE_NOT_FOUND 'redis'` on Yarn 1 installs by importing `NodeRuntime`/`NodeServices` from `@effect/platform-node`'s subpaths instead of the package root.
