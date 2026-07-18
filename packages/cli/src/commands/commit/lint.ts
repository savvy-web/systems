/**
 * `savvy commit lint <file>` — validate a CANDIDATE commit-message file
 * against the real Silk commitlint preset BEFORE committing.
 *
 * @remarks
 * Answers "would this message pass?" by running the same rule engine the
 * husky `commit-msg` hook enforces (`commitlint --edit <file>`), rather than
 * the advisory heuristics behind `hook pre-commit-message`. Exits non-zero
 * when commitlint rejects the message and 0 when it passes; commitlint's own
 * stdout/stderr is surfaced verbatim so the user sees the actual violations.
 *
 * @internal
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Git } from "@effected/git";
import { Commitlint } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, CliError, Command } from "effect/unstable/cli";
import { buildCommitlintInvocation } from "./commitlint-invocation.js";

const execFileP = promisify(execFile);

/** The repo root via `@effected/git`, degrading to `process.cwd()`. */
const getRepoRoot: Effect.Effect<string, never, Git> = Effect.gen(function* () {
	const git = yield* Git;
	return yield* git.repoRoot(process.cwd()).pipe(Effect.catch(() => Effect.succeed(process.cwd())));
});

export interface CommitlintEditResult {
	passed: boolean;
	stdout: string;
	stderr: string;
}

/**
 * Run `commitlint --edit <file>` and capture its output.
 *
 * A zero exit resolves to `passed: true`; a non-zero exit (commitlint's way
 * of signalling violations) resolves to `passed: false` with the captured
 * diagnostics — the promise never rejects.
 *
 * @internal
 */
function runCommitlintEdit(root: string, file: string): Promise<CommitlintEditResult> {
	return (async () => {
		const pm = await Commitlint.detectPackageManager(root);
		const configPath = await Commitlint.readCommitlintConfigPath(root);
		const { command, args } = buildCommitlintInvocation(pm, configPath, ["--edit", file]);
		try {
			const { stdout, stderr } = await execFileP(command, args, { cwd: root });
			return { passed: true, stdout, stderr };
		} catch (error) {
			const e = error as { stdout?: string; stderr?: string; message?: string };
			return {
				passed: false,
				stdout: e.stdout ?? "",
				stderr: e.stderr ?? e.message ?? String(error),
			};
		}
	})();
}

/**
 * Validate a candidate commit-message file against the Silk commitlint preset.
 *
 * Surfaces commitlint's own output, then fails the effect (non-zero exit) when
 * the message is rejected so callers — the `commit-create` skill script, CI,
 * or a human — get an honest pass/fail signal before `git commit` runs.
 *
 * @param file - Path to the candidate commit-message file.
 * @returns An Effect that runs commitlint and fails on rejection.
 *
 * @internal
 */
export function runCommitLint(file: string) {
	return Effect.gen(function* () {
		const root = yield* getRepoRoot;
		const { passed, stdout, stderr } = yield* Effect.promise(() => runCommitlintEdit(root, file));

		if (stdout.length > 0) {
			yield* Effect.sync(() => process.stdout.write(stdout));
		}
		if (stderr.length > 0) {
			yield* Effect.sync(() => process.stderr.write(stderr));
		}

		if (!passed) {
			return yield* Effect.fail(
				new CliError.UserError({ cause: `Commit message at ${file} failed commitlint validation` }),
			);
		}

		yield* Effect.log("Commit message passes the Silk commitlint preset.");
	});
}

/* v8 ignore next */
const fileArg = Argument.file("file", { mustExist: true });

/* v8 ignore next 3 -- CLI registration; handler tested via runCommitLint */
export const lintCommand = Command.make("lint", { file: fileArg }, ({ file }) => runCommitLint(file)).pipe(
	Command.withDescription("Validate a candidate commit-message file against the Silk commitlint preset"),
);
