/**
 * The `repos_inspect` MCP tool: a discriminated-union result keyed by `mode`
 * (status | config), each variant embedding the corresponding resolved-output
 * schema from silk-effects' Repos namespace, plus a one-way markdown
 * transform. Read-only.
 *
 * @packageDocumentation
 */

import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Schema, SchemaGetter } from "effect";
import { mdInline } from "./md-inline.js";

/** Status-report variant. */
export const ReposStatusResult = Schema.Struct({
	mode: Schema.Literal("status"),
	result: Repos.ReposStatusReport,
}).annotate({ identifier: "ReposStatusResult" });

/** Manifest-config variant. */
export const ReposConfigResult = Schema.Struct({
	mode: Schema.Literal("config"),
	result: Repos.ReposManifestFile,
}).annotate({ identifier: "ReposConfigResult" });

/** The `repos_inspect` tool result — a discriminated union keyed by `mode`. */
export const ReposInspectResult = Schema.Union([ReposStatusResult, ReposConfigResult]).annotate({
	identifier: "ReposInspectResult",
	title: "repos_inspect result",
	description: "Drift report (status) or the parsed manifest with purposes, orientation, and notes (config).",
});

export type ReposInspectResultType = Schema.Schema.Type<typeof ReposInspectResult>;

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
export const ReposInspectAsMarkdown = ReposInspectResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ReposInspectAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

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
