---
"@savvy-web/silk-effects": major
---

## Breaking Changes

- The library now targets `effect@4` and peers on `catalog:effectPeers`; the `@effect/platform` peer is dropped because its abstractions moved into core `effect`.
- All 19 services convert from `Context.Tag` to class-based `Context.Service`, and each now exports a companion `*Shape` interface for structural consumers.
- Result schemas, tagged errors, and value objects are rebuilt on the v4 `Schema` surface; consumers that embed these types (notably the MCP tool contracts) must update to the v4 shapes.

## Other

- Git invocation unifies onto `@effected/git`, including the repos manager's full mutating tier; workspace discovery moves to `@effected/workspaces` with deterministic per-package root derivation.
- Glob, JSONC, YAML, and directory walking adopt `@effected/glob`, `@effected/jsonc`, `@effected/yaml`, and `@effected/walker`, retiring the hand-rolled glob walker for `Walker.descend`.
