import { build } from "@savvy-web/bundler";

await build({
	// `source-map-support` is referenced transitively but not declared, so tsdown would
	// otherwise bundle it. `typescript` (peer dep) and `semver` (runtime dep) are
	// auto-externalized by tsdown from the manifest; `semver` MUST stay external because
	// rolldown cannot emit its circular CommonJS modules (comparator <-> range) into the
	// ESM output without a `require_range is not a function` init-order crash. Nothing in
	// silk's OWN source imports it — the importers are the `@changesets/*` packages inside
	// `@savvy-web/silk-effects`' transitive tree — so a source-level grep reads it as
	// unused. It is not: drop the declaration and rolldown inlines semver's CJS source.
	// `__test__/externals.test.ts` pins this against the built output.
	//
	// `@savvy-web/silk-effects` is a DECLARED runtime dependency (nine files under `src/`
	// import it — silk is a carrier plus config shims, not a pure carrier), so tsdown
	// auto-externalizes it from the manifest and every entry references it via
	// `import "@savvy-web/silk-effects"` instead of inlining its large ESM-only transitive
	// tree (unified/micromark/yaml/the *-effect packages). It is listed here anyway so the
	// posture survives a manifest edit.
	externals: ["source-map-support", "@savvy-web/silk-effects"],
	// ESM-only. The changesets CLI (v3), markdownlint-cli2 and commitlint all `import()`
	// their config modules, so no entry needs a CJS twin.
	format: ["esm"],
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
