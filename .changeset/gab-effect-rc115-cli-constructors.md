---
"@savvy-web/github-action-builder": patch
---

## Refactoring

* Ported the `build` and `init` CLI command definitions to the PascalCase `effect/unstable/cli` constructors introduced in Effect `4.0.0-rc.113` (`Flag.File`, `Flag.Boolean`, `Argument.String`). Command names, flags, defaults and behaviour are unchanged.
