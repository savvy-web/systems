import type { Effect, Schema } from "effect";
import { Context } from "effect";
import type { CommandRunnerError } from "../errors/CommandRunnerError.js";

/**
 * Options for command execution.
 *
 * @public
 */
export interface ExecOptions {
	readonly cwd?: string;
	readonly env?: Record<string, string>;
	readonly timeout?: number;
	readonly silent?: boolean;
	/**
	 * When true, forward stdout/stderr to `process.stdout`/`process.stderr`
	 * in real-time while still capturing the output for the return value.
	 * Useful for long-running commands where real-time log visibility is needed.
	 */
	readonly streaming?: boolean;
}

/**
 * Result of a captured command execution.
 *
 * @public
 */
export interface ExecOutput {
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
}

/**
 * Service shape for {@link CommandRunner}.
 *
 * @public
 */
export interface CommandRunnerShape {
	/** Run a command and return exit code. Non-zero exit codes fail with CommandRunnerError. */
	readonly exec: (
		command: string,
		args?: ReadonlyArray<string>,
		options?: ExecOptions,
	) => Effect.Effect<number, CommandRunnerError>;

	/** Run a command and capture stdout/stderr. Non-zero exit codes fail with CommandRunnerError. */
	readonly execCapture: (
		command: string,
		args?: ReadonlyArray<string>,
		options?: ExecOptions,
	) => Effect.Effect<ExecOutput, CommandRunnerError>;

	/** Run a command, parse stdout as JSON, validate against schema. */
	readonly execJson: <A, I>(
		command: string,
		args: ReadonlyArray<string> | undefined,
		schema: Schema.Codec<A, I>,
		options?: ExecOptions,
	) => Effect.Effect<A, CommandRunnerError>;

	/** Run a command and return stdout split into trimmed, non-empty lines. */
	readonly execLines: (
		command: string,
		args?: ReadonlyArray<string>,
		options?: ExecOptions,
	) => Effect.Effect<ReadonlyArray<string>, CommandRunnerError>;
}

/**
 * Service for structured shell command execution.
 *
 * @public
 */
export class CommandRunner extends Context.Service<CommandRunner, CommandRunnerShape>()(
	"github-action-effects/CommandRunner",
) {}
