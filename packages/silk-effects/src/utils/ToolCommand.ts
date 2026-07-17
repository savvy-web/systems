import type { PlatformError } from "effect";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

/**
 * Rebuild a command with patched options.
 *
 * @remarks
 * `ChildProcess.Command` values are pure data, but core only ships setters for
 * `cwd` and `env`. This helper rebuilds a `StandardCommand` with merged
 * options, recursing into both sides of a `PipedCommand` the same way
 * `ChildProcess.setCwd` does.
 */
const patchOptions = (
	command: ChildProcess.Command,
	patch: (options: ChildProcess.CommandOptions) => ChildProcess.CommandOptions,
): ChildProcess.Command => {
	switch (command._tag) {
		case "StandardCommand":
			return ChildProcess.make(command.command, command.args, patch(command.options));
		case "PipedCommand":
			return ChildProcess.pipeTo(
				patchOptions(command.left, patch),
				patchOptions(command.right, patch),
				command.options,
			);
	}
};

/**
 * Wraps `effect/unstable/process` `ChildProcess.Command` with instance method ergonomics.
 *
 * Use `yield* cmd.string()` instead of resolving the `ChildProcessSpawner` service by hand.
 *
 * @since 0.2.0
 * @public
 */
export class ToolCommand {
	readonly command: ChildProcess.Command;

	constructor(command: ChildProcess.Command) {
		this.command = command;
	}

	string(): Effect.Effect<string, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
		return Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) => spawner.string(this.command));
	}

	exitCode(): Effect.Effect<number, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
		return Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) => spawner.exitCode(this.command));
	}

	lines(): Effect.Effect<Array<string>, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
		return Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) => spawner.lines(this.command));
	}

	stream(): Stream.Stream<string, PlatformError.PlatformError, ChildProcessSpawner.ChildProcessSpawner> {
		return Stream.unwrap(
			Effect.map(ChildProcessSpawner.ChildProcessSpawner, (spawner) => spawner.streamString(this.command)),
		);
	}

	env(environment: Record<string, string | undefined>): ToolCommand {
		return new ToolCommand(
			patchOptions(this.command, (options) => ({
				...options,
				env: { ...options.env, ...environment },
				// The Node backend only merges the parent environment when asked;
				// v3 always extended it, so keep that behavior explicit.
				extendEnv: true,
			})),
		);
	}

	workingDirectory(cwd: string): ToolCommand {
		return new ToolCommand(ChildProcess.setCwd(this.command, cwd));
	}

	stdin(input: string): ToolCommand {
		return new ToolCommand(
			patchOptions(this.command, (options) => ({
				...options,
				stdin: Stream.succeed(new TextEncoder().encode(input)),
			})),
		);
	}
}
