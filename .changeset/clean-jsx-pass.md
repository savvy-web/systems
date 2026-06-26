---
"@savvy-web/bundler": patch
---

## Bug Fixes

Removed the `jsx` forward from `run.ts` into the `buildTargetGroups` call. JSX builds — including RSPress runtime builds via `@savvy-web/rspress-builder` — no longer emit a spurious rolldown "Invalid input options" warning. Emitted JS and `.d.ts` output is unchanged.
