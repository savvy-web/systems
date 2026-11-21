---
"@savvy-web/silk-effects": minor
---

## Features

`Lint.PnpmWorkspace` gains `formatContentSync`, `formatContentResult` and `formatContentEffect`, which stringify sorted `pnpm-workspace.yaml` content to the same canonical bytes as the lint handler without a Promise. A synchronous caller can now call it directly, and an Effect caller gets a typed `YamlStringifyError` instead of a defect. The Promise-returning `formatContent` now delegates to `formatContentSync`, so its output is unchanged, and it is deprecated in favour of the new forms; it will be removed in the next major.
