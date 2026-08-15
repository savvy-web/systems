import { Schema } from "effect";
import { LinkedIssueRef } from "./linked-issue.js";
import { Markers } from "./markers.js";

/**
 * An ordered list of issue ids destined for closing references, with the two
 * renderers whose difference is the whole point of this module.
 *
 * @remarks
 * The same issues appear twice in a managed PR body, spelled differently, and
 * **neither consumer accepts the other's spelling**:
 *
 * - commitlint reads ONE comma-joined trailer (`Closes #1, #2`) inside the
 *   proposed-squash-commit fence — {@link ClosingReferences.renderTrailer};
 * - GitHub's linker reads one bare `Closes #N` line each, OUTSIDE every
 *   fence — {@link ClosingReferences.renderBareLines}. A reference inside a
 *   fenced block is inert to GitHub.
 *
 * The duplication is load-bearing. Never "simplify" a body by emitting one
 * form in both places: comma-joined bare lines link nothing (verified by hand
 * against live pull requests — `savvy-web/silk-integration` #242/#232 with no
 * bare line reported `closingIssuesReferences: []`, #243 with one reported
 * `[168]`), and per-line trailers inside the fence break the commit contract.
 *
 * Ids are stored exactly as given — construction neither deduplicates nor
 * sorts. Call {@link ClosingReferences.dedupe} where uniqueness is wanted;
 * the split exists because the squash trailer historically renders duplicates
 * as-given while the references region deduplicates, and byte-compatibility
 * with live PR bodies pins that behavior.
 *
 * @public
 */
export class ClosingReferences extends Schema.Class<ClosingReferences>("ClosingReferences")({
	// Integers only — deliberately NOT `> 0`. Ids on the carry-through path come
	// from `parseBare` over an UNTRUSTED prior body, and a hostile `Closes #0`
	// line must stay a preserved oddity (the fail-safe direction), never a
	// construction defect mid-regeneration.
	ids: Schema.Array(Schema.Number.check(Schema.isInt())),
}) {
	/**
	 * A closing keyword and its issue reference, anchored per line.
	 *
	 * @remarks
	 * Anchored so a number mentioned in passing is not mistaken for a closing
	 * reference — matching what GitHub itself links on. Every keyword GitHub
	 * accepts is matched, not just the present-tense plural this contract
	 * emits: `close`/`closed`, `fix`/`fixed`, `resolve`/`resolved` and an
	 * optional colon are all valid, and a reference the parser fails to
	 * recognise is one the next regeneration silently deletes.
	 */
	static readonly BARE_LINE_PATTERN = /^(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+#(\d+)$/i;

	/**
	 * The open issues' ids, in input order, duplicates preserved.
	 *
	 * @remarks
	 * Closedness is decided by `LinkedIssueRef.isClosed` — the only
	 * sanctioned test, case-insensitive so REST (`closed`) and GraphQL
	 * (`CLOSED`) payloads classify identically.
	 *
	 * @public
	 */
	static fromIssues(issues: ReadonlyArray<LinkedIssueRef>): ClosingReferences {
		return ClosingReferences.make({
			ids: issues.filter((issue) => !LinkedIssueRef.isClosed(issue)).map((issue) => issue.number),
		});
	}

	/**
	 * Issue ids carried by a region's bare closing lines.
	 *
	 * @public
	 */
	static parseBare(region: string): ReadonlyArray<number> {
		return region
			.split("\n")
			.map((line) => ClosingReferences.BARE_LINE_PATTERN.exec(line.trim())?.[1])
			.filter((id): id is string => id !== undefined)
			.map(Number);
	}

	/**
	 * A copy with duplicate ids removed, first occurrence winning.
	 *
	 * @public
	 */
	dedupe(): ClosingReferences {
		return ClosingReferences.make({ ids: [...new Set(this.ids)] });
	}

	/**
	 * The comma-joined trailer the squash-commit message carries, or `""`
	 * when there is nothing to close.
	 *
	 * @remarks
	 * `Closes #1, #2` on ONE line — the spelling commitlint reads and
	 * GitHub's linker ignores. See the class remarks before changing either
	 * renderer.
	 *
	 * @public
	 */
	renderTrailer(): string {
		if (this.ids.length === 0) return "";
		return `Closes ${this.ids.map((id) => `#${id}`).join(", ")}`;
	}

	/**
	 * One bare `Closes #N` line per id, or `""` when empty.
	 *
	 * @remarks
	 * The spelling GitHub's linker reads — each line must sit OUTSIDE every
	 * fenced block to link. See the class remarks before changing either
	 * renderer.
	 *
	 * @public
	 */
	renderBareLines(): string {
		return this.ids.map((id) => `Closes #${id}`).join("\n");
	}
}

/**
 * The `owned="…"` attribute on the references region's opening marker.
 *
 * @remarks
 * Records the issue ids a generating run emitted itself, so the next run can
 * tell its own references from ones an agent or human added. "Not in this
 * run's linked set" is NOT enough: a reference the previous run emitted also
 * disappears from the linked set when the release stops tracking that issue,
 * and treating it as agent-authored would preserve it forever — re-linking,
 * and on merge auto-closing, an issue the release deliberately dropped.
 *
 * **Never hand-edit the attribute.** A wrong value makes the next run delete
 * a real reference or resurrect a dropped one.
 *
 * @public
 */
export class OwnedAttribute {
	private constructor() {}

	/**
	 * The attribute as emitted on the opening marker.
	 *
	 * @public
	 */
	static render(ids: ReadonlyArray<number>): string {
		return `owned="${ids.join(",")}"`;
	}

	/**
	 * The ids the prior body's opening marker claims as the previous run's
	 * own.
	 *
	 * @remarks
	 * An absent or malformed attribute reads as "none", which degrades to
	 * treating every reference in the region as agent-authored. That
	 * preserves too much rather than deleting someone's work — the safe
	 * direction to fail. The match is anchored to an attribute boundary: an
	 * unanchored match also finds `data-owned="…"` and `unowned="…"`, which
	 * would let an unrelated attribute claim an agent's reference and get it
	 * dropped on the next run.
	 *
	 * @public
	 */
	static parse(priorBody: string): ReadonlySet<number> {
		const from = priorBody.indexOf(Markers.REFERENCES_START_PREFIX);
		if (from === -1) return new Set();
		const openEnd = priorBody.indexOf("-->", from);
		if (openEnd === -1) return new Set();
		const attributes = priorBody.slice(from + Markers.REFERENCES_START_PREFIX.length, openEnd);
		const owned = /(?:^|\s)owned="([\d,\s]*)"/.exec(attributes)?.[1];
		if (owned === undefined) return new Set();
		return new Set(
			owned
				.split(",")
				.map((part) => part.trim())
				.filter((part) => part !== "")
				.map(Number),
		);
	}
}
