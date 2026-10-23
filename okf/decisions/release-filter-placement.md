---
type: Decision
title: The per-target release filter runs outside the PublishabilityDetector
description: "SilkPublishability applies a target's releases filter in resolveReleaseTargets, never inside the PublishabilityDetector layers, because @effected/workspaces' VersioningStrategy.detect counts publishable packages through the detector and a package whose targets skip one version is still publishable."
status: stable
tags: [release, architecture]
generated:
  by: okfit/claude-code
  at: 2026-10-23T13:23:49Z
sources:
  - id: silk-publishability
    resource: ../../packages/silk-effects/src/services/SilkPublishability.ts
  - id: versioning-strategy
    resource: "npm:@effected/workspaces/VersioningStrategy"
  - id: resolve-targets
    resource: ../../packages/tsdown-plugins/src/targets/resolve-targets.ts
integrity:
  generated:
    body: cfc7dd18cfd010b4
  verified:
    by: human:spencer
    at: 2026-10-23T13:23:23Z
    content: 4c8d898d8e50c432
verified:
  - by: human:spencer
    at: 2026-10-23T06:59:00Z
  - by: human:spencer
    at: 2026-10-23T13:23:23Z
---

# The per-target release filter runs outside the PublishabilityDetector

## Context

A `publishConfig.targets` object can declare `releases: "all" | "stable" |
"prerelease"`, and the bundler writes the resolved value onto every target
in `dist/prod/targets.json`.[^resolve-targets] The filter depends on the
version being released, which only the publishing side knows.
`SilkPublishability` already supplies silk's rules to the kit through two
`PublishabilityDetector` layers (`layer` and the ignore-aware
`layerAdaptive`), and `resolveTargets` sits on top of the detector to drop
private directories and enforce the `targets.json` binding.[^silk-publishability]

`@effected/workspaces`' `VersioningStrategy.detect` classifies a workspace
(`single`, `fixed-group`, `independent`) from the packages the
`PublishabilityDetector` says publish somewhere.[^versioning-strategy]

## Decision

The release filter runs in the static
`SilkPublishability.resolveReleaseTargets(pkg, version)`, which calls
`resolveTargets` first and then marks each resolved target with whether its
`releases` admits the version, as a `receives` boolean; it never drops a
target. The detector layers and the pure `detect` stay version-blind: they report every
target a package has, whatever the version.[^silk-publishability]

## Alternatives rejected

- **Filter inside the detector.** The detector has no version to filter
  by, and threading one in would change what `VersioningStrategy.detect`
  counts. A package whose only target is `releases: "stable"` would vanish
  from the publishable set during a prerelease, and the workspace's
  versioning classification would shift with the version being cut. A
  package whose targets skip one version is still a publishable package.
- **Filter at build time.** Groups are packed once and a `from` target
  reuses another target's bytes, so two targets with different filters
  share one artifact; the bundler records the filter and leaves applying it
  to publish time.[^resolve-targets]

## Consequences

- A publisher asks `resolveReleaseTargets` for a version's targets and
  publishes only the entries with `receives: true`; a result with no such
  entry means the version publishes nowhere, which is not an
  error.[^silk-publishability]
- Anything that counts or lists publishable packages sees the same set for
  a final release and a prerelease: `listPublishable` and the kit's
  versioning strategy through the detector, `SilkWorkspaceAnalyzer`
  through the pure `detect`.
- Moving the filter into a detector layer would break the versioning
  classification for any workspace with a stable-only or prerelease-only
  package. No test pins the detector staying unfiltered, so this Decision
  is the guard.

## Related

- [`modules/silk-effects.md`](../modules/silk-effects.md) — the
  `SilkPublishability` surface.
- [`modules/tsdown-plugins.md`](../modules/tsdown-plugins.md) — where
  `releases` is declared, validated, and written to `targets.json`.

[^silk-publishability]: `../../packages/silk-effects/src/services/SilkPublishability.ts`
[^versioning-strategy]: npm:@effected/workspaces/VersioningStrategy
[^resolve-targets]: `../../packages/tsdown-plugins/src/targets/resolve-targets.ts`
