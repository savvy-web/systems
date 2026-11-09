import { AgentPlugin } from "@vitest-agent/plugin";

export function setup() {
	// `AgentPlugin.runScript` skips its command when the done-marker from its last success is younger than
	// VITEST_AGENT_RUNSCRIPT_BUILT_RECENTLY_MS (30 s by default), so a src edit between two quick sequential runs would
	// never reach `dist/prod`. A 1 ms window keeps the lock's serialization and drops that trust; turbo's cache makes
	// the re-run a fast no-op.
	process.env.VITEST_AGENT_RUNSCRIPT_BUILT_RECENTLY_MS ??= "1";
	// Workspace links resolve to source, so only the tests that run a built artifact need a build: the carrier's bins,
	// the cli/mcp bin e2e suites, the packed-install proof, and pnpm-plugin-silk's pnpmfile contract. The filter is named rather
	// than the whole workspace because `@savvy-web/ai-plugins`' build rewrites the committed plugin/builds trees.
	AgentPlugin.runScript(
		"pnpm exec turbo run build --filter '@savvy-web/silk...' --filter @savvy-web/pnpm-plugin-silk --output-logs=errors-only",
	);
}
