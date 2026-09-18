---
"@savvy-web/changelog": major
---

## Breaking Changes

The package is now ESM-only. The `require` export condition is gone, and the build no longer bundles its dependencies for a CommonJS consumer.

This requires `@changesets/cli` v3 or later, which loads changelog generators via dynamic `import()` rather than `require()`. Consumers still on `@changesets/cli` 2.x will fail to load this package as their configured changelog generator.

* `@savvy-web/silk-effects`, `effect`, `@effected/commands`, `@effected/git`, and `@effected/workspaces` move from bundled devDependencies to externalized regular `dependencies` — they are resolved at install time rather than inlined into the build output.

### Migration

Upgrade `@changesets/cli` to v3 or later alongside this package.
