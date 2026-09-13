# Module

* [@savvy-web/bundler](bundler.md) - The tsdown-based build orchestrator every Silk Suite TypeScript package builds through — a thin driver over @savvy-web/tsdown-plugins.
* [@savvy-web/changelog](changelog.md) - The standalone changesets changelog generator; a one-file host adapter over silk-effects' Changesets.makeChangelogFunctions, and the canonical .changeset/config.json changelog id.
* [@savvy-web/silk](silk.md) - The single install-target package that carries the savvy/savvy-mcp bins and a thin config-integration shim surface over silk-effects.
* [@savvy-web/tsdown-plugins](tsdown-plugins.md) - The interface-only plugin pack holding every build behavior @savvy-web/bundler orchestrates — entry detection, the build loop, dts emission, dual-format output, targets, exe, meta, config validation.
* [cli](cli.md) - The savvy binary — the single command host for the Silk Suite's everyday dev tooling.
* [e2e](e2e.md) - The private, never-published harness area exercising the repo's build and release tooling through the BUILT dist/dev artifact, against isolated fixtures outside the workspace.
* [github-action-builder](github-action-builder.md) - Zero-config Effect-first build tool that bundles TypeScript into single-file Node.js 24 GitHub Actions, validates action.yml, and syncs output for act testing.
* [mcp](mcp.md) - The savvy-mcp server — a standalone, spawnable, tools-only MCP server serving Silk Suite tooling to coding agents as structured tools.
* [pnpm-plugin-silk](pnpm-plugin-silk.md) - The single pnpm config dependency that distributes the Silk Suite's shared workspace configuration — catalogs, overrides, build/hoist/peer rules, and release-age gating — to every consuming repository.
* [rspress-builder](rspress-builder.md) - Thin bundler sibling that builds RSPress plugin packages as a dual-bundle (node plugin + browser runtime) preset over @savvy-web/bundler.
* [silk-core](silk-core.md) - L1 domain core of the Silk package graph — platform-free schemas, tagged errors, and the frozen PrBody contract.
* [silk-effects](silk-effects.md) - L2 engine of the Silk package graph — the shared, platform-agnostic Effect library holding Silk's policy and the business logic of six dev-tooling namespaces.
* [silk-plugin](silk-plugin.md) - The silk@savvy-web-systems Claude Code plugin — skills, agents, hooks and background monitors for every Silk capability behind the savvy bin and the shared savvy-mcp server.
* [templates](templates.md) - Pure-function project scaffolding library — stateless functions that turn typed options into generated file content, with no I/O of its own.
