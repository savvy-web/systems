import type { Effect } from "effect";
import { Context } from "effect";
import type { ChangesetError } from "../errors/ChangesetError.js";
import type { BumpType, Changeset, ChangesetFile } from "../schemas/Changeset.js";

/**
 * Service shape for {@link ChangesetAnalyzer}.
 *
 * @public
 */
export interface ChangesetAnalyzerShape {
	/** Parse all changeset files in the given directory. */
	readonly parseAll: (dir?: string) => Effect.Effect<Array<Changeset>, ChangesetError>;

	/** Check if any changeset files exist (excluding README.md). */
	readonly hasChangesets: (dir?: string) => Effect.Effect<boolean>;

	/** Generate a changeset file with YAML frontmatter. */
	readonly generate: (
		packages: Array<{ name: string; bump: BumpType }>,
		summary: string,
		dir?: string,
	) => Effect.Effect<ChangesetFile, ChangesetError>;
}

/**
 * Service for changeset file operations.
 *
 * @public
 */
export class ChangesetAnalyzer extends Context.Service<ChangesetAnalyzer, ChangesetAnalyzerShape>()(
	"github-action-effects/ChangesetAnalyzer",
) {}
