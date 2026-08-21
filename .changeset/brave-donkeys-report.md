---
"@savvy-web/mcp": minor
---

## Bug Fixes

`biome_check` reported every diagnostic one level more severe than the project's own `biome check` does. A project **warning** came back as `severity: "error"` counted in `errors`, with `warnings: 0` and no `originalSeverity` — indistinguishable at the call site from a real error, and the opposite of what the tool documents. A green repository read as red.

The cause was the reporter severity table. Biome's GitLab reporter encodes its own severity as `Hint => info`, `Information => minor`, `Warning => major`, `Error => critical`, `Fatal => blocker`; the tool read `minor` as a warning and `major` and above as errors, shifting every level by one. The mapping is now the exact inverse of Biome's, so severities match the project config as documented and `strict` remains the only thing that promotes a warning.

* A Biome warning is now reported as `warning`, not `error`
* A Biome information diagnostic is now reported as `info`, not `warning`
* `summary.errors` and `summary.warnings` now agree with `biome check`

## Features

`biome_check` now accepts a `cwd` inside a git worktree of the same repository, and contains the run to that worktree. Previously any worktree path was rejected as escaping the workspace root, and agents had to fall back to repo scripts — worse, a root-bound run silently operated on the main checkout, which during parallel work is another agent's tree.

A `cwd` outside the workspace root is accepted only when it shares a git common directory with it; anything else is still rejected, and path containment then follows the worktree rather than the server's start directory.
