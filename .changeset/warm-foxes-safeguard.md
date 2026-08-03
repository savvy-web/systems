---
"@savvy-web/silk": minor
---

## Features

* New `biome-direct-deny.sh` pre-tool-use hook denies direct access to the Biome binary — bare, path-prefixed, `pnpm exec biome`, `npx`/`bunx`/`bun x`/`pnpm dlx`/`yarn dlx`, a scoped package name (`npx @biomejs/biome`, `bunx @biomejs/biome`), and prefix-wrapped forms — since a direct invocation does not resolve the repo's config and lints paths the config excludes (in this repo, that means the `.repos/**` vendored submodules, read-only and corruptible). Package-manager scripts of any name or form — `pnpm lint`, `pnpm --filter @savvy-web/cli lint`, `pnpm -r lint`, `turbo run lint` — are left alone entirely, since a script invocation always resolves `package.json` and therefore the config. Coverage of the direct-access rule is keyed to the script name across all four package managers, not to this repo's own package manager.
* New `journal-append.sh` script for the dogfood mailbox skill appends one complete state snapshot to a loop's journal, carrying forward the prior line's static fields and patching only what's passed, instead of requiring callers to hand-assemble the JSON object themselves.

## Bug Fixes

* The dogfood push guard (`dogfood-guard.sh`) is rekeyed from journal role/phase bookkeeping onto actual tree state: it now denies a `git push`/`gh pr create`/`gh pr edit` only when `pnpm-workspace.yaml`'s `overrides:` block actually carries a `file:`/`link:` path escaping the repo, rather than trusting a journal's last-recorded role. This closes a false-deny where a journal alone (with no override present) blocked a legitimate push (savvy-web/systems#387), without reopening the opposite failure of missing a real override with no journal yet (savvy-web/systems#332).

## Refactoring

* `hooks/lib/split-segments.sh` extracts the quote-aware, control-operator command segmenter and prefix peeler shared by `biome-prefer-mcp.sh` and `biome-direct-deny.sh` (widened to also peel `sudo`/`command`/`time` and the `bun x`/`pnpm dlx`/`yarn dlx` runner aliases), so a future fix to the segmentation logic only has to happen once.
* `@savvy-web/silk`'s re-export of `ConfigDiscoveryLive` from `@savvy-web/silk-effects` is removed, following that package's layer-static rename — use `ConfigDiscovery.layer` instead of the removed `ConfigDiscoveryLive` binding.

## Documentation

* Amendments to the dogfood mailbox protocol (`SKILL.md`, `references/jsonl-journal.md`, and `references/mail-kinds.md`) recording process learnings and precision fixes accumulated over the loop's use to date.
