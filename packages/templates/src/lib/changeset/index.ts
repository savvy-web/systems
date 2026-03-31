import { Schema } from "effect";
import type { TemplateEntry } from "../types.js";

const RepoPattern = Schema.String.pipe(Schema.pattern(/^[^/\s]+\/[^/\s]+$/));

export const ChangesetOptions = Schema.Struct({
	access: Schema.optionalWith(Schema.Literal("public", "restricted"), { default: () => "restricted" as const }),
	baseBranch: Schema.optionalWith(Schema.String, { default: () => "main" }),
	changelog: Schema.optionalWith(Schema.String, { default: () => "@savvy-web/changesets/changelog" }),
	repo: Schema.optional(RepoPattern),
});

export type ChangesetOptionsType = typeof ChangesetOptions.Type;

export function createChangeset(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(ChangesetOptions)(options);

	const config: Record<string, unknown> = {
		$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
		changelog: opts.repo ? [opts.changelog, { repo: opts.repo }] : opts.changelog,
		commit: false,
		fixed: [],
		linked: [],
		access: opts.access,
		baseBranch: opts.baseBranch,
		updateInternalDependencies: "patch",
		privatePackages: {
			version: true,
			tag: false,
		},
		ignore: [],
	};

	const content = JSON.stringify(config, null, "\t");

	return [{ name: "changeset", filename: ".changeset/config.json", content }];
}
