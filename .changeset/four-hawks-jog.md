---
"@savvy-web/github-action-builder": patch
---

## Bug Fixes

Restores default values for CLI boolean flags dropped during the Effect v3 -> v4 CLI migration. `Options.boolean(...)` was rewritten as `Flag.boolean(...)`, but the accompanying `Options.withDefault(false)` calls were not carried over — in `effect/unstable/cli` a bare `Flag.boolean` is required, not optional.

* `build` no longer requires passing `--quiet --no-validate --no-persist` just to run with default behavior
* `init` no longer requires passing `--force` just to run with default behavior
* Adds a structural regression test asserting every `Flag.boolean` declaration in `src/cli/commands` carries a default
