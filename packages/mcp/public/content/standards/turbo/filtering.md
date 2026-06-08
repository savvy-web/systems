---
id: standards/turbo/filtering
title: Turborepo task filtering
summary: --filter syntax, dependency/dependent expansion, changed-since filters, and --affected.
tier: standards
source: hand
tags: [turbo, workspace, build]
priority: 0.6
related: [standards/turbo/ci, standards/turbo/best-practices]
---

## Rule

`--filter` selects which packages a task runs in. Stack filters (each `--filter`
is a union) and lean on the dependency-expansion operators so you never have to
list packages by hand.

## Package selectors

```bash
turbo run build --filter=@savvy-web/mcp          # one package
turbo run build --filter='./packages/*'          # by directory glob
turbo run build --filter='@savvy-web/*'          # by name glob
```

## Dependency / dependent expansion

The `...` operator pulls in the rest of the graph relative to a package:

| Selector | Meaning |
| :--- | :--- |
| `@savvy-web/mcp...` | mcp **and everything it depends on** |
| `...@savvy-web/mcp` | mcp **and everything that depends on it** |
| `...@savvy-web/silk-effects...` | the package plus dependents and dependencies |
| `@savvy-web/mcp^...` | mcp's dependencies only (exclude mcp itself) |

`...@savvy-web/silk-effects` is the practical way to rebuild the four libraries'
downstream consumers (cli, silk, mcp) after a shared-library edit, without
naming each one.

## Changed-since filters

`[<git-ref>]` restricts to packages changed since a ref, and composes with `...`:

```bash
turbo run test --filter='[origin/main]'              # changed vs main
turbo run test --filter='...[origin/main...HEAD]'    # changed + their dependents
turbo run build --filter='@savvy-web/mcp[HEAD^1]'    # mcp, only if it changed
```

## --affected

`--affected` is the ergonomic shorthand for "changed vs the merge base, plus
dependents," with the base/head auto-detected in CI:

```bash
turbo run lint test typecheck --affected
```

Prefer `--affected` in CI and reserve explicit `[<ref>]` filters for cases where
you need a non-default base. Both need real git history — a shallow checkout
over-selects.

## Anti-patterns

Do not chain `cd packages/foo && pnpm build` to scope a build; you lose turbo's
cache and topological ordering. Use `--filter` so dependencies still build first
and cache hits still count.

## See also

Using filters in CI is at `silk://standards/turbo/ci`.
