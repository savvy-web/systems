---
"@savvy-web/mcp": patch
---

## Bug Fixes

* Fixed a fresh-install crash on startup: `ERR_MODULE_NOT_FOUND` for `effect/process/ChildProcess` (or a sibling `effect` submodule) coming out of `@effect/platform-node`. The caret range `@effect/platform-node` carried on `@effect/platform-node-shared` could resolve a build of `-shared` that only ships modules present in a newer `effect` than the one actually installed alongside it. The suite now pins `effect` at `4.0.0-rc.118` throughout, matching the `@effect/platform-node-shared` build the `savvy-mcp` binary actually runs against, so `npx @savvy-web/mcp` starts cleanly on a fresh install.
* Strict-tool parameter validation errors (e.g. calling `repos_manage` with keys its chosen `action` doesn't take) now report through the Effect core all-errors path: `Invalid parameters for tool '<name>': Expected no excess property\n  at ["key"]`, one problem per offending key, followed by `Accepted params at the root: action, cwd.` This replaces the previous `Unrecognized parameter(s): ... Accepted params: ...` sentence. The change is a wording change only — invalid calls still fail the same way — but any client-side string matching on the old sentence should be updated.
