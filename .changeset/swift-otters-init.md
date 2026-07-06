---
"@savvy-web/cli": minor
---

## Features

- `savvy init` now writes `@savvy-web/changelog` as the canonical `changelog` id in fresh and patched `.changeset/config.json` files. The prior `@savvy-web/silk/changesets/changelog` shim id and the pre-merge `@savvy-web/changesets/changelog` id are still accepted by `init --check`, so existing repos migrate lazily on their next `savvy init`.
