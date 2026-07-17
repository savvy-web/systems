---
"@savvy-web/tsdown-plugins": minor
---

## Features

- Emit a trailing `default` exports condition mirroring the `import` target on every generated TypeScript export, so `require(esm)` resolves the ESM artifact on every supported Node runtime instead of failing with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Dual-format entries keep their dedicated CJS artifact under `require`, which wins by condition order.
