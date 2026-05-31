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

export function hasClosingTrailer(message: string, ticketId: number): boolean {
	const re = new RegExp(`\\b(closes|fixes|resolves)\\s+#${ticketId}\\b`, "i");
	return re.test(message);
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
