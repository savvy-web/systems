/**
 * Human-readable command output, built as an `@effected/cli` document.
 *
 * @packageDocumentation
 */

import type { Block, CliLinks, CliTheme, Document, InlineInput } from "@effected/cli";
import { Doc, Status } from "@effected/cli";
import type { Audience } from "@effected/env";
import { TerminalEnv } from "@effected/env";
import { Effect } from "effect";

/** What {@link Report.print} reads to pick a renderer: the audience, the terminal, the theme and editor links. */
export type ReportEnv = CliTheme | TerminalEnv | Audience | CliLinks;

/** Counts for {@link Report.summary}; a missing or zero count is left out. */
export interface ReportCounts {
	readonly ok?: number | undefined;
	readonly warn?: number | undefined;
	readonly fail?: number | undefined;
}

type CoreStatus = "success" | "warning" | "failure" | "skip";

/** A status line, with any detail lines muted and indented under it. */
const item = (status: CoreStatus, text: InlineInput, detail: ReadonlyArray<string>): Block => {
	const head = [Doc.status(Status.core, status), " ", ...(Array.isArray(text) ? text : [text])];
	return detail.length === 0
		? Doc.line(head)
		: Doc.lines([head, ...detail.map((line) => Doc.text(`  ${line}`, "muted"))]);
};

/**
 * The result a person ran a command to see, as `Doc` blocks.
 *
 * @remarks
 * A command builds its report from these blocks and writes it once with
 * {@link Report.print}, which renders for the run's audience on stdout: ANSI
 * for a person at a terminal, plain text for an agent or a pipe, and a GitHub
 * Actions log under Actions. Only the status glyph and headings are painted,
 * so the text reads the same piped. Progress and diagnostics stay on
 * `Effect.log*`, which the CLI logger sends to stderr; a failure is the
 * runtime's to report, never a block here — fail with `CommandError`
 * (`./command-error.ts`), which draws itself.
 *
 * `Report` covers what every command repeats: status items, headings, detail
 * lines, the summary and the audience-aware print. Anything richer — a
 * table, a titled section, a callout, a tree, a file link, a GitHub Actions
 * annotation — is built with `Doc.*` from `@effected/cli` directly and mixed
 * into the same document (both build `Block`s); `Report` deliberately does not
 * re-wrap those constructors.
 *
 * @internal
 */
export class Report {
	private constructor() {}

	/** A passing item: `✓ text`, with optional muted detail lines under it. */
	static readonly ok = (text: InlineInput, ...detail: ReadonlyArray<string>): Block => item("success", text, detail);

	/** An item that passed with a caveat: `⚠ text`. */
	static readonly warn = (text: InlineInput, ...detail: ReadonlyArray<string>): Block => item("warning", text, detail);

	/** A finding — still output, not a crash: `✗ text`. */
	static readonly fail = (text: InlineInput, ...detail: ReadonlyArray<string>): Block => item("failure", text, detail);

	/** An item that is absent or not applicable — neither a pass nor a finding: `↷ text`. */
	static readonly skip = (text: InlineInput, ...detail: ReadonlyArray<string>): Block => item("skip", text, detail);

	/** A section title. */
	static readonly heading = (text: InlineInput): Block => Doc.heading(2, text);

	/** Supporting detail under the block before it, indented and muted. */
	static readonly detail = (text: string): Block => Doc.line(Doc.text(`  ${text}`, "muted"));

	/**
	 * A line printed as given; an empty string is a blank separator between
	 * blocks of one document. A document holding only blank lines renders as
	 * nothing, so a separator between two separately printed documents is a
	 * `Console.log("")`, not a `Report.line("")`.
	 */
	static readonly line = (text: InlineInput): Block => Doc.line(text);

	/** Text already laid out (a diff, a config dump), kept verbatim. */
	static readonly verbatim = (text: string): Block => Doc.verbatim(text);

	/** `3 ok, 1 warning, 2 failed`, zero parts left out; `nothing to do` when every count is zero. */
	static readonly summary = (counts: ReportCounts): Block => {
		const ok = counts.ok ?? 0;
		const warn = counts.warn ?? 0;
		const fail = counts.fail ?? 0;
		if (ok + warn + fail === 0) return Doc.line("nothing to do");
		return Doc.counts({
			layout: "inline",
			share: false,
			counters: [
				Doc.counter(Status.core, "success", { key: "ok", label: "ok", n: ok }),
				Doc.counter(Status.core, "warning", { key: "warn", label: warn === 1 ? "warning" : "warnings", n: warn }),
				Doc.counter(Status.core, "failure", { key: "fail", label: "failed", n: fail }),
			],
		});
	};

	/**
	 * Render `doc` for the run's audience and write it to stdout.
	 *
	 * @remarks
	 * A terminal wraps to its width. A pipe has no width to honour — the kit
	 * would otherwise wrap a person's piped output at 80 columns and split a
	 * long path or a `file:line:col` finding a caller greps — so off a terminal
	 * nothing is wrapped.
	 */
	static readonly print = (doc: Document): Effect.Effect<void, never, ReportEnv> =>
		Effect.flatMap(TerminalEnv, (terminal) =>
			Doc.print(doc, terminal.stdout.isTerminal ? {} : { width: Number.POSITIVE_INFINITY }),
		);
}
