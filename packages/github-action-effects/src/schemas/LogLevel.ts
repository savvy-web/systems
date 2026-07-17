import { Schema } from "effect";

/**
 * The three log levels supported by the action logger.
 *
 * - `info` — Buffered. Shows only outcome summaries. Flushes verbose buffer on failure.
 * - `verbose` — Unbuffered milestones. Start/finish markers for operations.
 * - `debug` — Everything. Full command output, input/output values, internal state.
 * @public
 */
export const ActionLogLevel = Schema.Literals(["info", "verbose", "debug"]).annotate({
	identifier: "ActionLogLevel",
	title: "Action Log Level",
	description: "Logging verbosity for GitHub Action output",
});

/** @public */
export type ActionLogLevel = typeof ActionLogLevel.Type;

/**
 * Log level input values accepted by the standardized `log-level` action input.
 * Includes `auto` which resolves based on the GitHub Actions environment.
 * @public
 */
export const LogLevelInput = Schema.Literals(["info", "verbose", "debug", "auto"]).annotate({
	identifier: "LogLevelInput",
	title: "Log Level Input",
	description: "Logging verbosity: info, verbose, debug, or auto",
	message: 'log-level must be one of: "info", "verbose", "debug", "auto"',
});

/** @public */
export type LogLevelInput = typeof LogLevelInput.Type;

/**
 * Resolve a {@link LogLevelInput} to a concrete {@link ActionLogLevel}.
 *
 * `"auto"` resolves to `"info"` unless `RUNNER_DEBUG` is `"1"`,
 * in which case it resolves to `"debug"`.
 */
export const resolveLogLevel = (input: LogLevelInput): ActionLogLevel => {
	if (input !== "auto") {
		return input;
	}
	return process.env.RUNNER_DEBUG === "1" ? "debug" : "info";
};
