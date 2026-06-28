import { build } from "@savvy-web/bundler";

await build({
	devManifest: "preserve",
	meta: {
		localPaths: ["../mcp/lib/models/github-action-builder", "../../website/lib/models/github-action-builder"],
		tsdoc: {
			tagDefinitions: [
				{ tagName: "@schema", syntaxKind: "modifier" },
				{ tagName: "@layer", syntaxKind: "modifier" },
				{ tagName: "@service", syntaxKind: "modifier" },
				{ tagName: "@error", syntaxKind: "modifier" },
			],
		},
	},
});
