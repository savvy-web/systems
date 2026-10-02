/**
 * What every `savvy repos` subcommand shares: mapping a `Repos` error to the
 * {@link CommandError} a person reads, the friendly "nothing vendored" line,
 * and picking a vendored repo when a name was left off at a terminal.
 *
 * @internal
 */

import type { Cancelled } from "@effected/cli";
import { CliInteractive } from "@effected/cli";
import type { MultiSelectItem } from "@effected/cli/ui";
import { CliUi, MultiSelect, Select, TextInput } from "@effected/cli/ui";
import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { CliError } from "effect/cli";

import { CommandError } from "../../internal/command-error.js";
import { FailureLine } from "../../internal/failure-line.js";
import type { ReportEnv } from "../../internal/report.js";
import { Report } from "../../internal/report.js";

/** Every error a `ReposManager` method can fail with. */
export type ReposError =
	| Repos.ReposConfigError
	| Repos.GitSubmoduleError
	| Repos.RepoNotFoundError
	| Repos.NoteNotFoundError
	| Repos.ReposLockdownError;

/** What a person can do about each repos failure. */
const hints: { readonly [K in ReposError["_tag"]]: string } = {
	ReposConfigError:
		"fix .repos/config.json (it is versioned: git diff / git checkout it), then run `savvy repos status`",
	GitSubmoduleError:
		"run `savvy repos status --drift` to see what git disagrees with, then `savvy repos sync` to repair",
	RepoNotFoundError: "run `savvy repos status` to list the vendored repos",
	NoteNotFoundError: "the note ids are under the repo's `notes` in .repos/config.json",
	ReposLockdownError: "run `savvy repos sync` to re-assert the read-only lockdown on the vendored trees",
};

/**
 * Helpers shared by the `savvy repos` subcommands.
 *
 * @internal
 */
export class ReposCli {
	private constructor() {}

	/** The line every mutating repos command prints, exit 0, when there is no manifest yet. */
	static readonly nothingVendored: Effect.Effect<void, never, ReportEnv> = Report.print([
		Report.skip("no .repos/config.json — nothing vendored"),
	]);

	/**
	 * `error` as the {@link CommandError} a command fails with: `could not <action>`,
	 * the error's own description (a git failure's lines kept apart), and a hint
	 * for its kind. `hint` overrides the kind's own.
	 */
	static readonly toCommandError = (action: string, error: ReposError, hint?: string): CommandError =>
		new CommandError({
			message: `could not ${action}`,
			detail: FailureLine.describe(error).split("\n"),
			hint: hint ?? hints[error._tag],
			cause: error,
		});

	/** Fail with {@link ReposCli.toCommandError}; for `Effect.catchTags`/`catchTag` arms. */
	static readonly fail =
		(action: string, hint?: string) =>
		(error: ReposError): Effect.Effect<never, CommandError> =>
			Effect.fail(ReposCli.toCommandError(action, error, hint));

	/**
	 * A missing required positional as core reports it — a usage error, which
	 * `Command.runWith` renders and `CliRuntime.main` exits `64` on.
	 */
	static readonly missingArgument = (argument: string): CliError.UserError =>
		new CliError.UserError({ cause: `Missing required argument: ${argument}` });

	/**
	 * The vendored repos (name, ref, and whether dirty), read from
	 * `ReposManager.status` for a picker.
	 */
	static readonly vendored = (
		cwd: string,
	): Effect.Effect<
		Repos.ReposStatusReport["repos"],
		Repos.ReposConfigError | Repos.GitSubmoduleError,
		Repos.ReposManager
	> =>
		Effect.gen(function* () {
			const manager = yield* Repos.ReposManager;
			return (yield* manager.status(cwd)).repos;
		});

	/**
	 * The repo name a command was given, or — when it was left off — one picked
	 * from the vendored repos on a `Select` when a person is at the terminal.
	 *
	 * @remarks
	 * Not interactive (an agent, CI, a pipe), a missing name stays what it was
	 * when the argument was required: a usage error, exit `64`, and the manifest
	 * is never read. With nothing vendored there is nothing to pick from, which
	 * is also the usage error. Esc on the picker is the kit's `Cancelled` (exit
	 * `130`).
	 */
	static readonly nameOrPick = (
		cwd: string,
		given: string | undefined,
		options: { readonly argument: string; readonly message: string },
	): Effect.Effect<
		string,
		CliError.UserError | Cancelled | Repos.ReposConfigError | Repos.GitSubmoduleError,
		Repos.ReposManager | ReportEnv
	> =>
		Effect.gen(function* () {
			if (given !== undefined) return given;
			if (!(yield* CliInteractive)) return yield* Effect.fail(ReposCli.missingArgument(options.argument));
			const repos = yield* ReposCli.vendored(cwd);
			if (repos.length === 0) return yield* Effect.fail(ReposCli.missingArgument(options.argument));
			return yield* CliUi.prompt(
				Select.screen({
					message: options.message,
					choices: repos.map((repo) => ({ label: repo.name, value: repo.name, detail: `@ ${repo.ref}` })),
				}),
			).pipe(Effect.catchTag("NotInteractive", () => Effect.fail(ReposCli.missingArgument(options.argument))));
		});

	/**
	 * A positional the command was given, or — when it was left off at a
	 * terminal — typed on a `TextInput`; a usage error anywhere else.
	 *
	 * @remarks
	 * For the positional that follows an optional repo name (`pin <name> <ref>`):
	 * core binds a lone argument to the first optional positional, so once the
	 * name is optional the one after it must be optional too, and asked for here.
	 */
	static readonly textOrAsk = (
		given: string | undefined,
		options: { readonly argument: string; readonly message: string; readonly initial?: string | undefined },
	): Effect.Effect<string, CliError.UserError | Cancelled, ReportEnv> =>
		Effect.gen(function* () {
			if (given !== undefined) return given;
			if (!(yield* CliInteractive)) return yield* Effect.fail(ReposCli.missingArgument(options.argument));
			return yield* CliUi.prompt(
				TextInput.screen({
					message: options.message,
					...(options.initial === undefined ? {} : { initial: options.initial }),
					validate: (value) => (value.trim() === "" ? `${options.argument} is required` : undefined),
				}),
			).pipe(
				Effect.map((value) => value.trim()),
				Effect.catchTag("NotInteractive", () => Effect.fail(ReposCli.missingArgument(options.argument))),
			);
		});

	/**
	 * Which dirty repos to restore, asked on a `MultiSelect` with every dirty
	 * repo preselected. Only called when a person is at the terminal.
	 */
	static readonly pickDirty = (
		names: ReadonlyArray<string>,
	): Effect.Effect<ReadonlyArray<string>, Cancelled, ReportEnv> => {
		const items: ReadonlyArray<MultiSelectItem<string>> = names.map((name) => ({
			key: name,
			label: name,
			value: name,
			selected: true,
		}));
		return CliUi.prompt(
			MultiSelect.screen({
				message: "Restore which repos? (uncommitted edits are lost)",
				sections: [{ title: "dirty", items }],
			}),
			{ otherwise: names },
		).pipe(Effect.catchTag("NotInteractive", () => Effect.succeed(names)));
	};
}
