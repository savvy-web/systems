/**
 * The `changeset_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (branch | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Changesets namespace, plus a one-way markdown
 * transform. Read-only.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";
import { Effect, ParseResult, Schema } from "effect";
import type { WorkspaceRootNotFoundError } from "workspaces-effect";
import { WorkspaceRoot } from "workspaces-effect";

/** Branch-analysis variant. */
export const ChangesetBranchResult = Schema.Struct({
	mode: Schema.Literal("branch"),
	result: Changesets.BranchAnalysisSchema,
}).annotations({ identifier: "ChangesetBranchResult" });

/** Config-inspection variant. */
export const ChangesetConfigResult = Schema.Struct({
	mode: Schema.Literal("config"),
	result: Changesets.InspectedConfigSchema,
}).annotations({ identifier: "ChangesetConfigResult" });

/** Classify variant — arbitrary paths to owning package. */
export const ChangesetClassifyResult = Schema.Struct({
	mode: Schema.Literal("classify"),
	result: Schema.Array(Changesets.ClassificationSchema),
}).annotations({ identifier: "ChangesetClassifyResult" });

/** The `changeset_inspect` tool result — a discriminated union keyed by `mode`. */
export const ChangesetInspectResult = Schema.Union(
	ChangesetBranchResult,
	ChangesetConfigResult,
	ChangesetClassifyResult,
).annotations({
	identifier: "ChangesetInspectResult",
	title: "changeset_inspect result",
	description: "Read-only changeset analysis grouped by mode (branch | config | classify).",
});

export type ChangesetInspectResultType = Schema.Schema.Type<typeof ChangesetInspectResult>;

/**
 * Render a repo/config-derived value as an inert markdown code span. Escapes
 * backticks and backslashes so a crafted filename or package name cannot inject
 * markdown structure into the transcript that an agent reads.
 */
const mdInline = (value: string): string => `\`${value.replace(/[`\\]/g, "\\$&")}\``;

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ChangesetInspectResultType): string => {
	switch (data.mode) {
		case "branch": {
			const r = data.result;
			const lines = [
				`# changeset branch analysis — base ${mdInline(r.baseBranch)}`,
				``,
				`merge base: ${mdInline(r.mergeBaseSha)}`,
				``,
				`## Packages affected`,
				r.packagesAffected.map((p) => `- ${mdInline(p)}`).join("\n") || "(none)",
				``,
				`## Files`,
			];
			for (const f of r.files) {
				const owner = f.package ? mdInline(f.package) : "<unmapped>";
				lines.push(`- ${mdInline(f.status)}  ${mdInline(f.path)}  ->  ${owner}`);
			}
			if (r.unmappedFiles.length > 0) {
				lines.push(``, `## Unmapped (ask the user)`);
				for (const p of r.unmappedFiles) lines.push(`- ${mdInline(p)}`);
			}
			return lines.join("\n");
		}
		case "config": {
			const r = data.result;
			const lines = [
				`# changeset config — ${mdInline(r.configPath)}`,
				``,
				`base branch: ${mdInline(r.baseBranch)}`,
				`access: ${r.access}`,
				`changelog: ${r.changelog ? mdInline(r.changelog) : "(none)"}`,
				`ignored: ${r.ignore.map(mdInline).join(", ") || "(none)"}`,
				``,
				`## Packages`,
			];
			for (const p of r.packages) {
				lines.push(`### ${mdInline(p.name)} (${mdInline(p.version)})`, `- dir: ${mdInline(p.workspaceDir)}`);
				if (p.additionalScopes.length > 0)
					lines.push(`- additionalScopes: ${p.additionalScopes.map(mdInline).join(", ")}`);
				if (p.versionFiles.length > 0)
					lines.push(`- versionFiles: ${p.versionFiles.map((v) => mdInline(v.glob)).join(", ")}`);
			}
			if (r.packages.length === 0) lines.push("(none resolved)");
			return lines.join("\n");
		}
		case "classify": {
			const lines = [`# changeset classify`, ``];
			for (const c of data.result) {
				const owner = c.package ? mdInline(c.package) : "<unmapped>";
				lines.push(`- ${mdInline(c.path)}  ->  ${owner}`);
			}
			if (data.result.length === 0) lines.push("(no paths)");
			return lines.join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetInspectAsMarkdown = Schema.transformOrFail(ChangesetInspectResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(renderMarkdown(data)),
	encode: (text, _options, ast) =>
		ParseResult.fail(
			new ParseResult.Forbidden(ast, text, "ChangesetInspectAsMarkdown is one-way: markdown cannot be parsed back."),
		),
});

/** Arguments for the {@link changesetInspect} handler. */
export interface ChangesetInspectArgs {
	readonly mode: "branch" | "config" | "classify";
	readonly base?: string;
	readonly paths?: ReadonlyArray<string>;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then dispatch to the matching
 * Changesets service keyed by `mode`. Mirrors `turboInspect`.
 */
export const changesetInspect = (
	args: ChangesetInspectArgs,
	fallbackCwd: string,
): Effect.Effect<
	ChangesetInspectResultType,
	Changesets.ConfigurationError | Changesets.GitError | WorkspaceRootNotFoundError,
	Changesets.BranchAnalyzer | Changesets.ConfigInspector | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		switch (args.mode) {
			case "branch": {
				const analyzer = yield* Changesets.BranchAnalyzer;
				const result = yield* analyzer.analyzeBranch(root, args.base ? { baseBranch: args.base } : undefined);
				return { mode: "branch", result } as ChangesetInspectResultType;
			}
			case "config": {
				const inspector = yield* Changesets.ConfigInspector;
				const result = yield* inspector.inspect(root);
				return { mode: "config", result } as ChangesetInspectResultType;
			}
			case "classify": {
				const inspector = yield* Changesets.ConfigInspector;
				const result = yield* inspector.classify(root, args.paths ?? []);
				return { mode: "classify", result } as ChangesetInspectResultType;
			}
		}
	});
