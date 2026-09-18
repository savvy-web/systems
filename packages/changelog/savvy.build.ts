import { build } from "@savvy-web/bundler";

await build({
	// ESM-only: the Changesets CLI (v3) `import()`s the changelog module, so no
	// `require` condition is needed. `@savvy-web/silk-effects` is a declared runtime
	// dependency and stays external — consumers resolve the `import`.
	meta: false,
});
