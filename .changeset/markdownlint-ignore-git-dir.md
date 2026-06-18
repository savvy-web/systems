---
"@savvy-web/silk-effects": patch
"@savvy-web/cli": patch
---

## Bug Fixes

### markdownlint no longer lints files under `.git/`

The default markdownlint-cli2 config globs `**/*.{md,mdx}`, which swept ad-hoc session files under `.git/` (for example `.git/sdd/*.md`) and flagged them in the pre-commit hook. `**/.git` is now part of the default `ignores` list, so those files are excluded.

`savvy init` also reconciles `ignores` on an existing config now. On the silk preset without `--force` it previously synced only `$schema` and compared `config`, never touching `ignores`, so existing repos could not pick up new default excludes on a plain re-init. It now non-destructively appends any template ignores a repo is missing while preserving user-added entries — these are additive safety-excludes that cannot change a lint verdict, so they apply automatically, unlike `config` rules which stay warn-only.
