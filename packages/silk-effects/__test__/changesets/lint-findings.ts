/**
 * Test helper: run one CSH rule through the programmatic host and return its
 * findings in a `{ rule, message, position }` shape.
 *
 * @internal
 */

import type { LintRule } from "@effected/markdown-lint";
import { MarkdownLint } from "@effected/markdown-lint";
import { Option } from "effect";

export interface Finding {
	readonly rule: string;
	readonly message: string;
	readonly position: { readonly start: { readonly line: number; readonly column: number } };
}

export function findings(rule: LintRule, markdown: string): Finding[] {
	return MarkdownLint.lint(markdown, [rule]).map((d) => ({
		rule: d.ruleNames[0],
		message: Option.getOrElse(d.detail, () => ""),
		position: { start: { line: d.lineNumber, column: d.column } },
	}));
}
