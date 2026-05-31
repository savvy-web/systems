/**
 * Commitizen adapter for interactive commit prompts.
 *
 * @remarks
 * This module provides a commitizen-compatible prompter that uses
 * the silk commit type definitions with optional emoji support.
 *
 * @internal
 */
import type { CommitType } from "../config/rules.js";
import { COMMIT_TYPE_DEFINITIONS } from "../config/rules.js";
import { TYPE_EMOJIS_UNICODE } from "./emojis.js";

/**
 * Inquirer instance provided by commitizen.
 */
export interface Inquirer {
	prompt<T>(questions: Question[]): Promise<T>;
}

/**
 * Inquirer question type.
 */
export interface Question {
	type: "list" | "input" | "confirm";
	name: string;
	message: string;
	choices?: Array<{ name: string; value: string }>;
	default?: string | boolean;
	when?: boolean | ((answers: Record<string, unknown>) => boolean);
	validate?: (input: string) => boolean | string;
	filter?: (input: string) => string;
}

/**
 * Answers from the commit prompt.
 */
interface CommitAnswers {
	type: CommitType;
	scope: string;
	subject: string;
	body: string;
	isBreaking: boolean;
	breakingBody: string;
	isIssueAffected: boolean;
	issues: string;
}

/**
 * Options for the prompter.
 */
export interface PrompterOptions {
	/**
	 * Enable emojis in type selection.
	 *
	 * @defaultValue true
	 */
	emojis?: boolean;

	/**
	 * Available scopes for selection.
	 * If provided, shows a list instead of free-form input.
	 */
	scopes?: string[];

	/**
	 * Maximum subject length.
	 *
	 * @defaultValue 100
	 */
	maxSubjectLength?: number;

	/**
	 * Maximum body line length.
	 *
	 * @defaultValue 300
	 */
	maxBodyLength?: number;
}

/** Default prompter options */
const DEFAULT_OPTIONS: Required<PrompterOptions> = {
	emojis: true,
	scopes: [],
	maxSubjectLength: 100,
	maxBodyLength: 300,
};

/**
 * Build type choices for the prompt.
 */
function buildTypeChoices(emojis: boolean): Array<{ name: string; value: string }> {
	return COMMIT_TYPE_DEFINITIONS.map((def) => {
		const emoji = emojis ? TYPE_EMOJIS_UNICODE[def.type as CommitType] : "";
		const prefix = emoji ? `${emoji}  ` : "";
		return {
			name: `${prefix}${def.type}: ${def.description}`,
			value: def.type,
		};
	});
}

/**
 * Build scope choices for the prompt.
 */
function buildScopeChoices(scopes: string[]): Array<{ name: string; value: string }> {
	return [{ name: "(none)", value: "" }, ...scopes.map((scope) => ({ name: scope, value: scope }))];
}

/**
 * Format the final commit message.
 */
function formatCommitMessage(answers: CommitAnswers): string {
	const { type, scope, subject, body, isBreaking, breakingBody, isIssueAffected, issues } = answers;

	// Build header: type(scope): subject
	const scopePart = scope ? `(${scope})` : "";
	const breakingMark = isBreaking ? "!" : "";
	const header = `${type}${scopePart}${breakingMark}: ${subject}`;

	// Build body parts
	const parts: string[] = [header];

	if (body) {
		parts.push("", body);
	}

	if (isBreaking && breakingBody) {
		parts.push("", `BREAKING CHANGE: ${breakingBody}`);
	}

	if (isIssueAffected && issues) {
		parts.push("", issues);
	}

	return parts.join("\n");
}

/**
 * Commitizen prompter function.
 *
 * @remarks
 * This is the main entry point for the commitizen adapter.
 * It prompts the user for commit information and calls the
 * commit callback with the formatted message.
 *
 * @param cz - Inquirer instance provided by commitizen
 * @param commit - Callback to execute the commit
 * @param options - Prompter options
 *
 * @public
 */
export function prompter(cz: Inquirer, commit: (message: string) => void, options: PrompterOptions = {}): void {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const hasScopes = opts.scopes.length > 0;

	const scopeQuestion: Question = hasScopes
		? {
				type: "list",
				name: "scope",
				message: "Select the scope of this change:",
				choices: buildScopeChoices(opts.scopes),
			}
		: {
				type: "input",
				name: "scope",
				message: "Scope of this change (press enter to skip):",
				filter: (input: string) => input.trim().toLowerCase(),
			};

	const questions: Question[] = [
		{
			type: "list",
			name: "type",
			message: "Select the type of change you're committing:",
			choices: buildTypeChoices(opts.emojis),
		},
		scopeQuestion,
		{
			type: "input",
			name: "subject",
			message: `Short description (max ${opts.maxSubjectLength} chars):`,
			validate: (input: string) => {
				if (!input.trim()) {
					return "Subject is required";
				}
				if (input.length > opts.maxSubjectLength) {
					return `Subject must be ${opts.maxSubjectLength} characters or less (currently ${input.length})`;
				}
				return true;
			},
			filter: (input: string) => {
				// Lowercase first letter, trim
				const trimmed = input.trim();
				return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
			},
		},
		{
			type: "input",
			name: "body",
			message: "Longer description (press enter to skip):",
		},
		{
			type: "confirm",
			name: "isBreaking",
			message: "Are there any breaking changes?",
			default: false,
		},
		{
			type: "input",
			name: "breakingBody",
			message: "Describe the breaking changes:",
			when: (answers: Record<string, unknown>) => answers.isBreaking === true,
		},
		{
			type: "confirm",
			name: "isIssueAffected",
			message: "Does this change affect any open issues?",
			default: false,
		},
		{
			type: "input",
			name: "issues",
			message: "Issue references (e.g., 'fix #123', 'closes #456'):",
			when: (answers: Record<string, unknown>) => answers.isIssueAffected === true,
		},
	];

	cz.prompt<CommitAnswers>(questions)
		.then((answers) => {
			const message = formatCommitMessage(answers);
			commit(message);
		})
		.catch(() => {
			// User cancelled the prompt (Ctrl+C) or an error occurred
			// Exit silently - commitizen handles the process exit
		});
}
