---
type: Convention
title: Edit the plugin source, never plugin/builds/; rebuild and commit the builds with it
description: "Change the silk plugin only under plugin/ (config, skills, agents, hooks, bin, monitors, scripts), never under plugin/builds/ or the legacy plugins/silk/; run pluginfinity build and commit the regenerated builds in the same change, since build --check fails on any drift between them."
status: draft
tags: [tooling, build]
stale_after: 2027-04-05T00:00:00Z
sources:
  - id: manifest
    resource: ../../plugin/package.json
  - id: run-tests
    resource: ../../plugin/__test__/run-tests.sh
  - id: lint-staged
    resource: ../../lib/configs/lint-staged.config.ts
  - id: biome
    resource: ../../biome.json
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 5a50d2540b09ba76c8c19f77d4434f2d5babdfe89e52cd5596626e934a865044
---

# Edit the plugin source, never plugin/builds/; rebuild and commit the builds with it

Make every change to the silk plugin under `plugin/`: `pluginfinity.config.ts` for manifest fields, hook registrations, servers, monitors and session variables; `skills/`, `agents/`, `hooks/`, `bin/`, `monitors/` and `scripts/` for content. Never edit a file under `plugin/builds/claude/` or `plugin/builds/copilot/`. Both are generated, and the next build overwrites a hand edit.[^manifest]

Never edit `plugins/silk/` either. It is the legacy copy kept only so the Claude marketplace and pull-request review keep working until the release branch deletes it. A fix made there is lost at removal, and a fix made only in `plugin/` does not reach the live Claude install until then.

Rebuild after every source change and commit the builds in the same commit as the source. `pnpm build` (or `pnpm --filter @savvy-web/ai-plugins build:dev`) runs `pluginfinity build`. `pnpm test:hooks` runs it too, as its first step, then finishes with `pluginfinity build --check`. That check compares the committed builds byte for byte with a fresh build and fails on any difference, including file modes.[^manifest][^run-tests]

Do not format, lint-fix or hand-tidy `plugin/builds/**`. Biome and markdownlint are switched off there (the root `biome.json` override, the markdownlint ignore list and the lint-staged excludes), because a rewritten build fails `--check`. lint-staged's `chmod -x` still runs over the builds on purpose: it strips the exec bit from a built script and its source in the same commit, so their modes stay equal.[^lint-staged][^biome]

Write Markdown in `plugin/skills` and `plugin/agents` with the host-block markers inside a list indented to the item's content column. A marker at column 0 ends the list, and markdownlint's `--fix` at pre-commit then renumbers it: [markdownlint-fix-renumbers-host-block-lists](../gotchas/markdownlint-fix-renumbers-host-block-lists.md).

See [adopt-pluginfinity-one-source-two-hosts](../decisions/adopt-pluginfinity-one-source-two-hosts.md) for why the builds are committed at all, and [silk-plugin](../modules/silk-plugin.md) for the layout.

[^manifest]: `../../plugin/package.json`
[^run-tests]: `../../plugin/__test__/run-tests.sh`
[^lint-staged]: `../../lib/configs/lint-staged.config.ts`
[^biome]: `../../biome.json`
