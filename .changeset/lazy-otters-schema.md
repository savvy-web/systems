---
"@savvy-web/silk": minor
---

## Features

Expands schema-driven JSON validation coverage in the published Biome preset (`silk.jsonc`) to more of the repo's own config files, so editors and CI get schema-aware linting on them too:

* `.claude/settings.json` / `.claude/settings.local.json`
* `.claude/design/design.config.json`
* `.changeset/config.json`
* `**/.markdownlint.json` and `**/.markdownlint-cli2.jsonc`
* `**/devcontainer.json`
* `.repos/config.json`
* `.vscode/*.json`
* `**/biome.json` / `**/biome.jsonc` / `**/silk.jsonc`
* `**/.claude-plugin/plugin.json` and `**/.claude-plugin/marketplace.json`
