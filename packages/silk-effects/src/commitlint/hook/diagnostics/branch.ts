/**
 * Branch and inferred-ticket detection.
 *
 * @internal
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";

const execFileP = promisify(execFile);

export interface BranchInfo {
	branch: string | null;
	inferredTicketId: number | null;
}

const TICKET_RE = /^[a-z]+\/(\d+)[-/_]/;

export function inferTicketId(branch: string): number | null {
	const m = branch.match(TICKET_RE);
	return m ? Number(m[1]) : null;
}

export function readBranchInfo(): Effect.Effect<BranchInfo> {
	return Effect.tryPromise(async () => {
		const { stdout } = await execFileP("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
		const branch = stdout.trim();
		return { branch, inferredTicketId: inferTicketId(branch) };
	}).pipe(Effect.orElseSucceed(() => ({ branch: null, inferredTicketId: null })));
}
