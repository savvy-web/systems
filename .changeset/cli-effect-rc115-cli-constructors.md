---
"@savvy-web/cli": patch
---

## Refactoring

* Ported every `savvy` command definition to the PascalCase `effect/unstable/cli` constructors introduced in Effect `4.0.0-rc.113` (`Flag.String`, `Flag.Boolean`, `Flag.Directory`, `Flag.File`, `Flag.Literals`, `Argument.String`, `Argument.Directory`, `Argument.File`). Command names, flags, defaults and behaviour are unchanged.
