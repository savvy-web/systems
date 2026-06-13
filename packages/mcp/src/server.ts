/**
 * Constructs the MCP server, registers tools and resources, and connects the
 * stdio transport.
 *
 * @packageDocumentation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Schema } from "effect";
import { z } from "zod";

import type { McpContext } from "./context.js";
import { registerAllResources } from "./resources/index.js";
import { stderrQueryLogger } from "./resources/query-log.js";
import { effectToZodSchema } from "./schema/effect-to-zod.js";
import type { BiomeCheckArgs } from "./tools/biome-check.js";
import { BiomeCheckAsMarkdown, BiomeCheckResult, runBiomeCheck } from "./tools/biome-check.js";
import type { ChangesetInspectArgs } from "./tools/changeset-inspect.js";
import { ChangesetInspectAsMarkdown, ChangesetInspectResult, changesetInspect } from "./tools/changeset-inspect.js";
import type { ChangesetValidateArgs } from "./tools/changeset-validate.js";
import { ChangesetValidateAsMarkdown, ChangesetValidateResult, changesetValidate } from "./tools/changeset-validate.js";
import { DocsSearchResult, DocsSearchResultAsMarkdown, runDocsSearch } from "./tools/docs-search.js";
import type { TurboInspectArgs } from "./tools/turbo-inspect.js";
import { TurboInspectAsMarkdown, TurboInspectResult, turboInspect } from "./tools/turbo-inspect.js";
import { WorkspaceInfoAsMarkdown, WorkspaceInfoResult, workspaceInfo } from "./tools/workspace-info.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/** Wrap a markdown string + structured object in the dual-channel tool result. */
const structuredResult = <T extends object>(text: string, structured: T) => ({
	content: [{ type: "text" as const, text }],
	structuredContent: structured as unknown as Record<string, unknown>,
});

/** Build the MCP server for the given context, registering tools + resources. */
export function buildServer(ctx: McpContext): McpServer {
	const server = new McpServer({ name: "savvy-mcp", version: CURRENT_MCP_VERSION });

	server.registerTool(
		"workspace_info",
		{
			description:
				"Use when you need the Silk workspace layout: runtime, package manager, and a per-workspace summary (publishability, versioning, tag/release state). Prefer this over running shell commands to inspect the workspace. Returns markdown in content[] and a typed object in structuredContent.",
			inputSchema: {
				cwd: z.optional(z.string()).describe("Workspace root to analyze. Defaults to the server's project dir."),
			},
			outputSchema: effectToZodSchema(WorkspaceInfoResult) as never,
		},
		async (args) => {
			const root = args.cwd ?? ctx.cwd;
			const data = await ctx.runtime.runPromise(workspaceInfo(root));
			const text = Schema.decodeSync(WorkspaceInfoAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"silk_docs_search",
		{
			description:
				"Search Silk documentation by intent. Pass plain keywords or a short phrase describing what you need (e.g. 'changeset bump rules'). Returns ranked docs with a confidence label; fetch a hit with resources/read <uri>. Read silk://catalog first to orient.",
			inputSchema: {
				query: z.string().describe("Keywords or a short phrase describing the doc you need."),
				limit: z.optional(z.number()).describe("Max results (default 10)."),
				tier: z.optional(z.enum(["standards", "packages", "guides"])).describe("Restrict to one tier."),
			},
			outputSchema: effectToZodSchema(DocsSearchResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = runDocsSearch(
				ctx.docIndex,
				args.query,
				{
					...(args.limit !== undefined ? { limit: args.limit } : {}),
					...(args.tier !== undefined ? { tier: args.tier } : {}),
				},
				stderrQueryLogger,
			);
			const text = Schema.decodeSync(DocsSearchResultAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"turbo_inspect",
		{
			description:
				"Read-only Turborepo inspection. mode=cache diagnoses why a task's cache is hitting/missing (per-package status plus the exact hash contributors: input files, env vars, external-dep hashes, global hash). mode=graph returns the task graph and critical path. mode=affected lists changed packages and their dependents. Never executes tasks (uses --dry).",
			inputSchema: {
				mode: z.enum(["cache", "graph", "affected"]).describe("Which inspection to run."),
				task: z.optional(z.string()).describe("Task name (defaults to build:dev for cache/graph)."),
				base: z.optional(z.string()).describe("Base git ref for affected mode."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(TurboInspectResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(turboInspect(args as TurboInspectArgs, ctx.cwd));
			const text = Schema.decodeSync(TurboInspectAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"changeset_inspect",
		{
			description:
				"Read-only changeset analysis for the changeset-manager workflow. mode=branch diffs the current branch against its base and classifies every changed file by owning package (with packagesAffected and the unmapped paths to ask the user about). mode=config surfaces the resolved .changeset/config.json (release surfaces, versionFiles, ignore list). mode=classify maps arbitrary repo-relative paths to their owning package. Prefer this over shelling out to the savvy CLI.",
			inputSchema: {
				mode: z.enum(["branch", "config", "classify"]).describe("Which inspection to run."),
				base: z.optional(z.string()).describe("Override the base branch (branch mode only)."),
				paths: z.optional(z.array(z.string())).describe("Paths to classify (classify mode only)."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ChangesetInspectResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(changesetInspect(args as ChangesetInspectArgs, ctx.cwd));
			const text = Schema.decodeSync(ChangesetInspectAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"changeset_validate",
		{
			description:
				"Read-only validation of changeset files against the section-aware rules. Pass dir (default .changeset). Returns typed diagnostics (file, rule, line, column, message) plus ok/errorCount in structuredContent. Prefer this over shelling out to savvy changeset lint.",
			inputSchema: {
				dir: z.optional(z.string()).describe("Changeset directory to validate (default .changeset)."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ChangesetValidateResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(changesetValidate(args as ChangesetValidateArgs, ctx.cwd));
			const text = Schema.decodeSync(ChangesetValidateAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"biome_check",
		{
			description:
				"Run Biome over a path and get structured diagnostics back. mode=check (default; lint + format + organize-imports) or mode=lint. Set write=true to apply safe fixes (--write), unsafe=true for unsafe fixes (--write --unsafe). Prefer this over shelling out to biome; the LSP already covers files you've edited. Returns markdown in content[] and a typed object in structuredContent. NOTE: with write/unsafe this tool MUTATES files (git-reversible).",
			inputSchema: {
				paths: z.optional(z.array(z.string())).describe("Paths to check. Defaults to the whole workspace."),
				mode: z
					.optional(z.enum(["check", "lint"]))
					.describe("check = lint+format+imports (default); lint = lint only."),
				write: z.optional(z.boolean()).describe("Apply safe fixes (--write)."),
				unsafe: z.optional(z.boolean()).describe("Apply unsafe fixes (--write --unsafe); implies write."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(BiomeCheckResult) as never,
		},
		async (args) => {
			const data = await runBiomeCheck(args as BiomeCheckArgs, ctx.cwd);
			const text = Schema.decodeSync(BiomeCheckAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	registerAllResources(server, { manifest: ctx.manifest, contentRoot: ctx.contentRoot });

	return server;
}

/** Build the server and connect it over stdio. */
export async function startMcpServer(ctx: McpContext): Promise<void> {
	const server = buildServer(ctx);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
