import { build } from "@savvy-web/bundler";

await build({
	// `source-map-support` is referenced transitively but not declared, so tsdown would
	// otherwise bundle it. `typescript` (peer dep) and `semver` (runtime dep) are
	// auto-externalized by tsdown from the manifest; `semver` MUST stay external because
	// rolldown cannot emit its circular CommonJS modules (comparator <-> range) into the
	// ESM output without a `require_range is not a function` init-order crash. It is kept
	// as a declared runtime dependency (preserved through the transform below) for that
	// reason. Nothing in silk's OWN source imports it — the importers are the
	// `@changesets/*` packages (apply-release-plan, config, get-release-plan) inside
	// `@savvy-web/silk-effects`' transitive tree, which the CJS overrides below
	// force-bundle — so a source-level grep reads it as unused. It is not: drop it and
	// rolldown inlines semver's CJS source into four artifacts. There is no
	// externalization escape (systems#469 determination): the CJS-requireable entries
	// cannot externalize ESM-only silk-effects, so its semver-importing closure is always
	// bundled, and only the manifest declaration keeps semver itself external — which the
	// published manifest needs anyway for the external import to resolve at runtime.
	// `__test__/externals.test.ts` pins this against the built output; do not remove
	// either half.
	//
	// `@savvy-web/silk-effects` is a DECLARED runtime dependency (nine files under `src/`
	// import it — silk is a carrier plus config shims, not a pure carrier), so tsdown
	// auto-externalizes it from the manifest and the BASE ESM entries reference it via
	// `import "@savvy-web/silk-effects"` instead of inlining its large ESM-only transitive
	// tree (unified/micromark/yaml/the *-effect packages). It is listed here anyway so the
	// posture survives a manifest edit. The two CJS overrides below force-INLINE it via
	// `bundle` (see there).
	//externals: ["source-map-support", "@savvy-web/silk-effects"],
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
	// silk is a collection of thin config-integration shims, not a documented API surface —
	// opt out of api-model generation so `--target prod` does not run API Extractor or emit a
	// meta asset.
	meta: false,
});
