/**
 * Error message templates for the formatter.
 *
 * @internal
 */

/**
 * Detailed error explanations for common rule failures.
 *
 * @remarks
 * Maps commitlint rule names to human-readable explanations of what
 * the rule enforces and why the commit message failed.
 *
 * @public
 */
export const ERROR_EXPLANATIONS: Record<string, string> = {
	"type-empty": "Commit messages must start with a type (e.g., feat, fix, docs).",
	"type-enum":
		"The commit type must be one of: ai, build, chore, ci, docs, feat, fix, perf, refactor, release, revert, style, test.",
	"subject-empty": "A subject describing the change is required after the type.",
	"subject-case": "The subject should start with a lowercase letter.",
	"subject-full-stop": "The subject should not end with a period.",
	"header-max-length": "The first line of the commit message is too long. Keep it under 72 characters.",
	"body-max-line-length": "Lines in the commit body should not exceed the configured maximum length.",
	"body-leading-blank": "There should be a blank line between the subject and the body.",
	"footer-leading-blank": "There should be a blank line between the body and the footer.",
	"scope-enum": "The scope must be one of the allowed values for this project.",
	"scope-empty": "A scope is required for this commit type.",
	"signed-off-by":
		'This project requires DCO signoff. Add "Signed-off-by: Your Name <email>" to your commit, or use `git commit -s`.',
	"silk/signed-off-by":
		'This project requires DCO signoff. Add "Signed-off-by: Your Name <email>" to your commit, or use `git commit -s`.',
	"trailer-exists": "A required trailer is missing from the commit message.",
	"references-empty": "This commit should reference an issue (e.g., #123 or PROJ-456).",
};

/**
 * Suggestions for fixing common errors.
 *
 * @remarks
 * Maps commitlint rule names to actionable suggestions for fixing
 * the rule violation.
 *
 * @public
 */
export const ERROR_SUGGESTIONS: Record<string, string> = {
	"type-empty": "Example: feat: add user authentication",
	"type-enum": "Example: fix: resolve memory leak in cache",
	"subject-empty": "Example: feat: add user authentication",
	"subject-case": 'Use lowercase: "add feature" instead of "Add feature"',
	"subject-full-stop": 'Remove the period: "add feature" instead of "add feature."',
	"header-max-length": "Move details to the commit body instead.",
	"body-max-line-length": "Break long lines into multiple shorter lines.",
	"body-leading-blank": "Add an empty line after the subject before the body.",
	"footer-leading-blank": "Add an empty line before any footers like Signed-off-by.",
	"signed-off-by": "Run: git commit --amend -s",
	"silk/signed-off-by": "Run: git commit --amend -s",
};

/**
 * Get explanation for a rule failure.
 *
 * @param ruleName - Name of the failed rule
 * @returns Explanation string or undefined if no explanation exists
 *
 * @public
 */
export function getExplanation(ruleName: string): string | undefined {
	return ERROR_EXPLANATIONS[ruleName];
}

/**
 * Get suggestion for fixing a rule failure.
 *
 * @param ruleName - Name of the failed rule
 * @returns Suggestion string or undefined if no suggestion exists
 *
 * @public
 */
export function getSuggestion(ruleName: string): string | undefined {
	return ERROR_SUGGESTIONS[ruleName];
}
