/**
 * closes-trailer rule — advises when the branch encodes a ticket id but
 * the message body has no Closes/Fixes/Resolves trailer for it.
 *
 * @internal
 */
import { parseClosingLists } from "@effected/github-references";
import { Effect } from "effect";
import type { BranchInfo } from "../diagnostics/branch.js";
import type { OpenIssue } from "../diagnostics/open-issues.js";
import type { Rule } from "./types.js";

export interface ClosesTrailerInput {
	message: string;
}

export interface ClosesTrailerCtx {
	branchInfo: BranchInfo;
	openIssues: ReadonlyArray<OpenIssue>;
}

/**
 * Whether some line of the message is a closing trailer naming `ticketId`.
 *
 * @remarks
 * The message is read with `@effected/github-references`' `parseClosingLists`:
 * per line, the whole line, after trimming, must be a closing keyword (any of
 * GitHub's nine tenses, optional colon) followed by its full `#N` list —
 * comma, `and`, or Oxford `, and` separated — so every id in the house
 * one-trailer format (`Closes #247, #248, #251`) counts, not just the first.
 * A `#N` mentioned mid-prose never qualifies: a trailer is a line of its own,
 * which is why this rule deliberately stays on the whole-line dialect rather
 * than the inline harvest.
 *
 * @internal
 */
export function hasClosingTrailer(message: string, ticketId: number): boolean {
	return parseClosingLists(message).some((list) => list.issueNumbers.includes(ticketId));
}

export const closesTrailerRule: Rule<ClosesTrailerInput, ClosesTrailerCtx> = {
	id: "closes-trailer",
	severity: "advise",
	check: (input, ctx) =>
		Effect.sync(() => {
			const tid = ctx.branchInfo.inferredTicketId;
			if (tid === null) return null;
			if (hasClosingTrailer(input.message, tid)) return null;

			const openList = ctx.openIssues.map((i) => `  #${i.number}  ${i.title}`).join("\n");
			const tail = openList.length > 0 ? `\n\nOpen issues in this repo:\n${openList}` : "";

			return {
				ruleId: "closes-trailer",
				severity: "advise" as const,
				message:
					`Branch ${ctx.branchInfo.branch} looks like ticket #${tid} but the message has no Closes/Fixes/Resolves #${tid} trailer. ` +
					`If this commit closes #${tid}, add 'Closes #${tid}' above the Signed-off-by line.${tail}`,
			};
		}),
};
