---
type: Decision
title: silk pins siblings as dependencies, never peers
description: "@savvy-web/silk declares cli, mcp, changelog, and silk-effects as exact-pinned regular dependencies rather than peerDependencies, because publishing them as peers made pnpm's autoInstallPeers propagate their Effect graph into consumers at the wrong version."
status: draft
tags: [release, architecture]
sources:
  - id: layering
    resource: ../../packages/silk/package.json
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 5cd8a3006c7362ccb0a7b84475b7599cd05f60305b9bce2bc2a40bbac4dc2871
---

# silk pins siblings as dependencies, never peers

## Context

`@savvy-web/silk` declares `@savvy-web/cli`, `@savvy-web/mcp`, `@savvy-web/changelog`, and `@savvy-web/silk-effects` — a real runtime dependency, since nine `src/` files import it — as source `workspace:*` dependencies. All packages in the repo version independently: `.changeset/config.json` has no `fixed` or `linked` arrays, so a decision was needed about where these four edges belong in the published manifest.[^claude-md]

Two rules decide where any dependency entry goes: a peer is a tool the consumer runs itself, and a load-bearing dependency stays a dependency even when no source file directly imports it, because it satisfies a transitive peer requirement elsewhere in the graph. silk's `peerDependencies` were audited entry by entry — biome, changesets, commitlint, husky, lint-staged, markdownlint-cli2, turbo, typescript, tsx, vitest/vite and their companions — and every one is invoked by the consumer's own scripts or hooks.[^layering]

## Decision

`@savvy-web/cli`, `@savvy-web/mcp`, and `@savvy-web/changelog` are deliberately **not** peers of silk. They ship as exact-pinned regular `dependencies` (source `workspace:*`, which changesets reads as the exact current version, published as an exact pin), never promoted to peerDependencies.[^claude-md][^layering]

Because changesets reads `workspace:*` as the exact current version, a cli/mcp/changelog release auto-PATCH-bumps silk (`updateInternalDependencies: patch`) and re-pins it, so silk stays exactly pinned to the other three automatically without silk/cli/mcp/changelog being a fixed changeset group. Plain `dependencies` — never source peerDependencies — also means silk is not force-major-bumped by a sibling's major release. The bins reach consumers through silk's own `bin` map, not through hoisting: `@savvy-web/pnpm-plugin-silk` no longer hoists cli/mcp, only `@savvy-web/changelog` (resolved by id, not by bin, from the consumer root).[^claude-md]

`dependencies` blocks of silk, cli, and mcp additionally list `@effected/commands`, `@effected/git`, `@effected/workspaces`, and `effect`, although few or no files under `src/` import them directly: they satisfy [silk-effects](../modules/silk-effects.md)'s required peers. Removing one silently breaks installs — a duplicated kit copy under pnpm's `autoInstallPeers`, or `ERR_MODULE_NOT_FOUND` under yarn — not any lint pass, so a "remove unused dependency" cleanup on these packages must check the peer graph first. silk's build transform keeps them on its explicit published-manifest allowlist for the same reason.[^layering]

## Alternatives rejected

- **Publish cli/mcp/changelog as silk `peerDependencies`.** Tried and rejected: publishing them as peers made pnpm's `autoInstallPeers` propagate their Effect graph into consumers at the wrong versions, since a peer range is satisfied by whatever the consumer's own tree already resolves rather than the version silk was built and tested against.[^layering]
- **Promote silk-effects to a peer of silk.** Rejected on the same principle as above — silk-effects is a real runtime dependency of silk's config shims (nine `src/` files import it), not a tool the consumer runs itself, so it stays a regular `dependencies` entry declared honestly rather than a devDependency the build transform re-injects.[^layering]

## Consequences

- Silk always ships with the exact cli/mcp/changelog versions it was tested against; a consumer cannot silently get a mismatched sibling version the way a peer range would allow.
- A cli/mcp/changelog release auto-patch-bumps and re-pins silk without a fixed/linked changeset group, keeping [independent package versioning](independent-package-versioning.md) intact for the four packages individually.
- Removing an apparently-unused entry from cli/mcp/silk's `dependencies` requires checking the [kit-effect-peers-via-catalog](kit-effect-peers-via-catalog.md) peer graph first, since the lint surface will not catch a peer-satisfying dependency going missing.
- See [carrier-pattern-package-graph](carrier-pattern-package-graph.md) for the bin-ownership half of this decision.

[^layering]: `../../packages/silk/package.json`
[^claude-md]: ../../CLAUDE.md
