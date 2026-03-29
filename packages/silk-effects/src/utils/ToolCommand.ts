import type { CommandExecutor } from "@effect/platform";
import { Command } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import type { Effect, Stream } from "effect";

/**
 * Wraps `@effect/platform` {@link Command.Command} with instance method ergonomics.
 *
 * Use `yield* cmd.string()` instead of `yield* Command.string(cmd)`.
 *
 * @since 0.2.0
 */
export class ToolCommand {
	readonly command: Command.Command;

	constructor(command: Command.Command) {
		this.command = command;
	}

	string(encoding?: string): Effect.Effect<string, PlatformError, CommandExecutor.CommandExecutor> {
		return Command.string(this.command, encoding);
	}

	exitCode(): Effect.Effect<number, PlatformError, CommandExecutor.CommandExecutor> {
		return Command.exitCode(this.command);
	}

	lines(encoding?: string): Effect.Effect<Array<string>, PlatformError, CommandExecutor.CommandExecutor> {
		return Command.lines(this.command, encoding);
	}

	stream(): Stream.Stream<Uint8Array, PlatformError, CommandExecutor.CommandExecutor> {
		return Command.stream(this.command);
	}

	env(environment: Record<string, string | undefined>): ToolCommand {
		return new ToolCommand(Command.env(this.command, environment));
	}

	workingDirectory(cwd: string): ToolCommand {
		return new ToolCommand(Command.workingDirectory(this.command, cwd));
	}

	stdin(input: string): ToolCommand {
		return new ToolCommand(Command.feed(this.command, input));
	}
}
