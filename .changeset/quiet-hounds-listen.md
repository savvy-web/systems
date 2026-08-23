---
"@savvy-web/mcp": minor
---

## Features

* `changeset_deps_regen` and `changeset_deps_detect` results now include a `coexisting` list of prose-only changesets that reference an in-scope package but weren't touched by the dependency regeneration pass
* `changeset_inspect` (branch and classify modes) now surfaces a machine-readable hint on files it can't attribute to a package, so callers can tell an unmapped path apart from one that used to map to a deleted `versionFiles`/`additionalScopes` entry or a known template mirror
* Server-side dependency diffs now resolve config-dependency-injected catalogs (e.g. `catalog:effected`) to their declared ranges instead of concrete lockfile versions, and file attribution now works correctly when the server is run from a git worktree rather than the primary checkout
