import { build } from "@savvy-web/bundler";

await build({
	// No `externals`: effect is a declared dependency, auto-externalized by tsdown.
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/templates", "../../website/lib/models/templates"],
		tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export" }] },
	},
});
