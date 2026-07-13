/**
 * The `repos_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (status | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Repos namespace, plus a one-way markdown
 * transform. Read-only.
 *
 * @packageDocumentation
 */

import { Repos } from "@savvy-web/silk-effects";
import { Effect, ParseResult, Schema } from "effect";
import type { WorkspaceRootNotFoundError } from "workspaces-effect";
import { WorkspaceRoot } from "workspaces-effect";

/** Status-report variant. */
export const ReposStatusResult = Schema.Struct({
	mode: Schema.Literal("status"),
	result: Repos.ReposStatusReport,
}).annotations({ identifier: "ReposStatusResult" });

/** Manifest-config variant. */
export const ReposConfigResult = Schema.Struct({
	mode: Schema.Literal("config"),
	result: Repos.ReposManifestFile,
}).annotations({ identifier: "ReposConfigResult" });

/** The `repos_inspect` tool result — a discriminated union keyed by `mode`. */
export const ReposInspectResult = Schema.Union(ReposStatusResult, ReposConfigResult).annotations({
	identifier: "ReposInspectResult",
	title: "repos_inspect result",
	description: "Drift report (status) or the parsed manifest with purposes, orientation, and notes (config).",
});

export type ReposInspectResultType = Schema.Schema.Type<typeof ReposInspectResult>;

/**
 * Render a repo-derived value as an inert markdown code span. Backslash
 * escaping does NOT work inside code spans (CommonMark treats backslashes
 * literally there), so this uses the delimiter-run rule instead: wrap the
 * value in a backtick run strictly longer than any backtick run it contains,
 * padding with spaces when the value starts or ends with a backtick. This
 * keeps vendored-repo content (names, refs, purposes, orientation values,
 * note text) — the definition of untrusted input — from injecting markdown
 * structure into the transcript an agent reads.
 */
const mdInline = (value: string): string => {
	const runs = value.match(/`+/g) ?? [];
	const delimiter = "`".repeat(Math.max(1, ...runs.map((run) => run.length + 1)));
	const body = value.startsWith("`") || value.endsWith("`") ? ` ${value} ` : value;
	return `${delimiter}${body}${delimiter}`;
};

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ReposInspectResultType): string => {
	switch (data.mode) {
		case "status": {
			const r = data.result;
			const lines = [`# repos status`, ``, `clean: ${r.clean}`, ``, `## Repos`];
			for (const entry of r.repos) {
				lines.push(
					`### ${mdInline(entry.name)}`,
					`- ref: ${mdInline(entry.ref)}`,
					`- purpose: ${mdInline(entry.purpose)}`,
					`- present: ${entry.present}`,
					`- commit: ${entry.commit ? mdInline(entry.commit) : "(none)"}`,
					`- dirty: ${entry.dirty}`,
				);
				if (entry.staleNoteIds.length > 0) {
					lines.push(`- staleNoteIds: ${entry.staleNoteIds.map(mdInline).join(", ")}`);
				}
			}
			if (r.repos.length === 0) lines.push("(none)");
			return lines.join("\n");
		}
		case "config": {
			const r = data.result;
			const lines = [`# repos config`, ``, `## Repos`];
			for (const [name, entry] of Object.entries(r.repos)) {
				lines.push(
					`### ${mdInline(name)}`,
					`- url: ${mdInline(entry.url)}`,
					`- ref: ${mdInline(entry.ref)}`,
					`- purpose: ${mdInline(entry.purpose)}`,
				);
				if (entry.sparse && entry.sparse.length > 0) {
					lines.push(`- sparse: ${entry.sparse.map(mdInline).join(", ")}`);
				}
				if (entry.orientation) {
					const o = entry.orientation;
					if (o.layout) lines.push(`- layout: ${mdInline(o.layout)}`);
					if (o.startHere) lines.push(`- startHere: ${mdInline(o.startHere)}`);
					if (o.keyPaths) {
						lines.push(`- keyPaths:`);
						for (const [key, value] of Object.entries(o.keyPaths)) {
							lines.push(`  - ${mdInline(key)}: ${mdInline(value)}`);
						}
					}
				}
				if (entry.notes && entry.notes.length > 0) {
					lines.push(`- notes:`);
					for (const note of entry.notes) {
						lines.push(
							`  - ${mdInline(note.id)} (${mdInline(note.date)}, ref ${mdInline(note.ref)}): ${mdInline(note.note)}`,
						);
					}
				}
			}
			if (Object.keys(r.repos).length === 0) lines.push("(none)");
			return lines.join("\n");
		}
	}
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ReposInspectAsMarkdown = Schema.transformOrFail(ReposInspectResult, Schema.String, {
	strict: true,
	decode: (data) => ParseResult.succeed(renderMarkdown(data)),
	encode: (text, _options, ast) =>
		ParseResult.fail(
			new ParseResult.Forbidden(ast, text, "ReposInspectAsMarkdown is one-way: markdown cannot be parsed back."),
		),
});

/** Arguments for the {@link reposInspect} handler. */
export interface ReposInspectArgs {
	readonly mode: "status" | "config";
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then dispatch to the matching
 * Repos service keyed by `mode`. Mirrors `changesetInspect`.
 */
export const reposInspect = (
	args: ReposInspectArgs,
	fallbackCwd: string,
): Effect.Effect<
	ReposInspectResultType,
	Repos.ReposConfigError | Repos.GitSubmoduleError | WorkspaceRootNotFoundError,
	Repos.ReposManager | Repos.ReposConfigStore | WorkspaceRoot
> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);

		switch (args.mode) {
			case "status": {
				const manager = yield* Repos.ReposManager;
				const result = yield* manager.status(root);
				return { mode: "status", result } as ReposInspectResultType;
			}
			case "config": {
				const configStore = yield* Repos.ReposConfigStore;
				const result = yield* configStore.read(root);
				return { mode: "config", result } as ReposInspectResultType;
			}
		}
	});
