---
"@savvy-web/silk-effects": patch
"@savvy-web/cli": patch
"@savvy-web/mcp": patch
---

## Bug Fixes

`localRegistrationDivergence` no longer calls a live registration stale. When local git config registers a submodule whose section `.gitmodules` still declares but the manifest does not, drift now reports a mid-add/remove transition with a non-destructive remedy (finish or revert the add/remove) instead of prescribing `deregister`. A registration absent from both `.gitmodules` and the manifest keeps the deregister remedy, now with a note that local git config is shared across branches, so switching back to a branch that still vendors the path is the cheaper fix.

`ReposManager.deregister` now refuses a section `.gitmodules` still declares, and refuses rather than guesses when `.gitmodules` cannot be parsed. `savvy repos deregister` no longer offers such a registration in its picker, and the `repos_manage` description lists the new refusal.
