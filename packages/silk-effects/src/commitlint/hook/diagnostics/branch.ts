/**
 * Branch and inferred-ticket detection.
 *
 * @remarks
 * Branch lookup runs through `@effected/git`'s `currentBranch` (Option-shaped:
 * a detached `HEAD` is `Option.none`, not the literal string `"HEAD"`). Any
 * git failure degrades to the `{ branch: null }` fallback, preserving the
 * never-fails contract of the v3 implementation.
 *
 * @internal
 */
import { Git } from "@effected/git";
import { Effect, Option } from "effect";

export interface BranchInfo {
	branch: string | null;
	inferredTicketId: number | null;
}

const TICKET_RE = /^[a-z]+\/(\d+)[-/_]/;

export function inferTicketId(branch: string): number | null {
	const m = branch.match(TICKET_RE);
	return m ? Number(m[1]) : null;
}

export function readBranchInfo(): Effect.Effect<BranchInfo, never, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		const branchOption = yield* git.currentBranch(process.cwd());
		const branch = Option.getOrNull(branchOption);
		return { branch, inferredTicketId: branch === null ? null : inferTicketId(branch) };
	}).pipe(Effect.orElseSucceed((): BranchInfo => ({ branch: null, inferredTicketId: null })));
}
