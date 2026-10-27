---
"@savvy-web/cli": patch
---

## Bug Fixes

* `savvy commit lint` and the post-commit verify hook now run commitlint through a shared command runner. Under bun the invocation is `bun x --no-install commitlint` (no auto-install) instead of `bunx`.
* A missing launcher reports a clear command-failed message.
* Errors thrown as non-`Error` objects with a `message` now print that message instead of `[object Object]` (`clean`, `changeset init`).
* `changeset lint`, `check` and `validate-file` report file-relative line numbers.
* A file under the working directory whose name starts with `..` (for example `..notes.md`) is now shown as a relative path in lint annotations.
