import { build } from "@savvy-web/bundler";

await build({
	// No `externals`: tsdown auto-externalizes everything declared in dependencies/
	// peerDependencies/optionalDependencies (effect, @effect/*, @effected/*,
	// @savvy-web/silk-effects are all declared), so the list was redundant. The MCP
	// protocol layer is `effect/unstable/ai` — no SDK, no zod.
	devManifest: "preserve",
	// The MCP server is an executable host, not a documented API surface — opt out of api-model
	// generation so `--target prod` does not run API Extractor or emit a meta asset.
	meta: false,
});
