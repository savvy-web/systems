---
type: Interface
title: Copilot plugin marketplace
description: "The GitHub Copilot marketplace file at .github/plugin/marketplace.json, which lists the silk plugin from plugin/builds/copilot at a pinned commit sha that CI advances on release."
status: draft
kind: config
resource: ../../.github/plugin/marketplace.json
tags: [tooling, release, github]
sources:
  - id: marketplace
    resource: ../../.github/plugin/marketplace.json
  - id: repin
    resource: ../../.github/workflows/repin-plugins.yml
  - id: copilot-format
    resource: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference
    title: Copilot CLI plugin reference (marketplace file lookup order), as mirrored in pluginfinity's okf/references/copilot-cli-plugin-format.md
  - id: copilot-manifest
    resource: ../../plugin/builds/copilot/plugin.json
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: d79f232c08503cd5b044e59c36e1ff33df0cbf874761cebf33b4991608ee609d
---

# Copilot plugin marketplace

## The contract

A GitHub Copilot user adds the `savvy-web-systems` marketplace from this repository and installs `silk` from it. `.github/plugin/marketplace.json` is the file Copilot reads. It names the marketplace `savvy-web-systems`, the same name as the Claude Code marketplace in `.claude-plugin/marketplace.json`, and lists one plugin.[^marketplace] Copilot CLI looks for `marketplace.json`, `.plugin/marketplace.json`, `.github/plugin/marketplace.json` and `.claude-plugin/marketplace.json`, in that order, so `copilot plugin marketplace add savvy-web/systems` resolves this file and never the Claude one beside it.[^copilot-format]

What a consumer can rely on:

- **The plugin name is `silk`.** The marketplace entry, the built `plugin.json` and the Claude plugin all use it.[^copilot-manifest]
- **The source is a git path at a pinned commit:** `{ source: "github", repo: "savvy-web/systems", path: "plugin/builds/copilot", sha: "<commit>" }`. The installed tree is the committed Copilot build at that sha, never `main`'s head and never the pluginfinity source.[^marketplace]
- **The version** is the built `plugin/builds/copilot/plugin.json` `version`, bumped by the `@savvy-web/ai-plugins` changeset `versionFiles`, never by hand.[^copilot-manifest]

## How the pin moves

The `sha` is committed empty on this branch. On release, `.github/workflows/repin-plugins.yml` runs `spencerbeggs/ai-plugin-marketplace-manager@v2` with `marketplace: copilot` (the input defaults to `claude-code`, which edits `.claude-plugin/marketplace.json` instead), writes the new sha into this file, and lands the change through a squash-merged pull request.[^repin] An empty `sha` therefore means "not yet released from this file", not "track the default branch".

## What is not promised

- The Copilot plugin is a reduced build of the Claude one: no monitors, no `it2` skill, and the host gaps in [copilot-plugin-host-gaps](../limitations/copilot-plugin-host-gaps.md).
- The entry's descriptive fields (`description`, `keywords`, `author`) are maintained by hand here and can lag the built manifest.

See [silk-plugin](../modules/silk-plugin.md) for the plugin and [adopt-pluginfinity-one-source-two-hosts](../decisions/adopt-pluginfinity-one-source-two-hosts.md) for why it has a Copilot build.

[^marketplace]: `../../.github/plugin/marketplace.json`
[^repin]: `../../.github/workflows/repin-plugins.yml`
[^copilot-manifest]: `../../plugin/builds/copilot/plugin.json`
[^copilot-format]: <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
