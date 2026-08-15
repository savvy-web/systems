/**
 * The generic marker-delimited region grammar every silk-managed document
 * uses: `<!-- token:start -->` … `<!-- token:end -->`.
 *
 * @remarks
 * Extracted from `silk-release-action` (its `pr-body.ts` and
 * `managed-sections.ts` both carried a private copy) so the grammar has one
 * owner. **Every marker is a pair.** A lone opening marker can only be located
 * by scanning forward to whatever happens to follow it, which makes the
 * region's extent a function of its neighbours rather than of itself — moving
 * anything nearby silently redefines it. The token is free-form; `:start` and
 * `:end` are the whole contract, so pairs nest and a region can contain
 * sub-regions without either needing to know about the other.
 */

/**
 * Pure helpers over the `<!-- token:start -->` / `<!-- token:end -->` region
 * grammar.
 *
 * @remarks
 * Every operation is total: a body with no region (or a broken pair) degrades
 * to the documented fail-safe result rather than failing, because the callers
 * are regenerating actions that must still produce a body when the prior one
 * is malformed. Use `PrBodyDiagnostic.scan` when a caller wants to be told
 * about a broken pair instead of silently tolerating it.
 *
 * @public
 */
export class Region {
	private constructor() {}

	/**
	 * The opening delimiter for a named region.
	 *
	 * @public
	 */
	static start(token: string): string {
		return `<!-- ${token}:start -->`;
	}

	/**
	 * The closing delimiter for a named region.
	 *
	 * @public
	 */
	static end(token: string): string {
		return `<!-- ${token}:end -->`;
	}

	/**
	 * The content between a region's delimiters, or `undefined` when absent.
	 *
	 * @remarks
	 * Finds the FIRST opening marker and the matching close after it, so a
	 * nested region of a different token is returned as part of the content
	 * rather than truncating it.
	 *
	 * @public
	 */
	static read(body: string, token: string): string | undefined {
		const from = body.indexOf(Region.start(token));
		const to = body.indexOf(Region.end(token), from === -1 ? 0 : from);
		if (from === -1 || to === -1 || to < from) return undefined;
		return body.slice(from + Region.start(token).length, to);
	}

	/**
	 * Everything outside a region, with the region and its delimiters removed.
	 *
	 * @remarks
	 * A body without the region comes back unchanged — removal of an absent
	 * region is a no-op, not an error.
	 *
	 * @public
	 */
	static strip(body: string, token: string): string {
		const from = body.indexOf(Region.start(token));
		const to = body.indexOf(Region.end(token), from === -1 ? 0 : from);
		if (from === -1 || to === -1 || to < from) return body;
		return `${body.slice(0, from)}${body.slice(to + Region.end(token).length)}`;
	}

	/**
	 * Put `rendered` (a fully rendered region, its own markers included) into
	 * `body`, replacing a previous region of the same token and leaving
	 * everything else alone.
	 *
	 * @remarks
	 * **Human edits outside the markers survive.** A predecessor spliced on a
	 * markdown heading, which silently ate any content a human happened to put
	 * under a heading of that name and could not tell generated text from
	 * theirs. An explicit marker pair can.
	 *
	 * A body with no markers keeps its content and gains the region **below**
	 * it, so an existing hand-written document is not displaced. The result is
	 * trimmed.
	 *
	 * @public
	 */
	static upsert(body: string, token: string, rendered: string): string {
		const start = body.indexOf(Region.start(token));
		const end = body.indexOf(Region.end(token));

		if (start !== -1 && end !== -1 && end > start) {
			const before = body.slice(0, start);
			const after = body.slice(end + Region.end(token).length);
			return `${before}${rendered}${after}`.trim();
		}

		const trimmed = body.trim();
		return trimmed === "" ? rendered : `${trimmed}\n\n${rendered}`;
	}
}
