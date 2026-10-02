/**
 * `repos add` command -- vendor a new reference repo under `.repos/`.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.add}: adds a shallow git
 * submodule, checks it out at the requested ref, optionally applies a
 * sparse-checkout, and writes a new manifest entry -- it does not commit, so
 * the caller reviews and commits the staged `.gitmodules`/manifest/gitlink
 * change. A `ReposConfigError` with kind `"missing"` -- no manifest yet --
 * is the common, friendly case and always exits 0 (the manifest is created
 * on demand by `add` itself, so this only fires on a read that raced a
 * concurrent removal). A `ReposConfigError` with kind `"invalid"` means the
 * manifest exists but is corrupt or unreadable, `GitSubmoduleError` means
 * the underlying git command failed, and `ReposLockdownError` means the
 * OS-permission lockdown pass on a vendored tree failed -- all three are
 * real failures, failing as a `CommandError` (exit 1) with a hint.
 *
 * `--ref` and `--purpose` are required. Left off at a terminal, each is asked
 * for with core's line prompt (`CliPrompt.fallback`); left off anywhere else
 * (an agent, CI, a pipe) it stays core's missing-flag usage error, exit 64.
 *
 * @example
 * ```bash
 * savvy repos add https://github.com/foo/bar --ref v1.0.0 --purpose "vendor demo"
 * savvy repos add https://github.com/foo/bar --ref main --purpose "vendor demo" --sparse src --sparse docs --name bar-vendored
 * ```
 *
 * @internal
 */

import { CliPrompt } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/* v8 ignore start -- CLI option/arg definitions */
const urlArg = Argument.String("url");
// Asked for at a terminal when left off; a missing-flag usage error everywhere else (no `otherwise`).
const refOption = Flag.String("ref").pipe(
	Flag.withDescription("Ref (tag, branch, or commit) to check out"),
	Flag.withFallbackPrompt(
		CliPrompt.fallback(Prompt.String({ message: "Ref to check out (tag, branch, or commit)" }), { flag: "ref" }),
	),
);
const purposeOption = Flag.String("purpose").pipe(
	Flag.withDescription("Why this repo is vendored"),
	Flag.withFallbackPrompt(
		CliPrompt.fallback(Prompt.String({ message: "Why is this repo vendored?" }), { flag: "purpose" }),
	),
);
const nameOption = Flag.String("name").pipe(
	Flag.withDescription("Vendored directory name; defaults to the URL's last path segment"),
	Flag.optional,
);
const sparseOption = Flag.String("sparse").pipe(
	Flag.withDescription("Sparse-checkout path; repeatable"),
	Flag.atLeast(0),
);
const cwdOption = Flag.Directory("cwd").pipe(Flag.withDescription("Repo root to add within"), Flag.withDefault("."));
/* v8 ignore stop */

/**
 * Add handler; exported for tests.
 *
 * @internal
 */
export const runReposAdd = (
	cwd: string,
	opts: {
		readonly url: string;
		readonly ref: string;
		readonly purpose: string;
		readonly name?: string;
		readonly sparse?: ReadonlyArray<string>;
	},
) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.add(cwd, opts);
		yield* Report.print([Report.ok(`${result.name} @ ${result.ref} -> ${result.path}`, "staged — review and commit")]);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail(`vendor ${opts.url}`)(error),
		),
		Effect.catchTag(["GitSubmoduleError", "ReposLockdownError"], ReposCli.fail(`vendor ${opts.url}`)),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposAdd, the fallbacks via the command itself */
export const addCommand = Command.make(
	"add",
	{ url: urlArg, ref: refOption, purpose: purposeOption, name: nameOption, sparse: sparseOption, cwd: cwdOption },
	({ url, ref, purpose, name, sparse, cwd }) =>
		runReposAdd(cwd, {
			url,
			ref,
			purpose,
			...(Option.isSome(name) ? { name: name.value } : {}),
			...(sparse.length > 0 ? { sparse } : {}),
		}),
).pipe(Command.withDescription("Vendor a new reference repo under .repos/; stages the change without committing"));
/* v8 ignore stop */
