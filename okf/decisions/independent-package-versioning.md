---
type: Decision
title: Every package versions independently
description: "`.changeset/config.json` declares no fixed or linked groups; every one of the twelve published packages, including former linked groups, cuts its own release, with changesets bumping a dependent only when a release leaves its declared range, and npm-registry-only release posture where that applies."
status: stable
tags: [release]
sources:
  - id: claude-md
    resource: ../../CLAUDE.md
  - id: pnpm-plugin-silk-arch
    resource: ../../.changeset/config.json
generated:
  by: okfit/claude-code
  at: 2026-11-12T03:36:35Z
verified:
  - by: human:spencer
    at: 2026-10-07T16:50:25Z
  - by: human:spencer
    at: 2026-10-13T17:19:17Z
  - by: human:spencer
    at: 2026-10-23T15:45:32Z
  - by: human:spencer
    at: 2026-11-10T03:29:57Z
  - by: human:spencer
    at: 2026-11-10T15:51:59Z
integrity:
  generated:
    body: 783116bfe95b522d
  verified:
    by: human:spencer
    at: 2026-11-10T15:51:59Z
    content: cd7e15c02962b4c9
---

# Every package versions independently

## Context

Earlier in the repo's history, `bundler`, `rspress-builder`, and `tsdown-plugins` (all three since deleted) were a linked changeset group, and silk/cli/mcp were pinned together as a fixed group. Both arrangements coupled a package's release cadence to its siblings' regardless of whether a given change actually touched the sibling.[^claude-md]

## Decision

`.changeset/config.json` has no `fixed` or `linked` arrays: every package in the repo versions independently. silk/cli/mcp/changelog are not a fixed group; silk stays exactly pinned to the other three through the mechanism described in [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md) rather than through a changeset group.[^claude-md]

With the repo-wide `updateInternalDependencies: patch` setting and no `updateInternalDependents: "always"`, changesets (`@changesets/assemble-release-plan`) bumps a dependent only when the dependency's new version falls outside the dependent's declared range. An exact `workspace:*` edge therefore auto-patch-bumps its dependent on every release, while a caret `workspace:^` edge would propagate only a range-leaving release. Every runtime internal edge in the repo is now exact: silk→cli/mcp/changelog/silk-effects, cli/mcp/changelog→silk-effects and silk-effects→silk-core are all `workspace:*`, because the tool closure is sealed (see [tool-closure-exact-pins](tool-closure-exact-pins.md)). A silk-core or silk-effects release therefore patch-bumps every package above it up to silk. Either way, siblings stay consistent without a `fixed`/`linked` declaration coupling their own independent release decisions. silk has no `versionFiles` entry: the glob that once bumped the `plugins/*` plugin manifests in lockstep with silk went with the deleted `plugins/silk/` copy, and the plugin source versions on its own as `@savvy-web/ai-plugins`.[^pnpm-plugin-silk-arch]

`@savvy-web/pnpm-plugin-silk` versions independently like every other package and is additionally npm-registry-only — the one package in the repo not also published to GitHub Packages, because `private: true` in source with `publishConfig.access: public` and an npm-only `publishConfig.targets` target is what lets a config dependency install before any build tooling exists in a downstream repo.[^pnpm-plugin-silk-arch]

## Alternatives rejected

- **Keep silk/cli/mcp as a fixed group.** Rejected in favor of [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md): an exact-pinned `dependencies` entry plus `updateInternalDependencies: patch` gives silk the same effective pinning a fixed group would, without forcing cli or mcp's version number to move when only silk's config shims change.
- **Publish pnpm-plugin-silk to GitHub Packages as well.** Not pursued: a pnpm config dependency installs before a repo's own registry auth may be configured, so npm-registry-only is the simpler, universally-resolvable posture for the one package every consumer's `pnpm-workspace.yaml` must reach first.[^pnpm-plugin-silk-arch]

## Consequences

- A release of any one package never forces a version bump on an unrelated sibling; only a real internal edge whose range the new version leaves (every release across an exact `workspace:*` edge, which is every runtime internal edge today) or a package's own explicit `versionFiles` (`@savvy-web/ai-plugins` bumping its built plugin manifests, see [ai-plugins-versions-independently](ai-plugins-versions-independently.md)) propagate a bump.
- Release-order sequencing between related packages (for example, silk and pnpm-plugin-silk around a hoist change) is a manual coordination rule at release time, not something the changeset config enforces — see [carrier-pattern-package-graph](carrier-pattern-package-graph.md#consequences) for the case this bites.
- `@savvy-web/pnpm-plugin-silk` cannot be reached via a `@savvy-web/pnpm-plugin-silk` GitHub Packages install; every consumer resolves it from npm only.

[^claude-md]: ../../CLAUDE.md
[^pnpm-plugin-silk-arch]: `../../.changeset/config.json`
