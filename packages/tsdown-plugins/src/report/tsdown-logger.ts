import type { BuildCollector } from "./collector.js";

/**
 * Structural match for tsdown's Logger interface (tsdown 0.22.x).
 *
 * @public
 */
export interface TsdownLogger {
	level: "info";
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	warnOnce: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	success: (...args: unknown[]) => void;
	clearScreen: () => void;
}

// Strip ANSI SGR codes: ESC (U+001B) + "[" + params + "m". Built from char code so no literal
// control character appears in source (avoids Biome's noControlCharactersInRegex lint error).
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const join = (args: unknown[]): string =>
	args
		.map((a) => String(a))
		.join(" ")
		.replace(ANSI, "")
		.trim();

/**
 * A tsdown `customLogger` that routes warnings/errors into the BuildCollector instead of the
 * console. Paired with `logLevel: "silent"` in the same build config: silent suppresses tsdown's
 * own console output while this logger still receives every message (verified against tsdown 0.22.3).
 * info/success are dropped — file metrics come from the writeBundle plugin and timing from our timer.
 * @public
 */
export function createTsdownLogger(collector: BuildCollector, groupId: string): TsdownLogger {
	const seenOnce = new Set<string>();
	return {
		level: "info",
		info: () => {},
		success: () => {},
		clearScreen: () => {},
		warn: (...args) => collector.recordWarning(groupId, { source: "tsdown", level: "warn", text: join(args) }),
		warnOnce: (...args) => {
			const text = join(args);
			if (seenOnce.has(text)) return;
			seenOnce.add(text);
			collector.recordWarning(groupId, { source: "tsdown", level: "warn", text });
		},
		error: (...args) => collector.recordError(groupId, { source: "tsdown", level: "error", text: join(args) }),
	};
}
