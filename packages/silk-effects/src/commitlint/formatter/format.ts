/**
 * Custom formatter implementation for commitlint.
 *
 * @internal
 */
import { getExplanation, getSuggestion } from "./messages.js";

/** Unicode symbol for error indicator. */
const ERROR_ICON = "\u2717"; // ✗

/** Unicode symbol for warning indicator. */
const WARNING_ICON = "\u26A0"; // ⚠

/**
 * Individual rule result.
 *
 * @public
 */
export interface RuleResult {
	level: 0 | 1 | 2;
	valid: boolean;
	name: string;
	message: string;
}

/**
 * Lint result from commitlint.
 *
 * @public
 */
export interface LintOutcome {
	valid: boolean;
	errors: RuleResult[];
	warnings: RuleResult[];
	input: string;
}

/**
 * Formatter result structure passed by commitlint.
 *
 * @public
 */
export interface FormatterResult {
	results: LintOutcome[];
	options?: {
		helpUrl?: string;
	};
}

/**
 * Format a single rule result with explanation and suggestion.
 *
 * @param result - Rule result to format
 * @param level - "error" or "warning"
 * @returns Formatted string
 *
 * @internal
 */
function formatRuleResult(result: RuleResult, level: "error" | "warning"): string {
	const icon = level === "error" ? ERROR_ICON : WARNING_ICON;
	const lines: string[] = [`  ${icon} ${result.name}: ${result.message}`];

	const explanation = getExplanation(result.name);
	if (explanation) {
		lines.push(`    ${explanation}`);
	}

	const suggestion = getSuggestion(result.name);
	if (suggestion) {
		lines.push(`    Suggestion: ${suggestion}`);
	}

	return lines.join("\n");
}

/**
 * Build summary line for error/warning counts.
 *
 * @param errorCount - Number of errors
 * @param warningCount - Number of warnings
 * @returns Summary string
 *
 * @internal
 */
function buildSummary(errorCount: number, warningCount: number): string {
	const parts: string[] = [];

	if (errorCount > 0) {
		parts.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
	}

	if (warningCount > 0) {
		parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"}`);
	}

	return `Found ${parts.join(", ")}.`;
}

/**
 * Format lint results for display.
 *
 * @remarks
 * This is the main formatter function exported for commitlint.
 * It formats errors and warnings with helpful explanations and suggestions.
 *
 * @param formatterResult - Results from commitlint
 * @returns Formatted output string
 *
 * @public
 */
export function format(formatterResult: FormatterResult): string {
	const { results, options } = formatterResult;
	const output: string[] = [];

	let totalErrors = 0;
	let totalWarnings = 0;

	for (const result of results) {
		const hasIssues = !result.valid || result.errors.length > 0 || result.warnings.length > 0;

		if (!hasIssues) {
			continue;
		}

		// Show the input that was validated (first line only)
		const firstLine = result.input.split("\n")[0];
		output.push(`\nInput: "${firstLine}..."`);
		output.push("");

		for (const error of result.errors) {
			output.push(formatRuleResult(error, "error"));
			totalErrors++;
		}

		for (const warning of result.warnings) {
			output.push(formatRuleResult(warning, "warning"));
			totalWarnings++;
		}
	}

	if (totalErrors > 0 || totalWarnings > 0) {
		output.push("");
		output.push(buildSummary(totalErrors, totalWarnings));

		if (options?.helpUrl) {
			output.push(`\nFor more information, see: ${options.helpUrl}`);
		}
	}

	return output.join("\n");
}
