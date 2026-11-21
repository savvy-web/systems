---
"@savvy-web/ai-plugins": patch
---

## Documentation

- The dogfood skill now explains that a `file:` override cannot install while pnpm's `pnprServer` is set, because the pnpr server reports the local target as missing. It shows how to turn pnpr off for a linked install, either in the global config or with an isolated `XDG_CONFIG_HOME`, and lists the spellings that do not work on pnpm 12.x. Closes #808
