---
"@savvy-web/cli": patch
---

## Bug Fixes

- A cancelled prompt (Esc, Ctrl-C) or a prompt refused in a non-interactive run no longer prints the "This is a bug in savvy" footer; it gets the kit's fixed one-line report, matching the `isCancelled` and `isNotInteractive` flags `@effected/cli` 0.13 adds to `FailureDetails`.
