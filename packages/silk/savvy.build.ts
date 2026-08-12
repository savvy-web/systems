import { build, defaultManifestTransform } from "@savvy-web/bundler";

await build({
	// `source-map-support` is referenced transitively but not declared, so tsdown would
	// otherwise bundle it. `typescript` (peer dep) and `semver` (runtime dep) are
	// auto-externalized by tsdown from the manifest; `semver` MUST stay external because
	// rolldown cannot emit its circular CommonJS modules (comparator <-> range) into the
	// ESM output without a `require_range is not a function` init-order crash. It is kept
	// as a declared runtime dependency (preserved through the transform below) for that
	// reason. Nothing in silk's OWN source imports it — `@savvy-web/changelog`, whose code
	// is force-bundled into the changelog and markdownlint entries, is the importer — so a
	// source-level grep reads it as unused. It is not: drop it and rolldown inlines
	// semver's CJS source into four artifacts. `__test__/externals.test.ts` pins this
	// against the built output; do not remove either half.
	//
	// `@savvy-web/silk-effects` is a devDependency (NOT a declared runtime dep), so tsdown
	// would normally bundle it into every entry — externalize it here so the BASE ESM
	// entries reference it via `import "@savvy-web/silk-effects"` instead of inlining its
	// large ESM-only transitive tree (unified/micromark/yaml/the *-effect packages). It is
	// re-added to the published `dependencies` by the transform below (resolved from
	// devDependencies) so consumers can resolve that import. The markdownlint override
	// RE-bundles it (see below).
	externals: ["source-map-support", "@savvy-web/silk-effects"],
	// Base build is ESM-only; only the markdownlint override (below) emits CJS.
	format: ["esm"],
	plugins: [
		{
			// `jsonc-parser` (pulled in by @changesets/apply-release-plan since the
			// changesets v3 bump) publishes no `exports` field, so the CJS override
			// bundles below resolve its UMD `main`. The UMD factory receives `require`
			// as a function PARAMETER, which rolldown's CommonJS transform cannot trace,
			// so its relative require("./impl/*") calls survive into the emitted single
			// -file .cjs and throw MODULE_NOT_FOUND at load time. Steer resolution to
			// the `module` ESM build, which bundles cleanly.
			name: "jsonc-parser-esm",
			async resolveId(id, importer) {
				if (id !== "jsonc-parser") return null;
				const resolved = await this.resolve(id, importer);
				if (resolved === null) return null;
				return { ...resolved, id: resolved.id.replace("/lib/umd/", "/lib/esm/") };
			},
		},
	],
	// Externalized in the DECLARATION pass only: the emitted `.d.ts` references
	// effect's types via `import` instead of inlining them. This avoids inlining
	// effect's cross-module `declare module` interface augmentations, which produced
	// conflicting interface-extension errors (TS2320) when a consumer type-checked
	// silk's dts. effect and @effect/platform are declared as runtime dependencies so
	// consumers can resolve these dts type imports.
	dtsExternals: ["effect", "@effect/platform"],
	overrides: [
		{
			// The Changesets CLI loads the changelog formatter via `resolve-from` +
			// `require()` (see @changesets/apply-release-plan), so this entry must stay
			// CJS-loadable exactly like the markdownlint entry below. An ESM-only export
			// (only `import` + `types`, no `require` condition) makes the CJS resolver throw
			// ERR_PACKAGE_PATH_NOT_EXPORTED, which broke `savvy changeset version`. CJS cannot
			// require() ESM-only silk-effects, so this entry INLINES it (and its transitive
			// node_modules) via `bundleNodeModules`, same as markdownlint.
			entries: ["./changesets/changelog"],
			format: ["esm", "cjs"],
			bundleNodeModules: true,
		},
		{
			// markdownlint-cli2 require()s this entry, so it must stay CJS-loadable. CJS cannot
			// require() ESM-only silk-effects (its package exports declare no `require`
			// condition), so this entry INLINES silk-effects (and its transitive node_modules)
			// via `bundleNodeModules` — the same bundle-everything mechanism the whole package
			// used before this split. silk-effects is NOT externalized here (the partition does
			// not inherit the base `externals`), so it is treated as bundleable node_modules and
			// rolldown emits co-located `.cjs` chunks the entry requires relatively. The base
			// ESM entries stay external; only this entry pays the inlining cost.
			entries: ["./changesets/markdownlint"],
			format: ["esm", "cjs"],
			bundleNodeModules: true,
			// `@commitlint/types` declarations are inlined into THIS entry's dts only, and it
			// does NOT need to be set top-level: no BASE entry's emitted `.d.ts` references
			// `@commitlint/types`. The commitlint base entries surface their config types through
			// the `Commitlint` namespace of the published `@savvy-web/silk-effects` dependency,
			// never `@commitlint/types` directly, so a published consumer never resolves
			// `@commitlint/types` from a base declaration.
			bundledPackages: ["@commitlint/types"],
		},
	],
	devManifest: "preserve",
	// silk is a collection of thin config-integration shims, not a documented API surface —
	// opt out of api-model generation so `--target prod` does not run API Extractor or emit a
	// meta asset.
	meta: false,
	transform: ({ pkg }) => {
		// `@savvy-web/cli`, `@savvy-web/mcp`, and `@savvy-web/changelog` are declared as
		// regular `dependencies` (with a `workspace:*` range, which changesets reads as
		// their exact current version). A release of any of them therefore pushes silk's
		// dep out of range and auto-PATCH-bumps silk (`updateInternalDependencies: patch`),
		// re-pinning the exact version at publish. They ship as plain `dependencies` in
		// the published manifest too — publishing them as peers made pnpm's
		// `autoInstallPeers` propagate their Effect graph into consuming repos at the
		// wrong versions. `@savvy-web/pnpm-plugin-silk` publicly hoists all three, so
		// their bins stay available to consumers either way.
		//
		// The surviving runtime dependencies are those three exact-pinned companions,
		// `semver` (externalized in JS, see above), the two `dtsExternals` packages
		// (externalized in the dts so consumers can resolve the type imports), and
		// `@savvy-web/silk-effects` (externalized in the BASE ESM entries, so the
		// published package needs it as a real dependency for consumers to resolve those
		// `import`s). Everything else is bundled into silk's JS, so keep ONLY these and
		// drop the rest.
		const deps = pkg.dependencies as Record<string, string> | undefined;
		const kept: Record<string, string> = {};
		for (const name of [
			"semver",
			"effect",
			"@effect/platform",
			// The lint entry's emitted declarations reference @effected/templates
			// types (SectionId on the section defs), so the published manifest must
			// carry it or a consumer type-checking @savvy-web/silk/lint has no
			// guaranteed resolution under pnpm's strict layout.
			"@effected/templates",
			"@savvy-web/changelog",
			"@savvy-web/cli",
			"@savvy-web/mcp",
		]) {
			const range = deps?.[name];
			if (range) kept[name] = range;
		}
		// silk-effects is a DEVDependency (so the markdownlint override can bundle it as
		// node_modules), but the base ESM entries externalize it, so it must ship as a real
		// runtime dependency. Pull its already-resolved spec from devDependencies (catalog
		// resolution runs before this transform) BEFORE the devDependencies field is stripped.
		const devDeps = pkg.devDependencies as Record<string, string> | undefined;
		const silkEffects = devDeps?.["@savvy-web/silk-effects"];
		if (silkEffects) kept["@savvy-web/silk-effects"] = silkEffects;
		pkg.dependencies = Object.keys(kept).length > 0 ? kept : undefined;
		// Custom transforms REPLACE the default, so apply the standard strip ourselves.
		return defaultManifestTransform({ pkg });
	},
});
