/**
 * Stub `Repos` services and canned values for the `savvy repos` handler tests.
 *
 * Every manager method a test does not name dies, so a handler that reads
 * something it should not (a picker's `status` on a run that cannot prompt)
 * fails the test instead of passing quietly.
 */

import { NodeServices } from "@effect/platform-node";
import { CliAudience } from "@effected/cli";
import { Repos } from "@savvy-web/silk-effects";
import type { Effect as EffectType } from "effect";
import { Cause, Effect, Exit, Layer } from "effect";
import { CliError, Command } from "effect/cli";

import { reposCommand } from "../../../src/commands/repos/index.js";
import { Capture } from "../../utils/capture.js";

type ManagerShape = Repos.ReposManagerShape;

const unused = (method: string) => () => Effect.die(`ReposManager.${method} is not used in this test`);

export class ReposStub {
	/**
	 * `"<command path>: <argument>"` when `exit` is a handler's missing-argument
	 * usage error (a `ShowHelp` carrying `MissingArgument`, as core's parser
	 * raises), otherwise `undefined`.
	 */
	static readonly missingArgument = (exit: Exit.Exit<unknown, unknown>): string | undefined => {
		if (!Exit.isFailure(exit)) return undefined;
		const error = Cause.squash(exit.cause);
		if (!CliError.isCliError(error) || error._tag !== "ShowHelp") return undefined;
		const missing = error.errors.find((e) => e._tag === "MissingArgument");
		return missing?._tag === "MissingArgument" ? `${error.commandPath.join(" ")}: ${missing.argument}` : undefined;
	};

	private constructor() {}

	/** A `ReposManager` whose named methods are given and every other one dies. */
	static readonly manager = (methods: Partial<ManagerShape>): Layer.Layer<Repos.ReposManager> =>
		Layer.succeed(Repos.ReposManager, {
			status: unused("status"),
			sync: unused("sync"),
			add: unused("add"),
			pin: unused("pin"),
			note: unused("note"),
			remove: unused("remove"),
			rename: unused("rename"),
			restore: unused("restore"),
			deregister: unused("deregister"),
			...methods,
		} as ManagerShape);

	/** A `ReposDrift` whose `check` is given, dying when it is not. */
	static readonly drift = (
		check: (
			root: string,
		) => EffectType.Effect<Repos.ReposDriftReport, Repos.ReposConfigError | Repos.GitSubmoduleError> = () =>
			Effect.die("ReposDrift.check is not used in this test"),
	): Layer.Layer<Repos.ReposDrift> => Layer.succeed(Repos.ReposDrift, { check } as never);

	/** A status report listing `repos`, each present at `v1` and clean unless it says otherwise. */
	static readonly status = (
		repos: ReadonlyArray<{ readonly name: string; readonly ref?: string; readonly dirty?: boolean }>,
	): Repos.ReposStatusReport => ({
		repos: repos.map((repo) => ({
			name: repo.name,
			ref: repo.ref ?? "v1",
			purpose: "fixture",
			present: true,
			stagedCommit: "abc123",
			dirty: repo.dirty === true,
			staleNoteIds: [],
		})),
		clean: repos.every((repo) => repo.dirty !== true),
	});

	static readonly configMissing = new Repos.ReposConfigError({
		path: "/repo/.repos/config.json",
		reason: "no such file",
		kind: "missing",
	});

	static readonly configInvalid = (reason = "manifest is corrupt") =>
		new Repos.ReposConfigError({ path: "/repo/.repos/config.json", reason, kind: "invalid" });

	static readonly git = (reason = "boom") =>
		new Repos.GitSubmoduleError({ command: "git submodule update", cwd: "/repo", reason });

	static readonly lockdown = (reason = "chmod failed") =>
		new Repos.ReposLockdownError({ path: "/repo/.repos/foo", reason });

	static readonly notFound = (name = "foo") => new Repos.RepoNotFoundError({ name });

	/**
	 * Run `argv` through the real `savvy repos` group under `CliRuntime.main`
	 * (piped, so nothing can prompt), the way `main()` parses it: the streams
	 * and the exit code `main` decided — `64` for a usage error.
	 */
	static readonly cli = (argv: ReadonlyArray<string>, services: Layer.Layer<Repos.ReposManager | Repos.ReposDrift>) =>
		Capture.main(
			CliAudience.runWith(
				Command.make("savvy").pipe(
					Command.withSharedFlags(CliAudience.flags()),
					Command.withSubcommands([reposCommand]),
				),
				{
					version: "0.0.0",
				},
			)(["repos", ...argv]).pipe(Effect.provide(services), Effect.provide(NodeServices.layer)),
		);
}
