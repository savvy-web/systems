---
type: Decision
title: The plugin package @savvy-web/ai-plugins versions independently of @savvy-web/silk
description: "The pluginfinity plugin source is its own private changesets package, @savvy-web/ai-plugins, whose changesets and versionFiles bump its built Claude and Copilot manifests; it no longer rides silk's versionFiles in lockstep, which now covers only the legacy plugins/silk copy until release removes it."
status: stable
tags: [release, tooling]
sources:
  - id: changeset-config
    resource: ../../.changeset/config.json
  - id: manifest
    resource: ../../plugin/package.json
  - id: owner-brief
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-10-07T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 31ecf5e4bdaab25d4a492df5d030053509441f137083bfbde64d8dc7e7ad079b
verified:
  - by: human:spencer
    at: 2026-10-07T16:22:24Z
  - by: human:spencer
    at: 2026-10-07T16:22:50Z
---

# The plugin package @savvy-web/ai-plugins versions independently of @savvy-web/silk

## Context

`plugins/silk` had no package identity. silk's `versionFiles` glob bumped its `.claude-plugin/plugin.json` in lockstep with every `@savvy-web/silk` release, and `additionalScopes` attributed a `plugins/silk/**` change to silk. A plugin-only change therefore needed a silk changeset and an npm release of silk to ship. Moving the plugin to a pluginfinity source at `plugin/` (see [adopt-pluginfinity-one-source-two-hosts](adopt-pluginfinity-one-source-two-hosts.md)) gave it a workspace package of its own.[^changeset-config]

## Decision

Version the plugin as its own private package, `@savvy-web/ai-plugins`, through its own changesets:[^changeset-config][^manifest]

- Contributors write changesets for `@savvy-web/ai-plugins` when the plugin changes. `privatePackages.version` is on, so changesets bumps `plugin/package.json`, and the package is never published to npm.
- Its `.changeset/config.json` entry carries `versionFiles` that bump `$.version` in `plugin/builds/claude/.claude-plugin/plugin.json` and `plugin/builds/copilot/plugin.json`. Its `additionalScopes` attribute `.github/workflows/hook-tests.yml` and `.github/plugin/**` to it. Anything under `plugin/` belongs to it as a workspace directory.
- silk's `versionFiles` no longer touch `plugin/`. silk keeps the `plugins/*/.claude-plugin/plugin.json` glob and the `plugins/silk/**` scope only for the legacy copy, until the release branch deletes `plugins/silk/`.

The plugin's release cadence is now its own: a silk release no longer bumps it, and a plugin change no longer needs a silk release.[^owner-brief]

## Alternatives rejected

- **Keep lockstep through silk's `versionFiles`, pointing the glob at the two built manifests.** Rejected: it keeps coupling a non-npm artifact to silk's npm release, so every plugin fix still waits on, and forces, a silk release.[^owner-brief]
- **Drop `versionFiles` and stamp the version by running `pluginfinity build` after `changeset version`.** Not taken: `versionFiles` keeps the whole bump inside `changeset version`, with no extra build step to remember.

## Consequences

- The lockstep rule in [independent-package-versioning](independent-package-versioning.md) (silk's `versionFiles` reaching `plugins/*`) now holds only for the legacy `plugins/silk` copy, and ends when it is deleted.
- The marketplaces pin a commit sha, which the repin workflow advances on release ([copilot-plugin-marketplace](../interfaces/copilot-plugin-marketplace.md)); the version bump and the pin move are separate steps.
- Never hand-bump `plugin/package.json` or either built manifest. A changeset is the only route.
- See [silk-plugin](../modules/silk-plugin.md).

[^changeset-config]: `../../.changeset/config.json`
[^manifest]: `../../plugin/package.json`
[^owner-brief]: conversation with the repository owner
