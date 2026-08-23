---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### `@effected/workspaces`, `@effected/git` and `@effected/commands` are now required peer dependencies

These three are no longer installed for you. Declare them yourself, or your install will report an unmet peer.

```jsonc
{
  "dependencies": {
    "@effected/commands": "catalog:effected",
    "@effected/git": "catalog:effected",
    "@effected/workspaces": "catalog:effected"
  }
}
```

If you consume the `@effected/pnpm-plugin-effect` config dependency at `0.6.0` or later, prefer the catalog
references above so both sides of the peer relationship move together on a single config bump. Otherwise declare
literal ranges — `@effected/commands@^0.5.0`, `@effected/git@^0.9.0`, `@effected/workspaces@^0.17.0`.

**Why this is breaking on purpose.** Consuming this package both directly and transitively — through
`@savvy-web/silk` to `cli`/`mcp` — used to put two copies of it in one tree whenever the direct pin drifted, and
each copy dragged its own kit. Both were bundled into the resulting artifact. Nothing failed; the build stayed
green and shipped two of everything.

As peers, that skew is loud instead. Because `0.x` caret ranges are disjoint across minors, a mismatched consumer
now fails to resolve rather than silently duplicating, and the upgrade action holds automerge until it is fixed.
Two copies also mean two type identities, so a mismatch surfaces at `tsc` as an unsatisfiable `Layer` rather than
at runtime.

Only these three moved. They are the packages whose services and types cross this package's public API boundary —
`WorkspaceSnapshots` in `DepsRegen.layer`, `Git` in the service layers, `ToolDiscovery` in `TurboInspector`. The
other seven `@effected/*` dependencies remain ordinary dependencies: a duplicate of a pure-function package costs
bytes, not correctness.

## Dependencies

| Dependency           | Type           | Action  | From    | To      |
| :------------------- | :------------- | :------ | :------ | :------ |
| @effected/commands   | peerDependency | added   | —       | ^0.5.0  |
| @effected/git        | peerDependency | added   | —       | ^0.9.0  |
| @effected/workspaces | peerDependency | added   | —       | ^0.17.0 |
| @effected/workspaces | dependency     | removed | ^0.17.0 | —       |
| @effected/workspaces | devDependency  | added   | —       | ^0.17.1 |
