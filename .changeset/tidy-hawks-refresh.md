---
"@savvy-web/silk": minor
---

## Features

### Consolidated `silk_capabilities` orientation

The always-on SessionStart hook now emits a single `<silk_capabilities>` block instead of the old fragmented `workspace_info`/`turbo_inspect`/Biome/changesets-plugin sections: the full ten-tool savvy-mcp index, the three-agent index, the eight-skill index, the Biome LSP/`biome_check`/Bash division of labor, and an active-hooks map (commit guards, the Biome nudge, the `.repos/**` write guards, changeset validation, the missing-changeset note). It's a net reduction in context size while adding coverage for `savvy commit`, `tsdoctor`, `/silk:build`, and the vendored-repos pattern that the old payload didn't mention.

### `tsdoctor` and `turborepo` agents gain direct Biome access

Both agents now carry `mcp__plugin_silk_savvy-mcp__biome_check` in their tool allowlist, so they can run structured Biome checks and fixes directly instead of shelling out to Bash.

### `/silk:repos` pointer in vendored-repos orientation

The per-session vendored-repos block now points at the `/silk:repos` skill for the judgment layer — when to vendor, sparse-checkout discipline, the re-pin rule, and notes editorial policy.

## Bug Fixes

### Corrected pre-commit and tool-preference guidance

The startup context's tool-preference guidance previously taught Bash `biome check` as the primary path and wrongly claimed the root `typecheck` script runs `tsgo` directly. It now states the correct order — Biome LSP first (automatic diagnostics on edit), `biome_check` second (structured, can fix), Bash as the escape hatch — and adds a `pre_commit_pipeline` block enumerating every lint-staged autofix that runs on commit, including the intentional exec-bit strip on `.sh` files, so agents stop mistaking that mode flip for damage.
