import { build } from "@savvy-web/bundler";

await build({
	// The vanilla Changesets CLI `require()`s changelog formatters via
	// resolve-from, so the package must ship a `require` condition — and CJS
	// cannot `require()` ESM-only silk-effects, so the CJS artifact inlines it.
	format: ["esm", "cjs"],
	bundleNodeModules: true,
	// `jju` (pulled in transitively via @manypkg/tools) and `semver` (pulled in
	// transitively via @changesets/*, both part of silk-effects' Changesets barrel)
	// each have circular internal CommonJS requires (jju: lib/utils.js <-> index.js;
	// semver: classes/comparator.js <-> classes/range.js). rolldown's CJS-to-ESM
	// interop wrapper crashes with `require_X is not a function` when either circular
	// pair is inlined into the ESM output — documented for `semver` in
	// packages/silk/savvy.build.ts. Externalizing both avoids rolldown bundling the
	// circular pairs; real `require`/`import` resolves them fine as normal installed
	// dependencies (declared in `dependencies` below).
	externals: ["jju", "semver"],
	plugins: [
		{
			// `jsonc-parser` (pulled in transitively via @changesets/apply-release-plan,
			// part of silk-effects' Changesets barrel) publishes no `exports` field, so the
			// CJS bundle resolves its UMD `main`. The UMD factory receives `require` as a
			// function PARAMETER, which rolldown's CommonJS transform cannot trace, so its
			// relative require("./impl/*") calls survive into the emitted output and throw
			// MODULE_NOT_FOUND at load time. Steer resolution to the `module` ESM build,
			// which bundles cleanly. Mirrors packages/silk/savvy.build.ts.
			name: "jsonc-parser-esm",
			async resolveId(id, importer) {
				if (id !== "jsonc-parser") return null;
				const resolved = await this.resolve(id, importer);
				if (resolved === null) return null;
				return { ...resolved, id: resolved.id.replace("/lib/umd/", "/lib/esm/") };
			},
		},
	],
	meta: false,
});
