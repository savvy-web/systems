---
id: standards/turbo/boundaries
title: Turborepo boundaries
summary: Tags and allow/deny rules for enforcing package dependency layering.
tier: standards
source: hand
tags: [turbo, workspace, dependencies]
priority: 0.5
related: [standards/dependency-conventions, standards/turbo/best-practices]
---

## Rule

`turbo boundaries` enforces **who may depend on whom** by tagging packages and
declaring allow/deny rules between tags. It turns an architectural invariant —
"the CLI must not import silk," "mcp depends on neither cli nor silk" — into a
checked rule rather than a convention people remember.

## Tagging packages

Tag each package in its `turbo.json` (or the package's `turbo` config):

```jsonc
// packages/cli/turbo.json
{ "tags": ["app"] }

// packages/silk-effects/turbo.json
{ "tags": ["lib"] }
```

## Allow / deny rules

Declare the permitted dependency directions at the root:

```jsonc
{
  "boundaries": {
    "tags": {
      "app": { "dependencies": { "allow": ["lib"] } },
      "lib": { "dependencies": { "deny": ["app"] } }
    }
  }
}
```

Run the check with:

```bash
turbo boundaries
```

It fails when an import crosses a denied edge — catching, for example, a stray
`@savvy-web/silk` import inside `@savvy-web/cli` that would violate the cli↔silk
non-import invariant, or an attempt to import cli/silk from mcp.

## Why encode it

The cli↔silk↔mcp non-import invariant is load-bearing: the three packages depend
only on silk-effects within the repo. A reviewer can miss a new import; a
boundaries rule cannot. Encoding the layering also documents intent — the tag
graph is the dependency policy, version-controlled next to the code.

## Anti-patterns

Do not tag packages so loosely that every package can depend on every other —
that yields green checks with zero protection. Tag by architectural layer
(`app`, `lib`, `tooling`) so the deny rules actually constrain the graph.

## See also

The underlying import rules are at `silk://standards/dependency-conventions`.
Graph-correctness practices are at `silk://standards/turbo/best-practices`.
