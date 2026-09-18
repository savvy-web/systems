---
"@savvy-web/silk-core": minor
---

## Breaking Changes

`@effected/templates` is now a required peer dependency instead of a regular dependency. Its `Section`, `CommentStyle`, and `SectionId` classes are nominal and appear in the exported `SavvySections`, `SavvyOkfSection`, and `SavvyInstallSection` schemas, so a consumer's own copy has to be the same one silk-core builds on — exactly like the existing `@effected/workspaces` peer.

If your project installs `@savvy-web/silk-core` directly and previously relied on `@effected/templates` arriving transitively, add it explicitly:

```bash
pnpm add @effected/templates
```

The peer ranges for `@effected/templates`, `@effected/workspaces`, and `effect` also widened to accept any compatible minor release rather than only the current patch.
