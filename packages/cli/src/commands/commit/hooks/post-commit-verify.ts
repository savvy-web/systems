/**
 * `savvy commit hook post-commit-verify` — replays commitlint, checks the
 * signature, and verifies the closes trailer if the branch implies one.
 *
 * @internal
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Git } from "@effected/git";
import { Commitlint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { buildCommitlintInvocation } from "../commitlint-invocation.js";

const execFileP = promisify(execFile);

export interface PostCommitInputs {
	commitlintFailed: boolean;
	sigStatus: string;
	autoSignEnabled: boolean;
	branchTicketId: number | null;
	bodyHasClosing: boolean;
}

export function buildPostCommitAdvice(i: PostCommitInputs): string | null {
	const lines: string[] = [];

	if (i.commitlintFailed) {
		lines.push(
			"The commit you just created fails commitlint validation. Run pnpm exec commitlint --last to see the violations, then fix with git commit --amend.",
		);
	}

	if (i.autoSignEnabled) {
		if (i.sigStatus === "N") {
			lines.push(
				"The commit was unsigned but commit.gpgsign=true is configured. Re-sign with: git commit --amend --no-edit -S",
			);
		} else if (["B", "X", "Y", "R"].includes(i.sigStatus)) {
			// NOT "E". git reports E for "signature cannot be checked (e.g. missing
			// key)" — the commit is signed, but this process cannot reach the keyring
			// or gpg-agent to verify it, which is routine inside a hook subprocess.
			// A failure to VERIFY is not a defective signature: the same commit that
			// reports E here reports G from an interactive shell. Advising an amend
			// on E told users to repair a commit that was correctly signed.
			lines.push(
				`The commit signature status is '${i.sigStatus}' (B=bad, X=expired sig, Y=expired key, R=revoked). Investigate your signing setup and amend.`,
			);
		}
	}

	if (i.branchTicketId !== null && !i.bodyHasClosing) {
		lines.push(
			`Branch implies ticket #${i.branchTicketId} but the commit body has no Closes/Fixes/Resolves trailer for it. If this commit closes #${i.branchTicketId}, amend with: git commit --amend --no-edit --trailer "Closes: #${i.branchTicketId}"`,
		);
	}

	return lines.length === 0 ? null : lines.join("\n\n");
}

/** The repo root via `@effected/git`, degrading to `process.cwd()` — the prior execFile contract. */
const getRepoRoot: Effect.Effect<string, never, Git> = Effect.gen(function* () {
	const git = yield* Git;
	return yield* git.repoRoot(process.cwd()).pipe(Effect.catch(() => Effect.succeed(process.cwd())));
});

function runCommitlintLast(root: string): Promise<boolean> {
	return (async () => {
		const pm = await Commitlint.detectPackageManager(root);
		const configPath = await Commitlint.readCommitlintConfigPath(root);
		const { command, args } = buildCommitlintInvocation(pm, configPath, ["--last"]);
		try {
			await execFileP(command, args, { cwd: root });
			return false;
		} catch {
			return true;
		}
	})();
}

export const postCommitVerifyCommand = Command.make("post-commit-verify", {}, () =>
	Effect.gen(function* () {
		const git = yield* Git;
		const branch = yield* Commitlint.readBranchInfo();
		const signing = yield* Commitlint.readSigningDiagnostic();

		const root = yield* getRepoRoot;
		const commitlintFailed = yield* Effect.promise(() => runCommitlintLast(root));
		// One `git log -1` read covers both the `%G?` verdict and the `%B` body;
		// failure degrades to the prior per-call fallbacks ("N" / "").
		const lastCommit = yield* git
			.commitInfo(root)
			.pipe(Effect.catch(() => Effect.succeed({ signatureStatus: "N" as const, message: "" })));
		const sigStatus = lastCommit.signatureStatus;
		const body = lastCommit.message;
		const bodyHasClosing =
			branch.inferredTicketId !== null && Commitlint.hasClosingTrailer(body, branch.inferredTicketId);

		const advice = buildPostCommitAdvice({
			commitlintFailed,
			sigStatus,
			autoSignEnabled: signing.autoSignEnabled,
			branchTicketId: branch.inferredTicketId,
			bodyHasClosing,
		});

		if (advice !== null) {
			yield* Effect.sync(() => process.stdout.write(`${JSON.stringify(Commitlint.postToolUseAdvise(advice))}\n`));
		}
	}).pipe(Effect.provide(Commitlint.HookSilencer)),
).pipe(Command.withDescription("Verify the most recent commit (commitlint replay + signature + closes trailer)"));
