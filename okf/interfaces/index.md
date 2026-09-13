# Interface

* [@savvy-web/pnpm-plugin-silk catalog names](silk-catalogs.md) - The catalog names a consumer manifest may reference after adding this config dependency, what the plugin hoists, and what a consumer must not assume about catalog contents.
* [@savvy-web/silk export map](silk-shim-exports.md) - The subpath exports a config file imports from @savvy-web/silk: the module shape each shim promises to reproduce, stable independent of how silk-effects implements it.
* [Issue reference grammar](issue-reference-grammar.md) - The single GitHub closing-keyword and #N grammar every call site in this repo parses issue references with, so no two parsers disagree with each other or with GitHub.
* [Managed hook sections](managed-hook-sections.md) - The BEGIN/END MANAGED SECTION marker contract that lets multiple Silk tools own adjacent blocks inside one shared husky hook file without clobbering each other or user content.
* [PrBody contract](pr-body-contract.md) - The managed-region contract shared by every writer of a Silk PR description: what survives regeneration, the two closing-reference spellings, and the frozen silk-release marker grammar.
* [bundler tsconfig preset](bundler-tsconfig-preset.md) - The self-contained TypeScript base every plain Node library package extends, and the rule that keeps every shipped preset in the suite free of extends chains.
* [dist/<target>/issues.json](build-issues-json.md) - The structured, machine-readable diagnostics artifact every dev and prod build writes: what a reader may rely on staying stable, gated on buildOk.
* [layers.json](layers-json.md) - The single source of truth for which layer each app package sits in, read by @e2e/workspace to assert the live workspace:* dependency graph respects the declared layer ordering and stays acyclic.
* [savvy command tree](savvy-cli.md) - The savvy binary's command tree, flags, and exit-code contract from the caller's side — what a script or agent invoking savvy may depend on staying stable.
* [savvy-mcp tool surface](savvy-mcp-tools.md) - The ten savvy-mcp tools an agent calls: purpose, inputs, what each returns, and whether it is read-only or mutating — the consumer-visible contract, independent of the silk-effects service behind each one.
* [savvy.build.ts contract](savvy-build-config.md) - The build() front door and defineBuild/runBuild config surface every package's savvy.build.ts is written against — what a consumer can depend on staying stable across a bundler release.
