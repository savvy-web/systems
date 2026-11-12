---
type: Decision
title: The savvy tool closure pins its kit and in-repo edges exactly
description: "silk, cli, mcp and changelog (the tools) and silk-effects and silk-core (the engine they run) write every regular effect, @effect/* and @effected/* dependency as catalog:effected:exact and every in-repo edge as workspace:*, while the engine's kit peers stay catalog:effected:peers ranges, so a released savvy runs exactly what it was tested with."
status: draft
tags: [deps, release, architecture]
sources:
  - id: guard
    resource: ../../packages/silk/__test__/tool-closure.test.ts
  - id: silk-deps
    resource: ../../packages/silk/package.json
  - id: cli-deps
    resource: ../../packages/cli/package.json
  - id: mcp-deps
    resource: ../../packages/mcp/package.json
  - id: changelog-deps
    resource: ../../packages/changelog/package.json
  - id: engine-deps
    resource: ../../packages/silk-effects/package.json
  - id: core-deps
    resource: ../../packages/silk-core/package.json
  - id: changeset-config
    resource: ../../.changeset/config.json
  - id: workspace
    resource: ../../pnpm-workspace.yaml
  - id: bridge-pr
    resource: https://github.com/savvy-web/systems/pull/878
    title: "fix(deps): adopt the 0.26.1 kit and bridge stale tooling kit copies"
  - id: carrier-closure
    resource: "effected plugin 0.51.2, design-patterns skill, references/carrier-closure.md"
    title: Carrier closure
  - id: ledger-0011
    resource: "effected plugin 0.51.2, effected-renovate skill, references/ledger/0011-adopt-tool-closure-exact-kit-pins.md"
    title: the effected tool pins its kit closure exactly; pin your own tool packages the same way
generated:
  by: okfit/claude-code
  at: 2026-11-12T03:51:22Z
integrity:
  generated:
    body: 897cb6cd2cf7dee4
---

# The savvy tool closure pins its kit and in-repo edges exactly

## Context

`savvy` and `savvy-mcp` are programs, not libraries: a consumer runs them and never hands them a `Context.Service`, Schema class or brand of its own. The carrier ([silk](../modules/silk.md)), the two front ends ([cli](../modules/cli.md), [mcp](../modules/mcp.md)), [changelog](../modules/changelog.md), and the engine they all run ([silk-effects](../modules/silk-effects.md) over [silk-core](../modules/silk-core.md)) therefore form one closure that shares nothing with the host it is installed into.[^carrier-closure]

On `0.x` a caret holds the minor and floats the patch. While the tools spelled their kit dependencies `catalog:effected`, which publishes the catalog's caret, a fresh install could pick up a kit patch published after a tool shipped, so the tool's behaviour moved under an unchanged version, and a kit library inside the closure could satisfy its kit peers from a copy on a release line it no longer supports and die at import with `does not provide an export named …`.[^carrier-closure] The same floating ranges in other kit-built tools (okfit, pluginfinity, vitest-agent, rolldown-pnpm-config) forced this repository into a block of parent-scoped `overrides:` holding their stale kit copies in place until each re-released on the new kit.[^bridge-pr] Before this decision the tools wrote `catalog:effected` and the edges cli/mcp/changelog→silk-effects and silk-effects→silk-core were `workspace:^`.

The effected kit adopted the same rule for its own tool (upgrade-ledger entry 0011), and `@effected/pnpm-plugin-effected` 0.26.2 serves `effected:exact`: the `effected` catalog with every operator stripped, so it publishes plain versions and still moves with each plugin bump.[^ledger-0011][^workspace]

## Decision

Treat the tool closure as sealed:

- **Tools.** Every `effect`, `@effect/*` and `@effected/*` entry in the `dependencies` of silk, cli, mcp and changelog is `catalog:effected:exact`.[^silk-deps][^cli-deps][^mcp-deps][^changelog-deps]
- **Engine.** silk-effects and silk-core write their regular kit `dependencies` as `catalog:effected:exact` too, because inside the tool they resolve privately. Their `peerDependencies` stay `catalog:effected:peers` ranges: the silk GitHub Actions (silk-release-action, silk-update-action) import silk-effects as a library, and the reasons in [kit-effect-peers-via-catalog](kit-effect-peers-via-catalog.md) still hold for them.[^engine-deps][^core-deps]
- **In-repo edges.** Every in-repo dependency inside the closure is `workspace:*`, published as the exact version: silk→cli/mcp/changelog/silk-effects (already so, see [silk-pins-siblings-as-dependencies](silk-pins-siblings-as-dependencies.md)), cli/mcp/changelog→silk-effects, and silk-effects→silk-core.[^cli-deps][^mcp-deps][^changelog-deps][^engine-deps]
- **The full peer closure is declared.** Each tool declares every kit peer its dependencies need as an exact regular dependency, even where no file imports it. mcp, silk and changelog declare `@effected/jsonc`, `@effected/toml` and `@effected/yaml` for exactly this reason: they are optional peers of `@effected/markdown`, whose YAML, TOML and JSON front-matter modules the changesets engine loads; cli already declared them.[^mcp-deps][^silk-deps][^changelog-deps]
- **devDependencies are unchanged** (`catalog:effected`); they never publish.

