---
"@savvy-web/cli": minor
---

## Features

Adds `savvy commit lint <file>`, which validates a candidate commit-message file against the real Silk commitlint preset — the same rule engine the `commit-msg` hook enforces — before the commit is created.

* Runs `commitlint --edit <file>` via the detected package manager, so rejecting rules (`header-max-length`, `body-max-line-length`, `type-enum`, `subject-full-stop`, `signed-off-by`) actually gate the message, unlike the advisory heuristics in `commit hook pre-commit-message`.
* Exits non-zero when the message is rejected and 0 when it passes, surfacing commitlint's own output so you see the exact violations.
* Fills the gap between `hook pre-commit-message` (advisory only) and `hook post-commit-verify` (runs the real engine, but only after a commit already exists): there is now a CLI path to answer "would this message pass?" up front.
