---
"@savvy-web/silk": minor
---

## Features

* The `commit-create` skill now ships two bundled scripts. `scripts/validate-message.sh` measures every line of a candidate commit message against the real thresholds (reporting exact line numbers and lengths) and then gates on the actual commitlint preset, so it cannot drift from the rules the `commit-msg` hook enforces. `scripts/commit.sh` validates and, only on success, execs `git commit` in the same process — there is no separate step to skip, and it refuses `--no-verify`. The skill now mandates the wrapper as the only commit path.
* The `build` skill now auto-loads on `**/package.json` and `**/turbo.json` as well as `**/savvy.build.ts`. Because those globs fire on files that have nothing to do with the bundler, it opens with a concrete check for whether the file belongs to a `@savvy-web/bundler` or `@savvy-web/rspress-builder` package and tells the agent to move on if not. It documents the package.json script contract, the `prepare` rule, and what `turbo.json`'s `dependsOn` does and does not order.

## Bug Fixes

* The `commit-create` skill told agents to write each body paragraph as one continuous line because "the 300-character-per-line limit makes wrapping unnecessary". That guidance walked agents straight into `body-max-line-length` rejections, which surface only after a full lint-staged cycle. It now gives a safe target well below the ceiling and points at the validator rather than asking agents to eyeball a 300-character limit.
* The `commit-create` skill claimed subject case was enforced. It is not — `subject-case` is explicitly disabled in the Silk preset. Corrected to a style preference.
* The `commit-create` skill never documented `footer-max-line-length` (100 characters), which applies to trailer lines including `Signed-off-by` and `Closes`, and can reject a commit on its own.
* The plugin's test harness now shellchecks skill scripts under `skills/`, not just `hooks/`, `bin/`, and `tests/`. The bundled `skills/changeset/scripts/list.sh` had never been linted by the harness.
