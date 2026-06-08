import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({
	// `semver` is externalized (not force-bundled): rolldown cannot emit semver's
	// circular CommonJS modules (comparator <-> range) into the ESM output without a
	// `require_range is not a function` init-order crash. It is declared as a runtime
	// dependency in package.json instead and preserved through the transform below.
	externals: ["typescript", "source-map-support", "semver"],
	format: ["esm", "cjs"],
	bundledPackages: ["@commitlint/types"],
	// silk force-bundles `@savvy-web/silk-effects` and its transitive node_modules
	// deps into the output — none of them are externalized. Without this option
	// tsdown would skip bundling node_modules even though they aren't in `externals`,
	// leaving silk's runtime unable to resolve them.
	bundleNodeModules: true,
	// Externalized in the DECLARATION pass only: the emitted `.d.ts`/`.d.cts`
	// reference effect's types via `import` instead of inlining them, while the JS
	// pass still force-bundles effect (bundleNodeModules) into silk's self-contained
	// runtime. This avoids inlining effect's cross-module `declare module` interface
	// augmentations, which produced conflicting interface-extension errors (TS2320)
	// when a consumer type-checked silk's dts. effect and @effect/platform are also
	// declared as runtime dependencies so consumers can resolve these dts type imports;
	// both expose a CJS-resolvable entry, so the require() path still works.
	//
	// `@savvy-web/silk-effects`, `workspaces-effect`, and `unified` are deliberately
	// NOT externalized in the dts: their declarations inline cleanly (no conflicting
	// augmentations), and they are ESM-only — declaring them as deps would make tsdown
	// externalize them from the JS too, breaking the CJS require(). So they stay bundled
	// in BOTH the JS and the dts.
	dtsExternals: ["effect", "@effect/platform"],
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
		// The surviving runtime dependencies are `semver` (externalized in JS, see above)
		// plus the two `dtsExternals` packages (externalized in the dts so consumers can
		// resolve the type imports). cli/mcp are promoted to peers and everything else is
		// bundled into silk's JS, so keep ONLY these three and drop the rest.
		const kept: Record<string, string> = {};
		for (const name of ["semver", "effect", "@effect/platform"]) {
			const range = deps?.[name];
			if (range) kept[name] = range;
		}
		pkg.dependencies = Object.keys(kept).length > 0 ? kept : undefined;
		delete pkg.devDependencies;
		delete pkg.bundleDependencies;
		delete pkg.scripts;
		delete pkg.publishConfig;
		delete pkg.packageManager;
		delete pkg.devEngines;
		return pkg;
	},
});

export default config;

if (import.meta.main) {
	await runBuild(config, { cwd: import.meta.dirname, argv: process.argv.slice(2) });
}
