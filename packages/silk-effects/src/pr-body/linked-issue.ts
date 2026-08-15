import { Schema } from "effect";

/**
 * The minimum an issue must carry to appear in a managed PR body.
 *
 * @remarks
 * `state` is deliberately a tolerant `Schema.String` rather than a literal
 * union: GitHub's REST API reports `"open"`/`"closed"` while GraphQL reports
 * `"OPEN"`/`"CLOSED"`, and both actions pass their existing issue shapes
 * through unchanged. **`LinkedIssueRef.isClosed` is the ONLY sanctioned way
 * to test closedness** — it lowercases before comparing, so both spellings
 * classify correctly. A hand-written `issue.state === "closed"` comparison
 * silently misclassifies GraphQL's `"CLOSED"` as open, which re-links (and on
 * merge auto-closes) an issue the release deliberately dropped.
 *
 * The class carries no instance members, so a plain
 * `{ number, title, state }` literal satisfies the type structurally — both
 * actions' existing `LinkedIssue` shapes are accepted without mapping.
 *
 * @public
 */
export class LinkedIssueRef extends Schema.Class<LinkedIssueRef>("LinkedIssueRef")({
	number: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
	title: Schema.String,
	state: Schema.String,
}) {
	/**
	 * Whether an issue is closed, case-insensitively.
	 *
	 * @remarks
	 * The only sanctioned closedness test — see the class remarks for why a
	 * bare `state === "closed"` comparison is a silent bug against GraphQL
	 * payloads.
	 *
	 * @public
	 */
	static isClosed(issue: { readonly state: string }): boolean {
		return issue.state.toLowerCase() === "closed";
	}
}
