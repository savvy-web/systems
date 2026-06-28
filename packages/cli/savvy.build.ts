import { build } from "@savvy-web/bundler";

await build({
	// No `externals`: tsdown auto-externalizes everything declared in dependencies/
	// peerDependencies/optionalDependencies (effect, @effect/*, @savvy-web/silk-effects,
	// workspaces-effect are all declared), so listing them was redundant.
	devManifest: "preserve",
	// The CLI ships a binary, not a documented API surface — opt out of api-model generation
	// so `--target prod` does not run API Extractor or emit a meta asset.
	meta: false,
});
