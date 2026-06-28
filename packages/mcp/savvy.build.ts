import { build } from "@savvy-web/bundler";

await build({
	// No `externals`: tsdown auto-externalizes everything declared in dependencies/
	// peerDependencies/optionalDependencies (effect, @effect/*, @modelcontextprotocol/sdk,
	// @savvy-web/silk-effects, workspaces-effect, zod are all declared), so the list was redundant.
	devManifest: "preserve",
	// The MCP server is an executable host, not a documented API surface — opt out of api-model
	// generation so `--target prod` does not run API Extractor or emit a meta asset.
	meta: false,
});
