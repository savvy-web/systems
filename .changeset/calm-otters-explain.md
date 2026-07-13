---
"@savvy-web/silk": patch
---

## Documentation

* Documents that plugin hook scripts intentionally commit without an executable bit (`100644`). The lint-staged `ShellScripts` handler strips the exec bit from staged `.sh` files, and every hook is invoked as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."`, so the bit is never exercised. Prevents mistaking a `644` mode on a hook script for accidental permission drift during review.