## Alternatives rejected

- **Keep carets and bridge each stale tool with per-consumer overrides.** This is what [#878](https://github.com/savvy-web/systems/pull/878) had to do for the kit-built tools this repository installs: one parent-scoped override per stale edge, written and later removed by hand in every consuming repository. It treats a property of the tool as the host's problem, and a consumer of silk would inherit the same chore for savvy.[^bridge-pr]
- **Pin the engine's library peers exactly as well.** Rejected because silk-effects is also a library. The silk Actions import it directly beside their own kit packages, and an exact peer would force them onto a second copy of each identity-carrying kit package, the duplicate `Context.Service` tags and failing Schema `instanceof` checks that [kit-effect-peers-via-catalog](kit-effect-peers-via-catalog.md) exists to prevent.[^engine-deps]
- **Bundle the closure into each tool's published `dist`.** That is the full seal, since nothing would resolve at install time, but it changes the build posture of every tool package and is not taken now.[^carrier-closure]

## Consequences

- **More releases, by design.** `updateInternalDependencies: patch` bumps a dependent whenever a dependency's new version leaves the dependent's range, and an exact `workspace:*` range is left by every release. Every silk-core or silk-effects release therefore auto-patch-bumps silk-effects (for silk-core), cli, mcp, changelog and silk, and every kit bump that moves the closure ripples a patch down to silk. The carrier's version names exactly what runs.[^changeset-config]
- A tool released on an older kit release keeps working beside a repository that has moved to a newer one, until the tool next releases. Duplicate kit copies under a tool in a consumer's tree are expected and harmless; do not override them onto the host's versions.[^ledger-0011]
- **Not sealed:** the pins cover the closure's direct kit and in-repo dependencies and, through them, every kit peer, not a kit library's own regular `dependencies`, which still float within their carets: `@effected/markdown@0.29.0` declares `@effected/source: ^0.5.0`, so a later install can take a newer `0.5.x` with no savvy release.[^carrier-closure] Nor is `effect` held graph-wide everywhere: that pin comes from `@effected/pnpm-plugin-effected`'s overrides, so it holds only in a consumer repository that runs that pnpm config dependency. An npm, Yarn or bun consumer of silk, all supported, gets no such override, and there `effect` resolves from the tools' own exact `effect` pins plus the engine's `~4.1.0` peer.[^engine-deps] Those two gaps are why a much older tool can still need a bridge somewhere.
- Removing an apparently unused kit dependency from a tool package can break installs; check the installed peer closure first.

## Enforcement

`packages/silk/__test__/tool-closure.test.ts` holds the rule. It fails on any tool or engine kit dependency not written `catalog:effected:exact`, any in-repo dependency inside the closure not written `workspace:*`, and any engine kit peer not written `catalog:effected:peers`, each with a floor on how many entries it checked so it cannot pass by checking nothing. It then walks each tool's installed dependency graph and fails on any kit peer that no ancestor on the path declares as a dependency. A positive control asserts that a caret catalog, a workspace caret and an exact peer are each reported.[^guard]

[^carrier-closure]: effected plugin 0.51.2, design-patterns skill, `references/carrier-closure.md`
[^bridge-pr]: <https://github.com/savvy-web/systems/pull/878>
[^ledger-0011]: effected plugin 0.51.2, effected-renovate skill, `references/ledger/0011-adopt-tool-closure-exact-kit-pins.md`
[^workspace]: `../../pnpm-workspace.yaml`
[^silk-deps]: `../../packages/silk/package.json`
[^cli-deps]: `../../packages/cli/package.json`
[^mcp-deps]: `../../packages/mcp/package.json`
[^changelog-deps]: `../../packages/changelog/package.json`
[^engine-deps]: `../../packages/silk-effects/package.json`
[^core-deps]: `../../packages/silk-core/package.json`
[^changeset-config]: `../../.changeset/config.json`
[^guard]: `../../packages/silk/__test__/tool-closure.test.ts`
