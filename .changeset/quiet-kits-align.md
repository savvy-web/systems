---
"@savvy-web/silk-effects": minor
---

## Refactoring

Removed the `Commitlint` exports `parsePackageManagerField`, `detectFromLockfiles` and the `LockfilePresence` type. They had no remaining consumers. `Commitlint.detectPackageManager` keeps its signature but now uses the same package manager detector as `Lint`'s `Command`, so its results can differ in a few edge cases:

* `pnpm-workspace.yaml` takes precedence over the `packageManager` field
* A bare `bun.lock` or `yarn.lock` with no `packageManager` field resolves to `npm`
* A `devEngines.packageManager` array is no longer read
* An unparseable `package.json` resolves to `npm`

## Bug Fixes

* The changeset linter now handles CRLF frontmatter, and reported line numbers are relative to the file (a heading on line 5 of the file reports line 5, not line 2). A `---` pair in the middle of a document is no longer treated as frontmatter.
* `Repos` derives a repository's default name with a proper Git remote parser, so an scp-style remote without a slash (`git@host:repo.git`) now yields `repo` instead of `git@host:repo`. Input is trimmed.
* The commitlint hook's open-issues diagnostic validates `gh` output against a schema. A non-zero `gh` exit or wrong-shaped JSON now yields no issues and is not cached.
