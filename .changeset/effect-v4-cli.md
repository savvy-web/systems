---
"@savvy-web/cli": major
---

## Breaking Changes

- The `savvy` binary is rebuilt on the in-core `effect/unstable/cli` framework; the dead `@effect/cli` dependency and eight unused `@effect/*` pins are removed.
- The `repos note` grammar moves the repo name after the operation (`savvy repos note add <name> <text>`), since v4's CLI framework has no parent-positional sharing.

## Other

- Git introspection in the commit and changeset hooks adopts `@effected/git` (`repoRoot`, `commitInfo`, `remoteUrl`).
