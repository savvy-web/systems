/**
 * Conventional commit message parsing.
 *
 * Implements a parser for the
 * {@link https://www.conventionalcommits.org/ | Conventional Commits}
 * specification, extracting type, scope, breaking-change indicator,
 * description, and body from commit messages.
 *
 * @remarks
 * The parser uses a single regex pass for the first line, then splits
 * remaining lines to extract the body. Non-conventional messages are
 * returned with only the `description` field populated (set to the
 * full message text).
 *
 * @see {@link Changelog} for the public API that consumes parsed commits
 *
 * @internal
 */

/**
 * Matches conventional commit format: `type(scope)!: description`.
 *
 * Capture groups:
 * - `[1]` — commit type (e.g., `feat`, `fix`)
 * - `[2]` — optional scope (e.g., `api`, `ui`)
 * - `[3]` — optional `!` breaking-change indicator
 * - `[4]` — description text after the colon
 *
 * @internal
 */
const CONVENTIONAL_COMMIT_PATTERN = /^(\w+)(?:\(([^)]+)\))?(!)?\s*:\s*(.+)/;

/**
 * Structured result of parsing a conventional commit message.
 *
 * @remarks
 * Fields other than `description` are only present when the commit
 * follows conventional commit format. For non-conventional messages,
 * only `description` is populated with the raw message text.
 *
 * @example
 * ```typescript
 * import type { ParsedCommitMessage } from "../utils/commit-parser.js";
 *
 * // Conventional commit
 * const parsed: ParsedCommitMessage = {
 *   type: "feat",
 *   scope: "api",
 *   breaking: true,
 *   description: "add new endpoint",
 *   body: "BREAKING CHANGE: removed old route",
 * };
 *
 * // Non-conventional commit
 * const simple: ParsedCommitMessage = {
 *   description: "update readme",
 * };
 * ```
 *
 * @internal
 */
export interface ParsedCommitMessage {
	/** Commit type (e.g., "feat", "fix", "docs") */
	type?: string;
	/** Commit scope (e.g., "api", "ui") */
	scope?: string;
	/** Whether the commit has a `!` breaking-change indicator */
	breaking?: boolean;
	/** The commit description (first-line text after the colon) */
	description: string;
	/** The commit body (everything after the first line, trimmed) */
	body?: string;
}

/**
 * Parse a commit message following the Conventional Commits specification.
 *
 * Supports the full format: `type(scope)!: description\n\nbody`
 *
 * @remarks
 * The algorithm first attempts to match the first line against the
 * conventional commit pattern. If matched, the type, optional scope,
 * optional breaking indicator, and description are extracted. The body
 * is everything after the first line, trimmed. If the message does not
 * match, a fallback result with only the `description` set to the raw
 * message is returned.
 *
 * @param message - The commit message to parse
 * @returns Parsed components; only `description` is guaranteed present
 *
 * @example
 * ```typescript
 * import { parseCommitMessage } from "../utils/commit-parser.js";
 *
 * const result = parseCommitMessage("feat(api)!: add v2 routes\n\nBREAKING CHANGE: v1 removed");
 * // result.type === "feat"
 * // result.scope === "api"
 * // result.breaking === true
 * // result.description === "add v2 routes"
 * // result.body === "BREAKING CHANGE: v1 removed"
 * ```
 *
 * @internal
 */
export function parseCommitMessage(message: string): ParsedCommitMessage {
	const match = CONVENTIONAL_COMMIT_PATTERN.exec(message);

	if (match) {
		const [, type, scope, bang, description] = match;
		const lines = message.split("\n");
		const body = lines.slice(1).join("\n").trim();

		const result: ParsedCommitMessage = {
			type,
			description: description.trim(),
		};
		if (scope) result.scope = scope;
		if (bang === "!") result.breaking = true;
		if (body) result.body = body;
		return result;
	}

	return { description: message };
}
