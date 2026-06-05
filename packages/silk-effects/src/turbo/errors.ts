import { Data } from "effect";

/**
 * Raised when the turbo CLI cannot be resolved or executed.
 *
 * @since 0.7.0
 */
export class TurboNotInstalledError extends Data.TaggedError("TurboNotInstalledError")<{
	readonly reason: string;
}> {
	get message() {
		return `Turborepo is not available: ${this.reason}`;
	}
}

/**
 * Raised when the resolved working directory is not a Turborepo (no turbo.json).
 *
 * @since 0.7.0
 */
export class NotATurboRepoError extends Data.TaggedError("NotATurboRepoError")<{
	readonly cwd: string;
}> {
	get message() {
		return `Not a Turborepo: no turbo.json found in ${this.cwd}`;
	}
}

/**
 * Raised when `turbo run <task> --dry=json` output cannot be parsed/decoded.
 *
 * @since 0.7.0
 */
export class DryRunParseError extends Data.TaggedError("DryRunParseError")<{
	readonly task: string;
	readonly reason: string;
}> {
	get message() {
		return `Failed to parse turbo dry-run output for "${this.task}": ${this.reason}`;
	}
}

/**
 * Raised when an invocation of the turbo CLI exits non-zero (e.g. an unknown
 * task name or a corrupt `turbo.json`). Distinct from {@link TurboNotInstalledError},
 * which signals that the binary itself could not be resolved.
 *
 * @since 0.7.0
 */
export class TurboExecError extends Data.TaggedError("TurboExecError")<{
	readonly args: ReadonlyArray<string>;
	readonly reason: string;
}> {
	get message() {
		return `Turbo command failed (${this.args.join(" ")}): ${this.reason}`;
	}
}

/**
 * Union of all errors the Turbo namespace can fail with.
 *
 * @since 0.7.0
 */
export type TurboError = TurboNotInstalledError | NotATurboRepoError | DryRunParseError | TurboExecError;
