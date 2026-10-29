---
"@savvy-web/bundler": patch
---

## Refactoring

- The build report's colour decision reads `@effected/env`'s pure `TerminalEnv.colorLevelFrom` instead of building a stand-in `Stdio` layer. The rule is unchanged: `FORCE_COLOR` decides alone when set, then a non-TTY stdout, `NO_COLOR` / `TERM=dumb`, and the terminal table.
