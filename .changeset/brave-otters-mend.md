---
"@savvy-web/cli": patch
---

## Bug Fixes

Fixed `savvy lint fmt pnpm-workspace` writing raw `@effected/yaml` output directly instead of routing through the same Prettier normalization the lint-staged handler applies. Running the subcommand (directly, or via the pre-commit hook) previously rewrote `pnpm-workspace.yaml` with unindented block sequences and single-quoted scalars. The subcommand now calls `Lint.PnpmWorkspace.formatContent` from `@savvy-web/silk-effects`, so both paths produce identical, idempotent output.

Corrected the requirements type parameter on the exported `changesetCommand` and `reposCommand`, which declared `never` while the commands actually required services. Effect 4.0.0-beta.99 propagates subcommand requirements into a parent group's type, so the annotations now name the real services. Runtime behavior is unchanged. Code that composes these commands and provides their services already type-checks; code that relied on the inaccurate `never` to skip providing a layer now fails at compile time instead of at runtime.
