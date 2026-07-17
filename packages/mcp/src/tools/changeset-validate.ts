/**
 * The `changeset_validate` MCP tool: structured changeset-file validation over
 * silk-effects' pure ChangesetLinter, returning typed diagnostics plus a
 * pass/fail summary. Read-only.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";
import type { WorkspaceRootNotFoundError } from "@effected/workspaces";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Data, Effect, Schema, SchemaGetter } from "effect";

/** A thrown failure from the pure {@link Changesets.ChangesetLinter.validate} (e.g. a missing directory). */
export class ChangesetValidateError extends Data.TaggedError("ChangesetValidateError")<{
	readonly dir: string;
	readonly cause: unknown;
}> {}

/** A single changeset lint diagnostic. Mirrors silk-effects' `LintMessage`. */
export const ChangesetLintMessage = Schema.Struct({
	file: Schema.String,
	rule: Schema.String,
	line: Schema.Number,
	column: Schema.Number,
	message: Schema.String,
}).annotate({ identifier: "ChangesetLintMessage" });

/** The `changeset_validate` tool result. */
export const ChangesetValidateResult = Schema.Struct({
	dir: Schema.String,
	ok: Schema.Boolean,
	errorCount: Schema.Number,
	messages: Schema.Array(ChangesetLintMessage),
}).annotate({
	identifier: "ChangesetValidateResult",
	title: "changeset_validate result",
	description: "Read-only validation of changeset files against the section-aware rules.",
});

export type ChangesetValidateResultType = Schema.Schema.Type<typeof ChangesetValidateResult>;

/**
 * Render a repo/lint-derived value as an inert markdown code span. Escapes
 * backticks and backslashes so a crafted filename or message cannot inject
 * markdown structure into the transcript that an agent reads.
 */
const mdInline = (value: string): string => `\`${value.replace(/[`\\]/g, "\\$&")}\``;

/** Render the structured result as a markdown transcript. */
const renderMarkdown = (data: ChangesetValidateResultType): string => {
	if (data.ok) {
		return `# changeset validate — ${mdInline(data.dir)}\n\nNo changeset issues found.`;
	}
	const lines = [`# changeset validate — ${mdInline(data.dir)}`, ``, `${data.errorCount} issue(s):`, ``];
	for (const m of data.messages) {
		lines.push(`- ${mdInline(`${m.file}:${m.line}:${m.column}`)} ${mdInline(m.rule)} — ${m.message}`);
	}
	return lines.join("\n");
};

/** One-way transform: result to markdown. Encoding back is forbidden. */
export const ChangesetValidateAsMarkdown = ChangesetValidateResult.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform(renderMarkdown),
		encode: SchemaGetter.forbidden(() => "ChangesetValidateAsMarkdown is one-way: markdown cannot be parsed back."),
	}),
);

/** Arguments for the {@link changesetValidate} handler. */
export interface ChangesetValidateArgs {
	readonly dir?: string;
	readonly cwd?: string;
}

/**
 * Effect handler: resolve the workspace root, then validate the changeset
 * directory via the pure {@link Changesets.ChangesetLinter.validate}. The
 * synchronous call is wrapped in {@link Effect.try} so a thrown error (e.g. a
 * missing directory) surfaces as a typed {@link ChangesetValidateError} rather
 * than escaping as a defect.
 */
export const changesetValidate = (
	args: ChangesetValidateArgs,
	fallbackCwd: string,
): Effect.Effect<ChangesetValidateResultType, WorkspaceRootNotFoundError | ChangesetValidateError, WorkspaceRoot> =>
	Effect.gen(function* () {
		const workspaceRoot = yield* WorkspaceRoot;
		const root = yield* workspaceRoot.find(args.cwd ?? fallbackCwd);
		const dir = resolve(root, args.dir ?? ".changeset");
		const messages = yield* Effect.try({
			try: () => Changesets.ChangesetLinter.validate(dir),
			catch: (cause) => new ChangesetValidateError({ dir, cause }),
		});
		return {
			dir,
			ok: messages.length === 0,
			errorCount: messages.length,
			messages,
		} as ChangesetValidateResultType;
	});
