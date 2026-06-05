import type { WarningSuppressionRule } from "./config.js";

interface CompiledRule {
	readonly messageId: string;
	readonly regex: RegExp | undefined;
	readonly substring: string | undefined;
}

function compileRule(rule: WarningSuppressionRule): CompiledRule {
	if (rule.pattern === undefined) {
		return { messageId: rule.messageId, regex: undefined, substring: undefined };
	}
	try {
		return { messageId: rule.messageId, regex: new RegExp(rule.pattern), substring: undefined };
	} catch {
		// Not a valid regex: treat as a literal substring.
		return { messageId: rule.messageId, regex: undefined, substring: rule.pattern };
	}
}

export interface MessageSuppressor {
	matches(messageId: string, text: string): boolean;
}

/** Build a suppressor that matches a message when its id matches exactly AND (if a pattern is set) the text matches the regex/substring. */
export function createMessageSuppressor(rules: ReadonlyArray<WarningSuppressionRule>): MessageSuppressor {
	const compiled = rules.map(compileRule);
	return {
		matches(messageId: string, text: string): boolean {
			for (const rule of compiled) {
				if (rule.messageId !== messageId) continue;
				if (rule.regex === undefined && rule.substring === undefined) return true;
				if (rule.regex?.test(text)) return true;
				if (rule.substring !== undefined && text.includes(rule.substring)) return true;
			}
			return false;
		},
	};
}
