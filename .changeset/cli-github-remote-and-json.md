---
"@savvy-web/cli": patch
---

## Bug Fixes

- `savvy changeset init` keeps a dot in the repository name it reads from the `origin` remote (`owner/repo.js` was read as `owner/repo`), and no longer takes a host that merely ends in `github.com` for GitHub.
- `savvy repos status --json` and `savvy changeset deps detect` print their JSON through `@effected/cli`'s `CliFormat.printJson`. The output is unchanged, except that under GitHub Actions a workflow-command sequence inside a value is neutralised.
