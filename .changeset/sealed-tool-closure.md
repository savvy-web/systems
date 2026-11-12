---
"@savvy-web/silk": patch
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
"@savvy-web/changelog": patch
"@savvy-web/silk-effects": patch
"@savvy-web/silk-core": patch
---

## Bug Fixes

The `savvy` and `savvy-mcp` tools now pin their whole dependency closure exactly. A fresh install runs the same `effect`, `@effected/*` and in-repo package versions they were tested with, so a later Effect or kit patch can no longer change their behaviour or break them at import without a new release. `@savvy-web/silk`, `@savvy-web/cli`, `@savvy-web/mcp` and `@savvy-web/changelog` publish plain versions for every kit dependency and for `@savvy-web/silk-effects`. `@savvy-web/silk-effects` does the same for `@savvy-web/silk-core` and its regular kit dependencies.

`@savvy-web/silk-effects` and `@savvy-web/silk-core` keep their `peerDependencies` as ranges, so code that imports them as libraries still shares one copy of `effect` and the kit with its host. `@savvy-web/mcp`, `@savvy-web/silk` and `@savvy-web/changelog` now also declare `@effected/jsonc`, `@effected/toml` and `@effected/yaml`, which `@effected/markdown` needs to read changeset front matter.
