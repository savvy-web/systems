---
"@savvy-web/bundler": minor
---

## Features

API Extractor diagnostics now surface in the build log when you run `runBuild`. Forgotten exports, missing release tags, and TSDoc issues that were previously dropped by API Extractor's default message routing are now reported as warnings during the meta-generation pass. Suppressed messages are accounted for: the build log summarizes how many messages each `suppressWarnings` rule hid, grouped by message id, with `--verbose` listing them in full.

## Breaking Changes

Forgotten exports now fail the build in CI. When `CI` or `GITHUB_ACTIONS` is set, an unsuppressed `ae-forgotten-export` diagnostic is a hard error that aborts the build. Locally it stays a warning, tagged in the build log to indicate it will fail CI.

To suppress the error (and its local warning), add the rule to `tsdoc.suppressWarnings` in your `defineBuild` config:

```ts
const config = defineBuild({
  meta: {
    tsdoc: {
      suppressWarnings: [{ messageId: "ae-forgotten-export" }],
    },
  },
});
```
