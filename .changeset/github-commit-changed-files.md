---
"@savvy-web/github-action-effects": minor
---

## Features

Added `GitHubCommit.changedFiles(ref)` — lists every file changed in a single commit, paginated via `repos.getCommit`. Unlike `compare`, which paginates by commit and therefore truncates a single-commit comparison to its first 300 files, `changedFiles` returns the complete set even for large (e.g. squash-merge) commits.

* `changedFiles` added to the `GitHubCommit` service interface, its live layer, and the test double
