/**
 * Custom commitlint plugin rules.
 *
 * @remarks
 * These rules help enforce plain-text commit messages by rejecting
 * common markdown formatting patterns that AI agents tend to add.
 *
 * @internal
 */

import { TDD_SCOPE_PATTERN } from "./rules.js";

/**
 * Parsed commit message structure.
 *
 * @internal
 */
interface ParsedCommit {
	type: string | null;
	scope: string | null;
	body: string | null;
	subject: string | null;
	raw: string;
}

/**
 * Commitlint rule function type.
 *
 * @internal
 */
type Rule = (parsed: ParsedCommit) => readonly [boolean, string];

/**
 * Patterns that indicate markdown formatting in commit messages.
 *
 * @internal
 */
const MARKDOWN_PATTERNS = {
	/** Markdown headers (# Header, ## Header, etc.) */
	headers: /^#{1,6}\s/m,
	/** Markdown bullet lists (- item, * item) */
	bullets: /^[\t ]*[-*]\s/m,
	/** Markdown numbered lists (1. item, 2. item) */
	numberedLists: /^[\t ]*\d+\.\s/m,
	/** Markdown code fences (triple backticks) */
	codeFences: /```/,
	/** Markdown inline code (`code`) - only flag if excessive */
	inlineCode: /`[^`]+`/g,
	/** Markdown bold (**text** or __text__) */
	bold: /(\*\*|__)[^*_]+(\*\*|__)/,
	/** Markdown italic (*text* or _text_) - be careful not to match normal underscores */
	italic: /(?<!\w)\*[^*]+\*(?!\w)/,
	/** Markdown links [text](url) */
	links: /\[.+?\]\(.+?\)/,
	/** Markdown horizontal rules (---, ***, ___) */
	horizontalRules: /^[-*_]{3,}$/m,
};

/**
 * Check if text contains markdown formatting.
 *
 * @param text - Text to check
 * @returns Object with detected patterns
 */
function detectMarkdown(text: string): { hasMarkdown: boolean; patterns: string[] } {
	const detected: string[] = [];

	if (MARKDOWN_PATTERNS.headers.test(text)) detected.push("headers (#)");
	if (MARKDOWN_PATTERNS.numberedLists.test(text)) detected.push("numbered lists (1.)");
	if (MARKDOWN_PATTERNS.codeFences.test(text)) detected.push("code fences (```)");
	if (MARKDOWN_PATTERNS.bold.test(text)) detected.push("bold (**text**)");
	if (MARKDOWN_PATTERNS.links.test(text)) detected.push("links ([text](url))");
	if (MARKDOWN_PATTERNS.horizontalRules.test(text)) detected.push("horizontal rules (---)");

	// Only flag inline code if there are multiple instances (occasional backticks are OK)
	const inlineCodeMatches = text.match(MARKDOWN_PATTERNS.inlineCode);
	if (inlineCodeMatches && inlineCodeMatches.length > 2) {
		detected.push("excessive inline code (`code`)");
	}

	return { hasMarkdown: detected.length > 0, patterns: detected };
}

/**
 * Rule: body-no-markdown
 *
 * @remarks
 * Rejects commit message bodies that contain markdown formatting.
 * This helps ensure commit messages are plain text and readable
 * in terminals, git log, and other tools that don't render markdown.
 *
 * Simple unordered lists (`-` or `*`) are allowed for readability.
 *
 * @example
 * ```
 * // Invalid - contains markdown headers
 * feat: add feature
 *
 * ## Summary
 * This adds a new feature.
 *
 * // Valid - plain text with lists
 * feat: add feature
 *
 * Added new feature and fixed related bug:
 * - Implemented user authentication
 * - Fixed session timeout issue
 * ```
 */
const bodyNoMarkdown: Rule = (parsed) => {
	const body = parsed.body;
	if (!body) return [true, ""];

	const { hasMarkdown, patterns } = detectMarkdown(body);
	if (hasMarkdown) {
		return [false, `body contains markdown formatting: ${patterns.join(", ")}`];
	}
	return [true, ""];
};

/**
 * Rule: subject-no-markdown
 *
 * @remarks
 * Rejects commit message subjects (first line) that contain markdown.
 * Subjects should be plain text without any formatting.
 */
const subjectNoMarkdown: Rule = (parsed) => {
	const subject = parsed.subject;
	if (!subject) return [true, ""];

	const { hasMarkdown, patterns } = detectMarkdown(subject);
	if (hasMarkdown) {
		return [false, `subject contains markdown formatting: ${patterns.join(", ")}`];
	}
	return [true, ""];
};

/**
 * Rule: body-prose-only
 *
 * @remarks
 * A stricter rule that requires commit bodies to be prose paragraphs,
 * rejecting any list-like structures even without markdown markers.
 * Checks for lines that look like list items.
 */
const bodyProseOnly: Rule = (parsed) => {
	const body = parsed.body;
	if (!body) return [true, ""];

	// Check for list-like patterns (lines starting with -, *, •, or numbers)
	const listPatterns = /^[\t ]*(?:[-*•]|\d+[.):])\s/m;
	if (listPatterns.test(body)) {
		return [false, "body should be prose paragraphs, not lists"];
	}
	return [true, ""];
};

