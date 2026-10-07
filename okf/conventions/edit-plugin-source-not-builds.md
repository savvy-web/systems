---
type: Convention
title: Edit the plugin source, never plugin/builds/; rebuild and commit the builds with it
description: "Change the silk plugin only under plugin/ (config, skills, agents, hooks, bin, monitors, scripts), never under plugin/builds/; run pluginfinity build and commit the regenerated builds in the same change, since build --check fails on any drift between them, and give any plugin directory named like an ignored output directory its own .gitignore exception."
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
  - id: gitignore
    resource: ../../.gitignore
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:43:24Z
  body_sha256: bcb738f92e5cdc1be0fecffa38d0784fee082d13efe31504e9ff8f2d14194d46
---

# Edit the plugin source, never plugin/builds/; rebuild and commit the builds with it

Make every change to the silk plugin under `plugin/`: `pluginfinity.config.ts` for manifest fields, hook registrations, servers, monitors and session variables; `skills/`, `agents/`, `hooks/`, `bin/`, `monitors/` and `scripts/` for content. Never edit a file under `plugin/builds/claude/` or `plugin/builds/copilot/`. Both are generated, and the next build overwrites a hand edit.[^manifest]

Rebuild after every source change and commit the builds in the same commit as the source. `pnpm build` (or `pnpm --filter @savvy-web/ai-plugins build:dev`) runs `pluginfinity build`. `pnpm test:hooks` runs it too, as its first step, then finishes with `pluginfinity build --check`. That check compares the committed builds byte for byte with a fresh build and fails on any difference, including file modes.[^manifest][^run-tests]

Do not format, lint-fix or hand-tidy `plugin/builds/**`. Biome and markdownlint are switched off there (the root `biome.json` override, the markdownlint ignore list and the lint-staged excludes), because a rewritten build fails `--check`. lint-staged's `chmod -x` still runs over the builds on purpose: it strips the exec bit from a built script and its source in the same commit, so their modes stay equal.[^lint-staged][^biome]

Give any directory under `plugin/` whose name matches a repo-wide ignore rule a `.gitignore` exception, in the source and in both builds, in the same change that adds it. The root `.gitignore` ignores `**/build` (and `**/dist`, `**/.turbo` and the other output directories), so a skill directory named `build` is ignored at `plugin/skills/build/` and at `plugin/builds/*/skills/build/` unless a negation re-includes it; the current exceptions are `!plugin/skills/build/`, `!plugin/builds/*/skills/build/` and their `/**` children.[^gitignore] Check with `git check-ignore -v <path>` and `git ls-files <dir>`, never with `build --check`: the check compares files on disk, so it passes on a directory git never tracked, and [gitignore-build-rule-hides-plugin-build-skill](../gotchas/gitignore-build-rule-hides-plugin-build-skill.md) is what that looks like.

Write Markdown in `plugin/skills` and `plugin/agents` with the host-block markers inside a list indented to the item's content column. A marker at column 0 ends the list, and markdownlint's `--fix` at pre-commit then renumbers it: [markdownlint-fix-renumbers-host-block-lists](../gotchas/markdownlint-fix-renumbers-host-block-lists.md).

See [adopt-pluginfinity-one-source-two-hosts](../decisions/adopt-pluginfinity-one-source-two-hosts.md) for why the builds are committed at all, and [silk-plugin](../modules/silk-plugin.md) for the layout.

[^manifest]: `../../plugin/package.json`
[^run-tests]: `../../plugin/__test__/run-tests.sh`
[^lint-staged]: `../../lib/configs/lint-staged.config.ts`
[^biome]: `../../biome.json`
[^gitignore]: `../../.gitignore`
