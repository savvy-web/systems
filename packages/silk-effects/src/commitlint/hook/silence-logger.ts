/**
 * Logger configuration shared by all hook subcommands.
 *
 * @remarks
 * Hook subcommands reserve stdout for the JSON envelope they emit to Claude
 * Code. Effect's default logger writes messages to stdout via `console.log`,
 * which pollutes that contract (e.g., workspace discovery may log on every
 * CLI invocation). This Layer combines two protections:
 *
 * 1. `References.MinimumLogLevel` at `Warn` silences routine Info/Debug
 *    traffic so the common case never reaches the logger at all.
 * 2. A logger-set replacement that routes anything which *does* fire to
 *    stderr, so even Warn/Error output cannot corrupt the stdout envelope.
 *
 * Only the hook command wrappers provide this Layer, so regular `savvy`
 * commands keep their stdout output intact.
 *
 * @internal
 */
import { Layer, Logger, References } from "effect";

/**
 * Replacement logger that writes every message to stderr, leaving stdout
 * reserved for the hook's JSON envelope. `Logger.layer` without
 * `mergeWithExisting` REPLACES the current logger set, so the default
 * stdout logger never fires.
 */
const StderrLogger = Logger.layer([
	Logger.make(({ message }) => {
		// Effect always delivers `message` as the array of logged values, so it is
		// never a plain string here — serialize it for the stderr diagnostic line.
		process.stderr.write(`${JSON.stringify(message)}\n`);
	}),
]);

/** Minimum log level layer that suppresses Info and below. */
const MinLogLevel = Layer.succeed(References.MinimumLogLevel, "Warn");

/**
 * Combined hook logger layer: stderr redirect merged with the Warn minimum
 * log level. Provided by hook command wrappers to keep stdout corruption-proof.
 */
export const HookSilencer = Layer.merge(StderrLogger, MinLogLevel);
