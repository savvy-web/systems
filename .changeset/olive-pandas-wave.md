---
"@savvy-web/cli": minor
---

## Bug Fixes

### Pull-request bodies are no longer held to the commit-message rules

`savvy commit hook pre-commit-message` applied every commit-body rule to a `gh pr create`/`gh pr edit` body. The load-bearing consequence was `forbidden-content`, which denies any line opening with a markdown header or a code fence: the release PR body this ecosystem generates carries a `proposed-squash-commit` fence by design, so posting the canonical body through `gh` was blocked outright.

`forbidden-content`, `verbosity` and `soft-wrap` now run only for `git commit` and `git commit --amend`. A PR summary is a markdown document that is supposed to be long, and a soft-wrapped bullet is ordinary markdown there.

`plan-leakage` and `closes-trailer` still run for both. A public PR body should no more cite an internal design doc than a commit should, and both documents want their issues linked.