/**
 * Rule: signed-off-by
 *
 * @remarks
 * Case-insensitive check for DCO signoff trailer. Accepts both
 * "Signed-off-by:" and "signed-off-by:" (and any other casing).
 *
 * This replaces the built-in commitlint signed-off-by rule which
 * is case-sensitive.
 */
const signedOffBy: Rule = (parsed) => {
	const raw = parsed.raw;
	if (!raw) return [false, "message must be signed off"];

	// Case-insensitive match for "signed-off-by:" anywhere in the message
	const signoffPattern = /^signed-off-by:\s*.+$/im;
	if (signoffPattern.test(raw)) {
		return [true, ""];
	}
	return [false, "message must be signed off"];
};

/**
 * Rule: tdd-scope
 *
 * @remarks
 * Enforces scope format for TDD commits. Non-TDD commits pass unconditionally.
 * TDD commits require a scope in the format `<goalId>:<state>` where:
 * - goalId is a numeric ID (one or more digits)
 * - state is one of: spike, red, green, refactor
 *
 * @example
 * ```
 * // Valid - numeric goalId with valid state
 * tdd(7:green): implement feature
 * tdd(12:spike): research approach
 *
 * // Invalid - no scope
 * tdd: implement feature
 *
 * // Invalid - missing state
 * tdd(7): implement feature
 *
 * // Invalid - non-numeric goalId
 * tdd(feature:green): implement feature
 *
 * // Invalid - invalid state
 * tdd(7:done): implement feature
 * ```
 */
function checkTddScope(scope: string | null): readonly [boolean, string] {
	if (!scope) return [false, "tdd commits require a scope in the format <goalId>:<state>"];
	if (!TDD_SCOPE_PATTERN.test(scope)) {
		return [false, `tdd scope must match <digits>:(spike|red|green|refactor), got: ${scope}`];
	}
	return [true, ""];
}

const tddScope: Rule = (parsed) => {
	if (parsed.type !== "tdd") return [true, ""];
	return checkTddScope(parsed.scope);
};

/**
 * Custom commitlint plugin with markdown prevention rules.
 *
 * @remarks
 * This plugin provides rules to enforce plain-text commit messages.
 * Rules are prefixed with `silk/` to namespace them.
 *
 * Available rules:
 * - `silk/body-no-markdown`: Reject markdown in commit body
 * - `silk/subject-no-markdown`: Reject markdown in commit subject
 * - `silk/body-prose-only`: Require prose paragraphs (no lists)
 * - `silk/signed-off-by`: Require DCO signoff
 * - `silk/tdd-scope`: Enforce TDD scope format
 *
 * @internal
 */
export const silkPlugin = {
	rules: {
		"silk/body-no-markdown": bodyNoMarkdown,
		"silk/subject-no-markdown": subjectNoMarkdown,
		"silk/body-prose-only": bodyProseOnly,
		"silk/signed-off-by": signedOffBy,
		"silk/tdd-scope": tddScope,
	},
};

/**
 * Factory function to create a scope enum rule.
 *
 * @remarks
 * Creates a rule that validates commit scopes, with special handling for TDD commits.
 * - For TDD commits: enforces scope format `<goalId>:<state>` where state is one of spike, red, green, refactor
 * - For non-TDD commits: enforces scope is one of the provided project scopes
 *
 * This replaces the built-in commitlint `scope-enum` rule, avoiding duplicate error
 * messages when a TDD commit has an invalid scope.
 *
 * @param scopes - Array of valid project scope strings (e.g. ["api", "cli"])
 * @returns A Rule function that validates scopes
 *
 * @example
 * ```ts
 * const rule = createScopeEnumRule(["api", "cli"]);
 * const [valid, msg] = rule(parsedCommit);
 * ```
 *
 * @internal
 */
export function createScopeEnumRule(scopes: string[]): Rule {
	return (parsed) => {
		if (parsed.type === "tdd") {
			return checkTddScope(parsed.scope);
		}
		if (!parsed.scope || !scopes.includes(parsed.scope)) {
			return [false, `scope must be one of: ${scopes.join(", ")}`];
		}
		return [true, ""];
	};
}

/**
 * Rule names exported for type safety.
 *
 * @internal
 */
export type SilkRuleName = keyof typeof silkPlugin.rules;
