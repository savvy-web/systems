---
type: Gotcha
status: draft
title: The repo-wide build ignore rule hides the plugin's build skill while build --check stays green
description: "The root .gitignore ignores every directory named build, which includes the silk plugin's build skill in plugin/ and in both committed builds; pluginfinity build --check compares files on disk, so it passes while git tracks none of them and the merged plugin ships without the skill."
resource: ../../.gitignore
tags: [tooling, build, dx]
stale_after: 2027-04-05T00:00:00Z
sources:
  - id: gitignore
    resource: ../../.gitignore
  - id: fix-commit
    resource: https://github.com/savvy-web/systems/commit/80f8ec3c5a942b0485e865d87d79caf942151a2e
  - id: run-tests
    resource: ../../plugin/__test__/run-tests.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:43:24Z
  body_sha256: fd3ec19befe0a6fbe861936652e11123530a6c50fedba7934e2eac1046ef0782
---

# The repo-wide build ignore rule hides the plugin's build skill while build --check stays green

## What you see

`plugin/skills/build/` exists in the working tree, `pluginfinity build` writes `skills/build/` into `plugin/builds/claude/` and `plugin/builds/copilot/`, and `pnpm test:hooks` ends with a green `pluginfinity build --check`.[^run-tests] `git status` is clean after the build.

## What you will wrongly conclude

That the build skill is committed and ships in both plugins, because the check that compares committed builds with a fresh build passed.

## What is actually true

The root `.gitignore` ignores `**/build`, so every directory named `build` is untracked unless a negation re-includes it.[^gitignore] `build --check` reads the builds from disk, not from git, so it compares two copies of files git never saw and passes. The clean `git status` is the ignore rule at work, not proof the files are tracked.

This happened at the pluginfinity cutover. The exception still named only the old `plugins/silk/skills/build/` path, so the pull request that moved the plugin to `plugin/` merged to `main` with both builds missing the build skill, and nothing local reported it. The fix added `!plugin/skills/build/` and `!plugin/builds/*/skills/build/`, each with its `/**` children.[^fix-commit]

Check tracking with `git ls-files plugin/skills/build plugin/builds/*/skills/build` or `git check-ignore -v <path>`, never with `build --check`. The rule that prevents a repeat is in [edit-plugin-source-not-builds](../conventions/edit-plugin-source-not-builds.md): any plugin directory named like an ignored output directory gets its own exception in the same change.

[^run-tests]: `../../plugin/__test__/run-tests.sh`
[^gitignore]: `../../.gitignore`
[^fix-commit]: <https://github.com/savvy-web/systems/commit/80f8ec3c5a942b0485e865d87d79caf942151a2e>
