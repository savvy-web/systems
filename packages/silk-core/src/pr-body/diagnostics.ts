import { Schema } from "effect";
import { Markers } from "./markers.js";
import { Region } from "./region.js";

/**
 * The problems {@link PrBodyDiagnostic.scan} can report about a body's
 * markers.
 *
 * @public
 */
export const PrBodyDiagnosticCode = Schema.Literals(["unpairedMarker", "duplicateMarker"]);

/**
 * The problems {@link PrBodyDiagnostic.scan} can report about a body's
 * markers.
 *
 * @public
 */
export type PrBodyDiagnosticCode = typeof PrBodyDiagnosticCode.Type;

/**
 * One problem with a body's silk-release markers.
 *
 * @remarks
 * Diagnostics are advisory VALUES, not a typed error channel: every parse and
 * render operation in this namespace is deliberately total (a regenerating
 * action must still produce a body when the prior one is malformed, and the
 * fail-safe direction is to preserve too much rather than delete someone's
 * work). `scan` exists for the writer that wants to be told about a broken
 * pair before editing — the `pr-body` skill instructs an agent that finds a
 * region missing its pair to stop and report rather than guess, and this is
 * the check that instruction points at. A misplaced marker pair is worse than
 * none: it makes the next regeneration rewrite content it does not own.
 *
 * @public
 */
export class PrBodyDiagnostic extends Schema.Class<PrBodyDiagnostic>("PrBodyDiagnostic")({
	code: PrBodyDiagnosticCode,
	/** The region token the problem is about, e.g. `silk-release:summary`. */
	token: Schema.String,
}) {
	/**
	 * A human-readable description, derived from the structured fields.
	 *
	 * @public
	 */
	get message(): string {
		return this.code === "unpairedMarker"
			? `region "${this.token}" has an unpaired or out-of-order marker — its :start and :end must both be present, in order`
			: `region "${this.token}" appears more than once — each silk-release region must be a single pair`;
	}

	/**
	 * Every marker problem in `body`, or an empty array when the markers are
	 * well-formed (including entirely absent — an unmanaged body is not a
	 * defect).
	 *
	 * @remarks
	 * The references region is located by its attributed opening prefix, so a
	 * marker carrying an `owned="…"` attribute counts as present.
	 *
	 * @public
	 */
	static scan(body: string): ReadonlyArray<PrBodyDiagnostic> {
		const diagnostics: Array<PrBodyDiagnostic> = [];
		const tokens: ReadonlyArray<readonly [token: string, openMarker: string]> = [
			["silk-release", Markers.MANAGED_START],
			["silk-release:summary", Markers.SUMMARY_START],
			["silk-release:references", Markers.REFERENCES_START_PREFIX],
		];
		for (const [token, openMarker] of tokens) {
			const opens = countOccurrences(body, openMarker);
			const closes = countOccurrences(body, Region.end(token));
			if (opens === 0 && closes === 0) continue;
			if (opens !== closes) {
				diagnostics.push(PrBodyDiagnostic.make({ code: "unpairedMarker", token }));
				continue;
			}
			if (opens > 1) {
				diagnostics.push(PrBodyDiagnostic.make({ code: "duplicateMarker", token }));
				continue;
			}
			// Exactly one pair: the close must follow the open.
			if (body.indexOf(Region.end(token)) < body.indexOf(openMarker)) {
				diagnostics.push(PrBodyDiagnostic.make({ code: "unpairedMarker", token }));
			}
		}
		return diagnostics;
	}
}

/**
 * Non-overlapping occurrences of `needle` in `haystack`.
 *
 * @remarks
 * Module-private on purpose — it exists only to keep `scan` readable.
 */
const countOccurrences = (haystack: string, needle: string): number => {
	let count = 0;
	let from = 0;
	for (;;) {
		const at = haystack.indexOf(needle, from);
		if (at === -1) return count;
		count += 1;
		from = at + needle.length;
	}
};
