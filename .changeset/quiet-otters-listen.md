---
"@savvy-web/silk-effects": major
---

## Breaking Changes

`@effected/templates` is now a required peer dependency. silk-effects re-exports silk-core's `SavvySections`/`SavvyOkfSection`/`SavvyInstallSection` schemas, which build on `@effected/templates`' nominal `Section`, `CommentStyle`, and `SectionId` classes, and silk-effects also imports the package directly — so it forwards the peer silk-core now declares.

If your project installs `@savvy-web/silk-effects` directly and previously relied on `@effected/templates` arriving transitively, add it explicitly:

```bash
pnpm add @effected/templates
```

The peer ranges for `@effected/commands`, `@effected/git`, `@effected/templates`, `@effected/workspaces`, and `effect` also widened to accept any compatible minor release rather than only the current patch.
