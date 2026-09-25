/**
 * Human-readable command output.
 *
 * @packageDocumentation
 */

import { CliColor } from "@effected/cli";
import type { Stdio } from "effect";
import { Console, Effect } from "effect";

const paint = (on: boolean, code: string, text: string): string => (on ? `\u001b[${code}m${text}\u001b[0m` : text);

const glyphLine = (code: string, glyph: string, text: string): Effect.Effect<void, never, Stdio.Stdio> =>
	Effect.flatMap(CliColor.enabled, (on) => Console.log(`${paint(on, code, glyph)} ${text}`));

/** Counts for {@link Output.summary}; a missing or zero count is left out. */
export interface OutputCounts {
	readonly ok?: number | undefined;
	readonly warn?: number | undefined;
	readonly fail?: number | undefined;
}

/**
 * The result a person ran a command to see, written to stdout.
 *
 * @remarks
 * Every line goes through `Console.log`, so stdout carries a command's product
 * and nothing else; progress and diagnostics stay on `Effect.log*`, which the
 * CLI logger sends to stderr. Colour follows `CliColor.enabled` — off when
 * stdout is not a terminal or `NO_COLOR` is set — and only ever tints the
 * glyph or heading, so the text reads the same piped.
 *
 * @internal
 */
export class Output {
	private constructor() {}

	/** A passing item: `✓ text`. */
	static readonly ok = (text: string): Effect.Effect<void, never, Stdio.Stdio> => glyphLine("32", "✓", text);

	/** An item that passed with a caveat: `⚠ text`. */
	static readonly warn = (text: string): Effect.Effect<void, never, Stdio.Stdio> => glyphLine("33", "⚠", text);

	/** A finding — still output, not a crash: `✗ text`. */
	static readonly fail = (text: string): Effect.Effect<void, never, Stdio.Stdio> => glyphLine("31", "✗", text);

	/** A section title, bold on a terminal. */
	static readonly heading = (text: string): Effect.Effect<void, never, Stdio.Stdio> =>
		Effect.flatMap(CliColor.enabled, (on) => Console.log(paint(on, "1", text)));

	/** Supporting detail under the line before it, indented and dimmed on a terminal. */
	static readonly detail = (text: string): Effect.Effect<void, never, Stdio.Stdio> =>
		Effect.flatMap(CliColor.enabled, (on) => Console.log(`  ${paint(on, "2", text)}`));

	/** A line printed as given — a blank separator, or a block already formatted. */
	static readonly line = (text: string): Effect.Effect<void> => Console.log(text);

	/** `3 ok · 1 warning · 2 failed`, zero parts left out; `nothing to do` when every count is zero. */
	static readonly summary = (counts: OutputCounts): Effect.Effect<void> => {
		const parts = [
			counts.ok ? `${counts.ok} ok` : undefined,
			counts.warn ? `${counts.warn} ${counts.warn === 1 ? "warning" : "warnings"}` : undefined,
			counts.fail ? `${counts.fail} failed` : undefined,
		].filter((part): part is string => part !== undefined);
		return Console.log(parts.length === 0 ? "nothing to do" : parts.join(" · "));
	};
}
