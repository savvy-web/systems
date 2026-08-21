/**
 * Constructs the MCP server, registers tools, and connects the stdio
 * transport.
 *
 * @packageDocumentation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Schema } from "effect";
import { z } from "zod";

import type { McpContext } from "./context.js";
import { effectToZodSchema } from "./schema/effect-to-zod.js";
import type { BiomeCheckArgs } from "./tools/biome-check.js";
import { BiomeCheckAsMarkdown, BiomeCheckResult, runBiomeCheck } from "./tools/biome-check.js";
import type { ChangesetDepsDetectArgs } from "./tools/changeset-deps-detect.js";
import {
	ChangesetDepsDetectAsMarkdown,
	ChangesetDepsDetectResult,
	changesetDepsDetect,
} from "./tools/changeset-deps-detect.js";
import type { ChangesetDepsRegenArgs } from "./tools/changeset-deps-regen.js";
import {
	ChangesetDepsRegenAsMarkdown,
	ChangesetDepsRegenResult,
	changesetDepsRegen,
} from "./tools/changeset-deps-regen.js";
import type { ChangesetInspectArgs } from "./tools/changeset-inspect.js";
import { ChangesetInspectAsMarkdown, ChangesetInspectResult, changesetInspect } from "./tools/changeset-inspect.js";
import type { ChangesetPreviewArgs } from "./tools/changeset-preview.js";
import { ChangesetPreviewAsMarkdown, ChangesetPreviewResult, changesetPreview } from "./tools/changeset-preview.js";
import type { ChangesetValidateArgs } from "./tools/changeset-validate.js";
import { ChangesetValidateAsMarkdown, ChangesetValidateResult, changesetValidate } from "./tools/changeset-validate.js";
import type { ReposInspectArgs } from "./tools/repos-inspect.js";
import { ReposInspectAsMarkdown, ReposInspectResult, reposInspect } from "./tools/repos-inspect.js";
import type { ReposManageArgs } from "./tools/repos-manage.js";
import { ReposManageAsMarkdown, ReposManageResult, reposManage } from "./tools/repos-manage.js";
import type { TurboInspectArgs } from "./tools/turbo-inspect.js";
import { TurboInspectAsMarkdown, TurboInspectResult, turboInspect } from "./tools/turbo-inspect.js";
import { WorkspaceInfoAsMarkdown, WorkspaceInfoResult, workspaceInfo } from "./tools/workspace-info.js";
import { CURRENT_MCP_VERSION } from "./version.js";

/**
 * The `repos_inspect` wire-level `mode` enum. Exported so tests can assert
 * the boundary rejects an unknown mode without duplicating the enum's
 * member list.
 */
export const ReposInspectModeSchema = z
	.enum(["status", "config", "drift", "gitmodules"])
	.describe(
		"status = drift report; config = the full agent brief; drift = four-authority submodule reconciliation; gitmodules = decoded .gitmodules sections.",
	);

/** Wrap a markdown string + structured object in the dual-channel tool result. */
const structuredResult = <T extends object>(text: string, structured: T) => ({
	content: [{ type: "text" as const, text }],
	structuredContent: structured as unknown as Record<string, unknown>,
});

