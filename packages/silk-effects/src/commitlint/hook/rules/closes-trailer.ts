/**
 * closes-trailer rule — advises when the branch encodes a ticket id but
 * the message body has no Closes/Fixes/Resolves trailer for it.
 *
 * @internal
 */
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
 * A closing keyword followed by its full list of issue references.
 *
 * @remarks
 * The house commit format puts every issue on ONE comma-separated trailer
 * (`Closes #247, #248, #251`), so a pattern anchored on `keyword\s+#N` sees
 * only the first id and reports a missing trailer that is plainly present.
 * Capturing the whole list and scanning it is what makes the later ids count.
 *
 * `and` is accepted alongside the comma because humans write it; the optional
 * colon matches the `Closes: #N` form the validator's trailer pattern allows.
 *
 * @internal
 */
const CLOSING_LIST_PATTERN = /\b(?:closes|fixes|resolves):?\s+(#\d+(?:\s*(?:,|and)\s*#\d+)*)/gi;

/**
 * Reference ids within a captured closing list.
 *
 * @internal
 */
const REFERENCE_PATTERN = /#(\d+)/g;

export function hasClosingTrailer(message: string, ticketId: number): boolean {
	// String.prototype.matchAll clones the receiver, so these module-level
	// global regexes carry no lastIndex state between calls.
	for (const keywordMatch of message.matchAll(CLOSING_LIST_PATTERN)) {
		const list = keywordMatch[1];
		if (list === undefined) continue;
		for (const reference of list.matchAll(REFERENCE_PATTERN)) {
			if (Number(reference[1]) === ticketId) return true;
		}
	}
	return false;
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
