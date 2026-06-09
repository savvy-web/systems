import { defaultManifestTransform, defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// `source-map-support` is referenced transitively but not declared, so tsdown would
	// otherwise bundle it. `typescript` (peer dep) and `semver` (runtime dep) are
	// auto-externalized by tsdown from the manifest; `semver` MUST stay external because
	// rolldown cannot emit its circular CommonJS modules (comparator <-> range) into the
	// ESM output without a `require_range is not a function` init-order crash. It is kept
	// as a declared runtime dependency (preserved through the transform below) for that
	// reason.
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
	// Externalized in the DECLARATION pass only: the emitted `.d.ts` references
	// effect's types via `import` instead of inlining them. This avoids inlining
	// effect's cross-module `declare module` interface augmentations, which produced
	// conflicting interface-extension errors (TS2320) when a consumer type-checked
	// silk's dts. effect and @effect/platform are declared as runtime dependencies so
	// consumers can resolve these dts type imports.
	dtsExternals: ["effect", "@effect/platform"],
	overrides: [
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
	transform: ({ pkg }) => {
		// `@savvy-web/cli` and `@savvy-web/mcp` are declared as regular
		// `dependencies` in source so changesets versions them in lockstep with
		// silk: a peerDependency on a released workspace package forces a major
		// bump on every minor of the dependency. Consumers should still receive
		// them as peers alongside the rest of the suite, so promote them back into
		// `peerDependencies` for the published manifest BEFORE the `dependencies`
		// block is stripped below.
		const deps = pkg.dependencies as Record<string, string> | undefined;
		const peers = (pkg.peerDependencies as Record<string, string> | undefined) ?? {};
		for (const name of ["@savvy-web/cli", "@savvy-web/mcp"]) {
			const range = deps?.[name];
			if (range) peers[name] = range;
		}
		pkg.peerDependencies = peers;
		// The surviving runtime dependencies are `semver` (externalized in JS, see above),
		// the two `dtsExternals` packages (externalized in the dts so consumers can resolve
		// the type imports), and `@savvy-web/silk-effects` (externalized in the BASE ESM
		// entries, so the published package needs it as a real dependency for consumers to
		// resolve those `import`s). cli/mcp are promoted to peers and everything else is
		// bundled into silk's JS, so keep ONLY these and drop the rest.
		const kept: Record<string, string> = {};
		for (const name of ["semver", "effect", "@effect/platform"]) {
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

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