/** Build the MCP server for the given context, registering tools. */
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
			const text = Schema.decodeUnknownSync(WorkspaceInfoAsMarkdown)(data);
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
			const text = Schema.decodeUnknownSync(TurboInspectAsMarkdown)(data);
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
			const text = Schema.decodeUnknownSync(ChangesetInspectAsMarkdown)(data);
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
			const text = Schema.decodeUnknownSync(ChangesetValidateAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"changeset_deps_detect",
		{
			description:
				"Read-only preview of the cumulative dependency diff (merge-base -> working tree) per workspace package. Returns each affected package's resolved dependency-table rows (catalog:/workspace: specifiers resolved to concrete versions; devDependencies retained) as the exact rows a pure-dependency changeset would carry. Does NOT write or delete any file. Prefer this over shelling out to savvy changeset deps detect.",
			inputSchema: {
				base: z.optional(z.string()).describe("Override the base branch used to compute the merge-base."),
				package: z.optional(z.string()).describe("Restrict output to a single workspace package."),
				packages: z
					.optional(z.array(z.string()))
					.describe("Restrict output to these workspace packages (unioned with package)."),
				exclude: z.optional(z.array(z.string())).describe("Drop these packages from the output entirely."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ChangesetDepsDetectResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(changesetDepsDetect(args as ChangesetDepsDetectArgs, ctx.cwd));
			const text = Schema.decodeUnknownSync(ChangesetDepsDetectAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"changeset_preview",
		{
			description:
				"Read-only preview of the next release. Runs the genuine changesets engine over the pending changesets and returns each package's version bump (old -> new) plus the rendered CHANGELOG block (dependency tables included), exactly as it would ship. Does not modify the repo. Prefer this over hand-merging changeset files.",
			inputSchema: {
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ChangesetPreviewResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(changesetPreview(args as ChangesetPreviewArgs, ctx.cwd));
			const text = Schema.decodeUnknownSync(ChangesetPreviewAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"changeset_deps_regen",
		{
			description:
				"Regenerate pure-dependency changesets: delete stale single-package Dependencies-only changesets and write fresh single-package, patch-bump changesets from the cumulative dependency diff (catalog:/workspace: resolved; devDependencies dropped). Mixed changesets (Dependencies plus other content) are left untouched. Set dryRun=true to preview the plan without touching the filesystem. NOTE: without dryRun this tool MUTATES .changeset/*.md (git-reversible). Prefer this over shelling out to savvy changeset deps regen.",
			inputSchema: {
				base: z.optional(z.string()).describe("Override the base branch used to compute the merge-base."),
				package: z.optional(z.string()).describe("Restrict regeneration to a single workspace package."),
				packages: z
					.optional(z.array(z.string()))
					.describe("Restrict regeneration to these workspace packages (unioned with package)."),
				exclude: z
					.optional(z.array(z.string()))
					.describe("Skip these packages entirely: nothing written, existing changesets untouched."),
				dryRun: z.optional(z.boolean()).describe("Compute the plan without writing or deleting any file."),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ChangesetDepsRegenResult) as never,
			annotations: { destructiveHint: true, idempotentHint: false },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(changesetDepsRegen(args as ChangesetDepsRegenArgs, ctx.cwd));
			const text = Schema.decodeUnknownSync(ChangesetDepsRegenAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"repos_inspect",
		{
			title: "Inspect vendored repos",
			description:
				"Read-only: drift report or parsed .repos/config.json manifest with orientation and notes. mode=status is the per-repo drift summary from ReposManager (present/dirty/commit); mode=config is the parsed manifest; mode=drift reconciles all four submodule authorities (manifest, .gitmodules, worktree, git submodule status) and reports every disagreement; mode=gitmodules decodes the raw .gitmodules file's submodule sections.",
			inputSchema: {
				mode: ReposInspectModeSchema,
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ReposInspectResult) as never,
			annotations: { readOnlyHint: true },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(reposInspect(args as ReposInspectArgs, ctx.cwd));
			const text = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"repos_manage",
		{
			title: "Manage vendored repos",
			description:
				"Mutating: sync (initialize/reconcile submodules per the manifest), pin (re-pin a repo to a new ref), add (vendor a new repo), note (add/remove/promote an agent note), remove (unvendor a repo), rename (rename a vendored repo's manifest key and worktree), restore (hard-reset a repo's worktree back to its pinned gitlink commit and re-apply sparse paths — DESTRUCTIVE to uncommitted worktree edits; never run implicitly), or deregister (clear a STALE submodule.<section> registration from the superproject's local git config — the phantom entry repos_inspect drift reports as localRegistrationDivergence with no matching manifest entry; refuses a section outside .repos/ and any section still backing a live manifest entry — canonically named or gitdir-diverged — and touches local config only, so nothing is staged). Pass action plus the fields that action needs: pin needs name+ref; add needs url+ref+purpose (name/sparse/orientation optional — pass orientation back from a preceding remove's removedEntry to make a re-vendor lossless); note needs name+op, plus note (op=add), id (op=remove), or id+into (op=promote); remove needs name; rename needs name (the old name) + newName; restore takes an optional names list — omitted, it restores every dirty repo and reports the clean ones as skipped; given, it restores exactly those repos even if already clean; deregister needs section (the registration name exactly as the drift report states it, e.g. .repos/old-name — no submodule. prefix). A decode failure names the missing field. The pin result's markdown surfaces commitMessage and staleNoteIds — review and commit after pinning. The remove result's markdown surfaces commitMessage, removedNotes and the removed entry's orientation block — promote any durable notes elsewhere, keep the orientation if you intend to re-vendor, then review and commit. The rename result's markdown surfaces commitMessage — review and commit after renaming. The restore result's markdown names exactly what was discarded. The deregister result's markdown lists the config keys the removed section carried — nothing to commit afterwards.",
			inputSchema: {
				action: z
					.enum(["sync", "pin", "add", "note", "remove", "rename", "restore", "deregister"])
					.describe("Which mutation to perform."),
				name: z.optional(z.string()).describe("Repo name (pin, note, remove, rename; optional override for add)."),
				newName: z.optional(z.string()).describe("New repo name (rename)."),
				ref: z.optional(z.string()).describe("Git ref to pin/vendor to (pin, add)."),
				url: z.optional(z.string()).describe("Repo URL to vendor (add)."),
				purpose: z.optional(z.string()).describe("One-line purpose for the manifest (add)."),
				sparse: z.optional(z.array(z.string())).describe("Sparse-checkout patterns (add)."),
				orientation: z
					.optional(
						z.object({
							layout: z.optional(z.string()),
							keyPaths: z.optional(z.record(z.string(), z.string())),
							startHere: z.optional(z.string()),
						}),
					)
					.describe(
						"Orientation block to write (add). Pass back what a preceding remove reported as removedEntry.orientation — add does NOT restore it on its own, so a re-vendor loses it otherwise.",
					),
				op: z.optional(z.enum(["add", "remove", "promote"])).describe("Note operation (note)."),
				note: z.optional(z.string()).describe("Note text (note, op=add)."),
				id: z.optional(z.string()).describe("Note id (note, op=remove|promote)."),
				into: z.optional(z.enum(["layout", "startHere"])).describe("Orientation target (note, op=promote)."),
				names: z
					.optional(z.array(z.string()))
					.describe("Repo names to restore (restore); omitted restores every dirty repo."),
				section: z
					.optional(z.string())
					.describe(
						"Stale registration name to clear (deregister), exactly as the drift report states it (e.g. .repos/old-name); the submodule. prefix is implied.",
					),
				cwd: z.optional(z.string()).describe("Directory to resolve the workspace root from."),
			},
			outputSchema: effectToZodSchema(ReposManageResult) as never,
			annotations: { destructiveHint: true, idempotentHint: false },
		},
		async (args) => {
			const data = await ctx.runtime.runPromise(reposManage(args as ReposManageArgs, ctx.cwd));
			const text = Schema.decodeUnknownSync(ReposManageAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	server.registerTool(
		"biome_check",
		{
			description:
				"Run Biome over a path and get structured diagnostics back. mode=check (default; lint + format + organize-imports) or mode=lint. Set write=true to apply safe fixes (--write), unsafe=true for unsafe fixes (--write --unsafe). Severities match the project's Biome config (what `biome check` reports); set strict=true to surface project warnings as errors, each marked with its originalSeverity. Prefer this over shelling out to biome; the LSP already covers files you've edited. Returns markdown in content[] and a typed object in structuredContent. NOTE: with write/unsafe this tool MUTATES files (git-reversible).",
			inputSchema: {
				paths: z.optional(z.array(z.string())).describe("Paths to check. Defaults to the whole workspace."),
				mode: z
					.optional(z.enum(["check", "lint"]))
					.describe("check = lint+format+imports (default); lint = lint only."),
				write: z.optional(z.boolean()).describe("Apply safe fixes (--write)."),
				unsafe: z.optional(z.boolean()).describe("Apply unsafe fixes (--write --unsafe); implies write."),
				strict: z
					.optional(z.boolean())
					.describe("Report project warnings as errors (marked with originalSeverity). Default: honor project config."),
				cwd: z
					.optional(z.string())
					.describe(
						"Directory to run from. May be the server's workspace root, a directory inside it, or a git worktree of the SAME repository — a worktree contains the run to that worktree instead of the main checkout. Anything else is rejected.",
					),
			},
			outputSchema: effectToZodSchema(BiomeCheckResult) as never,
		},
		async (args) => {
			const data = await runBiomeCheck(args as BiomeCheckArgs, ctx.cwd);
			const text = Schema.decodeUnknownSync(BiomeCheckAsMarkdown)(data);
			return structuredResult(text, data);
		},
	);

	return server;
}

/** Build the server and connect it over stdio. */
export async function startMcpServer(ctx: McpContext): Promise<void> {
	const server = buildServer(ctx);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
