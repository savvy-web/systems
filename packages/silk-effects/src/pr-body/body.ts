import type { LinkedIssueRef } from "./linked-issue.js";
import { Markers } from "./markers.js";
import { ClosingReferences, OwnedAttribute } from "./references.js";
import { Region } from "./region.js";

const FENCE = "```";

/**
 * The inputs to {@link ManagedPrBody.build}.
 *
 * @public
 */
export interface ManagedPrBodyOptions {
	/** The proposed squash-commit subject — a conventional-commit header. */
	readonly subject: string;
	/**
	 * Every issue this run knows about, open AND closed.
	 *
	 * @remarks
	 * The run decides every issue it knows about: an open issue is emitted, a
	 * closed one is dropped, and a carried line cannot resurrect one it
	 * deliberately dropped. Closedness is tested with
	 * `LinkedIssueRef.isClosed` (case-insensitive), so REST and GraphQL
	 * payloads both classify correctly.
	 */
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	/** The DCO signoff line the squash-commit block carries. */
	readonly signoff: string;
	/**
	 * The summary region's current content, from
	 * {@link ManagedPrBody.extractSummary}.
	 *
	 * @remarks
	 * Passed in rather than read from `priorBody` so `build` stays explicit
	 * about it: the summary's owner decides what it says, and this function
	 * must not quietly overrule a caller that passed one. `""` reserves an
	 * empty region.
	 */
	readonly summary: string;
	/**
	 * The PR's previous description, verbatim.
	 *
	 * @remarks
	 * The WHOLE prior body rather than an extracted region: merging
	 * references needs both the region's lines and the `owned` attribute on
	 * its opening marker, and two separate parameters would eventually be
	 * passed inconsistently. Optional because a PR being created has no
	 * prior body.
	 */
	readonly priorBody?: string;
}

/**
 * The marker-delimited reference region, merging this run's references with
 * any an agent added.
 *
 * @remarks
 * Module-private: the region is always emitted, empty or not, so an agent
 * always has a target to write into — the same reservation the summary
 * region makes.
 */
const buildReferencesRegion = (args: {
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	readonly carriedReferences: string;
	readonly previouslyOwned: ReadonlySet<number>;
}): string => {
	const known = new Set(args.linkedIssues.map((issue) => issue.number));
	// Deduplicated: two refs for one issue would otherwise render the reference
	// twice and emit `owned="170,170"`.
	const ownedNow = ClosingReferences.fromIssues(args.linkedIssues).dedupe();

	const agentAdded = [...new Set(ClosingReferences.parseBare(args.carriedReferences))]
		.filter((id) => !args.previouslyOwned.has(id) && !known.has(id))
		.sort((a, b) => a - b);

	const lines = ClosingReferences.make({ ids: [...ownedNow.ids, ...agentAdded] }).renderBareLines();
	const open = `${Markers.REFERENCES_START_PREFIX} ${OwnedAttribute.render(ownedNow.ids)} -->`;

	return `${open}\n${lines === "" ? "" : `${lines}\n`}${Markers.REFERENCES_END}`;
};

/**
 * The proposed squash-commit message, fenced for an AI integration to
 * rewrite.
 *
 * @remarks
 * Module-private. Carries its own `Closes` references because the squash
 * commit needs them too — a reference inside a fenced block is inert to
 * GitHub's linker, which is precisely why the plain-text lines outside it
 * are separate rather than shared.
 */
const buildSquashBlock = (args: {
	readonly subject: string;
	readonly linkedIssues: ReadonlyArray<LinkedIssueRef>;
	readonly signoff: string;
}): string => {
	const closing = ClosingReferences.fromIssues(args.linkedIssues).renderTrailer();
	const message = [args.subject, closing, args.signoff].filter((part) => part !== "").join("\n\n");
	return `${FENCE}${Markers.SQUASH_FENCE_LANGUAGE}\n${message}\n${FENCE}`;
};

/**
 * The shared managed-PR-body renderer and its carry-through readers — the
 * single implementation of the contract `silk-release-action` dogfooded at
 * `src/utils/pr-body.ts` (savvy-web/systems#419).
 *
 * @remarks
 * Every operation is pure and total: markers absent, regions broken, or
 * attributes malformed all degrade to the documented fail-safe result
 * (preserve too much rather than delete someone's work) instead of failing —
 * a regenerating action must still produce a body when the prior one is
 * malformed. Use `PrBodyDiagnostic.scan` where a writer wants to be told
 * about a broken pair instead of tolerating it.
 *
 * @public
 */
