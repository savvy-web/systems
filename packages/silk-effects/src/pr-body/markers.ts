import { Region } from "./region.js";

/**
 * The frozen `silk-release` marker vocabulary — the wire format of the shared
 * PR-body contract.
 *
 * @remarks
 * **The `silk-release:` token is frozen and names the CONTRACT, not the
 * emitting action.** `silk-update-action` PRs carry the same markers as
 * release PRs, deliberately: every live document, the `pr-body` plugin skill,
 * and every agent that edits a managed PR description key on these exact
 * byte sequences. Do not parameterize the token per action and do not rename
 * it — either forks the wire format for zero gain and orphans every open PR
 * (ruled in savvy-web/systems#419).
 *
 * These constants are the single source of truth for the marker grammar.
 * The agent-facing documentation in the silk plugin (`pr-body` and
 * `commit-create` skills) duplicates the literals for readability; a drift
 * lint in this package's test suite asserts the copies stay in sync.
 */

/**
 * The marker constants of the `silk-release` PR-body contract.
 *
 * @public
 */
export class Markers {
	private constructor() {}

	/**
	 * Opening marker of the whole managed region.
	 *
	 * @remarks
	 * Everything between this and {@link Markers.MANAGED_END} that is not
	 * inside the summary or references region is regenerated wholesale on
	 * every run; everything outside the pair is human territory and survives
	 * every regeneration.
	 *
	 * @public
	 */
	static readonly MANAGED_START = Region.start("silk-release");

	/**
	 * Closing marker of the whole managed region.
	 *
	 * @public
	 */
	static readonly MANAGED_END = Region.end("silk-release");

	/**
	 * Opening marker of the region an AI summariser owns.
	 *
	 * @remarks
	 * The generating action never writes into this region — it only reserves
	 * it and carries its content through on regeneration.
	 *
	 * @public
	 */
	static readonly SUMMARY_START = Region.start("silk-release:summary");

	/**
	 * Closing marker of the summariser's region.
	 *
	 * @public
	 */
	static readonly SUMMARY_END = Region.end("silk-release:summary");

	/**
	 * The PLAIN opening marker of the closing-reference region — the form an
	 * author writes by hand.
	 *
	 * @remarks
	 * A generating run emits the ATTRIBUTED form instead (the plain prefix
	 * plus an `owned="…"` attribute). Never locate the region by matching
	 * this constant — match {@link Markers.REFERENCES_START_PREFIX}, or a
	 * region a run wrote will not be found.
	 *
	 * @public
	 */
	static readonly REFERENCES_START = Region.start("silk-release:references");

	/**
	 * Closing marker of the closing-reference region.
	 *
	 * @public
	 */
	static readonly REFERENCES_END = Region.end("silk-release:references");

	/**
	 * The references opening marker up to its attributes, for locating a
	 * region whose `owned` list is unknown.
	 *
	 * @public
	 */
	static readonly REFERENCES_START_PREFIX = "<!-- silk-release:references:start";

	/**
	 * The fence language for the proposed squash-commit block.
	 *
	 * @remarks
	 * Not a GFM language and apparently undocumented, but GitHub renders it.
	 * It is a target for AI integrations to read and rewrite into the
	 * eventual squash-commit message. **Do not "correct" it to `text`.**
	 *
	 * @public
	 */
	static readonly SQUASH_FENCE_LANGUAGE = "proposed-squash-commit";
}
