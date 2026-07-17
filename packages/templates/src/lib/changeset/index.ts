import { Effect, Schema } from "effect";
import type { TemplateEntry } from "../types.js";

const RepoPattern = Schema.String.check(Schema.isPattern(/^[^/\s]+\/[^/\s]+$/));

/**
 * Options for generating a Changesets configuration file.
 *
 * @public
 */
export const ChangesetOptions = Schema.Struct({
	access: Schema.Literals(["public", "restricted"]).pipe(
		Schema.withDecodingDefaultType(Effect.succeed("restricted" as const)),
	),
	baseBranch: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.succeed("main"))),
	changelog: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.succeed("@savvy-web/changesets/changelog"))),
	repo: Schema.optional(RepoPattern),
});

/**
 * The decoded type of {@link ChangesetOptions}.
 *
 * @public
 */
export type ChangesetOptionsType = typeof ChangesetOptions.Type;

/**
 * Generates a `.changeset/config.json` configuration file entry.
 *
 * @param options - the Changesets configuration options
 * @returns an array containing the generated changeset config entry
 * @public
 */
export function createChangeset(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(ChangesetOptions)(options);

	const config: Record<string, unknown> = {
		$schema: "https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json",
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
