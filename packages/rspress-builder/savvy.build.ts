import { build } from "@savvy-web/bundler";

await build({
	meta: {
		localPaths: ["../mcp/lib/models/rspress-builder", "../../website/lib/models/rspress-builder"],
	},
});