export class ManagedPrBody {
	private constructor() {}

	/**
	 * Build the region of the PR description the generating run owns.
	 *
	 * @remarks
	 * Delimited by `Markers.MANAGED_START` / `Markers.MANAGED_END` so
	 * {@link ManagedPrBody.upsert} can regenerate it without touching
	 * anything a human wrote around it. Layout, in order: the reserved
	 * summary region (nothing may sit above it — a reader meets the prose
	 * before the machinery), the proposed-squash-commit fence, and the
	 * bare-reference region. No preamble, no file listing, no linked-issues
	 * list, no run attribution — each said something already on the page.
	 *
	 * @public
	 */
	static build(options: ManagedPrBodyOptions): string {
		const parts: Array<string> = [];

		// The summary region, reserved first and left to its owner. Emitted
		// whether or not it has content, so a summariser has somewhere to write
		// on a PR this run created.
		parts.push(
			`${Markers.SUMMARY_START}\n${options.summary === "" ? "" : `${options.summary}\n`}${Markers.SUMMARY_END}`,
		);

		parts.push(
			buildSquashBlock({
				subject: options.subject,
				linkedIssues: options.linkedIssues,
				signoff: options.signoff,
			}),
		);

		// The bare references, OUTSIDE the fence and one per line — what GitHub
		// links on. Emitted unconditionally: an empty region is still an
		// addressable one, and a release with nothing linked is exactly when an
		// agent is most likely to want to add a reference.
		const priorBody = options.priorBody ?? "";
		parts.push(
			buildReferencesRegion({
				linkedIssues: options.linkedIssues,
				carriedReferences: ManagedPrBody.extractReferences(priorBody),
				previouslyOwned: OwnedAttribute.parse(priorBody),
			}),
		);

		return `${Markers.MANAGED_START}\n${parts.join("\n\n")}\n${Markers.MANAGED_END}`;
	}

	/**
	 * Put `managed` (a full {@link ManagedPrBody.build} result) into
	 * `existing`, replacing a previous managed region and leaving everything
	 * else alone.
	 *
	 * @remarks
	 * Human edits outside the markers survive; a body with no markers keeps
	 * its content and gains the region below it. See `Region.upsert` for the
	 * splice semantics.
	 *
	 * @public
	 */
	static upsert(existing: string, managed: string): string {
		return Region.upsert(existing, "silk-release", managed);
	}

	/**
	 * The summary region's current content, or `""` when it is empty or
	 * absent.
	 *
	 * @remarks
	 * Extraction exists because the managed region is REGENERATED on every
	 * run. Re-emitting the region empty would delete a summary the moment
	 * any commit landed — destructive and silent, with no signal back to the
	 * summariser whose work was discarded. Feed the result to
	 * {@link ManagedPrBody.build}'s `summary` option.
	 *
	 * @public
	 */
	static extractSummary(existing: string): string {
		const from = existing.indexOf(Markers.SUMMARY_START);
		const to = existing.indexOf(Markers.SUMMARY_END);
		if (from === -1 || to === -1 || to < from) return "";
		return existing.slice(from + Markers.SUMMARY_START.length, to).trim();
	}

	/**
	 * The reference region's current content, or `""` when it is empty or
	 * absent.
	 *
	 * @remarks
	 * Symmetric to {@link ManagedPrBody.extractSummary}, and for the same
	 * reason. Located by `Markers.REFERENCES_START_PREFIX` — never the plain
	 * opening constant — because a generating run emits the attributed form.
	 *
	 * @public
	 */
	static extractReferences(existing: string): string {
		const from = existing.indexOf(Markers.REFERENCES_START_PREFIX);
		const to = existing.indexOf(Markers.REFERENCES_END);
		if (from === -1 || to === -1 || to < from) return "";
		// Past the end of the opening marker, whatever attributes it carries.
		const openEnd = existing.indexOf("-->", from);
		if (openEnd === -1 || openEnd > to) return "";
		return existing.slice(openEnd + "-->".length, to).trim();
	}
}
