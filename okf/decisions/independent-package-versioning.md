---
type: Decision
title: Every package versions independently
description: "`.changeset/config.json` declares no fixed or linked groups; every one of the twelve published packages, including former linked groups, cuts its own release, with changesets auto-bumping dependents and npm-registry-only release posture where that applies."
status: draft
tags: [release]
sources:
  - id: claude-md
    resource: ../../CLAUDE.md
  - id: pnpm-plugin-silk-arch
    resource: ../../.changeset/config.json
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: a175387bb6ad5aa25387b0e4647c23e7f39d617ae7b64405aa33235bfa6dfc9b
---

# Every package versions independently

## Context

Earlier in the repo's history, `bundler`, `rspress-builder`, and `tsdown-plugins` were a linked changeset group, and silk/cli/mcp were pinned together as a fixed group. Both arrangements coupled a package's release cadence to its siblings' regardless of whether a given change actually touched the sibling.[^claude-md]

## Decision

`.changeset/config.json` has no `fixed` or `linked` arrays: every package in the repo versions independently. `@savvy-web/bundler`, `@savvy-web/rspress-builder`, and `@savvy-web/tsdown-plugins` are no longer a linked group, though changesets still auto-bumps the bundler when tsdown-plugins changes, since the bundler depends on it. silk/cli/mcp/changelog are similarly not a fixed group; silk stays exactly pinned to the other three through the mechanism described in [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md) rather than through a changeset group.[^claude-md]

The repo-wide `updateInternalDependencies: patch` setting means any internal `workspace:*` dependency bump auto-patch-bumps the dependent, which is what lets siblings stay in sync without a `fixed`/`linked` declaration coupling their own independent release decisions. silk's `versionFiles` glob still bumps the `plugins/*` manifests in lockstep with silk specifically, a targeted file-pattern mechanism rather than a changeset group.[^claude-md]

`@savvy-web/pnpm-plugin-silk` versions independently like every other package and is additionally npm-registry-only — the one package in the repo not also published to GitHub Packages, because `private: true` in source with `publishConfig.access: public` and an npm-only `publishConfig.targets` target is what lets a config dependency install before any build tooling exists in a downstream repo.[^pnpm-plugin-silk-arch]

## Alternatives rejected

- **Keep bundler/rspress-builder/tsdown-plugins as a linked group.** Rejected once the three packages' actual coupling turned out to be one-directional (bundler depends on tsdown-plugins) rather than mutual — `updateInternalDependencies: patch` already produces the auto-bump a linked group existed to guarantee, without forcing rspress-builder's version to move on every tsdown-plugins change it does not consume.
- **Keep silk/cli/mcp as a fixed group.** Rejected in favor of [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md): an exact-pinned `dependencies` entry plus `updateInternalDependencies: patch` gives silk the same effective pinning a fixed group would, without forcing cli or mcp's version number to move when only silk's config shims change.
- **Publish pnpm-plugin-silk to GitHub Packages as well.** Not pursued: a pnpm config dependency installs before a repo's own registry auth may be configured, so npm-registry-only is the simpler, universally-resolvable posture for the one package every consumer's `pnpm-workspace.yaml` must reach first.[^pnpm-plugin-silk-arch]

## Consequences

- A release of any one package never forces a version bump on an unrelated sibling; only real `workspace:*` edges (via `updateInternalDependencies: patch`) or the explicit `versionFiles` glob (silk → `plugins/*`) propagate a bump.
- Release-order sequencing between related packages (for example, silk and pnpm-plugin-silk around a hoist change) is a manual coordination rule at release time, not something the changeset config enforces — see [carrier-pattern-package-graph](carrier-pattern-package-graph.md#hoist-removal-and-release-sequencing) for the case this bites.
- `@savvy-web/pnpm-plugin-silk` cannot be reached via a `@savvy-web/pnpm-plugin-silk` GitHub Packages install; every consumer resolves it from npm only.

[^claude-md]: ../../CLAUDE.md
[^pnpm-plugin-silk-arch]: `../../.changeset/config.json`
