/**
 * Class-based API wrapper for changeset linting.
 *
 * Provides a static class interface that runs all five remark-lint rules
 * against changeset markdown files and returns structured diagnostics.
 *
 * @internal
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { ContentStructureRule } from "../remark/rules/content-structure.js";
import { DependencyTableFormatRule } from "../remark/rules/dependency-table-format.js";
import { HeadingHierarchyRule } from "../remark/rules/heading-hierarchy.js";
import { RequiredSectionsRule } from "../remark/rules/required-sections.js";
import { UncategorizedContentRule } from "../remark/rules/uncategorized-content.js";
import { stripFrontmatter } from "../utils/strip-frontmatter.js";

/**
 * A single lint diagnostic message produced by changeset validation.
 *
 * @remarks
 * Each `LintMessage` corresponds to one remark-lint rule violation found
 * during changeset validation. Messages include source location information
 * (file, line, column) for integration with editors, CI reporters, and
 * the Effect CLI's `lint` and `check` commands.
 *
 * The five rules that produce lint messages are:
 *
 * - **heading-hierarchy** -- ensures headings follow a valid nesting order
 * - **required-sections** -- checks that mandatory sections are present
 * - **content-structure** -- validates the structure of section content
 * - **dependency-table-format** -- enforces the machine-generated dependency-table format for `## Dependencies` sections
 * - **uncategorized-content** -- flags content outside recognized section headings
 *
 * @public
 */
export interface LintMessage {
	/**
	 * File path that was validated.
	 *
	 * @remarks
	 * Set to the actual filesystem path when using {@link ChangesetLinter.validateFile}
	 * or {@link ChangesetLinter.validate}. Defaults to `"<input>"` when using
	 * {@link ChangesetLinter.validateContent} without an explicit path.
	 */
	file: string;

	/**
	 * Identifier of the remark-lint rule that produced this message.
	 *
	 * @remarks
	 * Corresponds to one of the five built-in rules: `"heading-hierarchy"`,
	 * `"required-sections"`, `"content-structure"`, `"dependency-table-format"`,
	 * or `"uncategorized-content"`. Falls back to `"unknown"` if the underlying
	 * vfile message has no rule ID.
	 */
	rule: string;

	/**
	 * Line number where the issue was detected (1-based).
	 *
	 * @remarks
	 * Line numbers are relative to the content after YAML frontmatter
	 * stripping. Defaults to `1` if the underlying rule does not provide
	 * position information.
	 */
	line: number;

	/**
	 * Column number where the issue was detected (1-based).
	 *
	 * @remarks
	 * Defaults to `1` if the underlying rule does not provide position
	 * information.
	 */
	column: number;

	/**
	 * Human-readable description of the lint violation.
	 *
	 * @remarks
	 * Suitable for display in terminal output, editor diagnostics, or
	 * CI annotations. Includes enough context to understand the issue
	 * without referencing the source file.
	 */
	message: string;
}

/**
 * Static class for linting changeset markdown files.
 *
 * Runs the five remark-lint rules (heading-hierarchy, required-sections,
 * content-structure, dependency-table-format, uncategorized-content) against
 * changeset markdown and returns structured {@link LintMessage} diagnostics.
 *
 * @remarks
 * This class implements the pre-validation layer of the three-layer
 * pipeline. It validates that changeset markdown conforms to the
 * expected structure before the changelog formatter processes it.
 *
 * YAML frontmatter (the `---` delimited block at the top of changeset
 * files containing package bump declarations) is automatically stripped
 * before validation, since frontmatter is managed by Changesets itself
 * and is not part of the markdown structure being validated.
 *
 * The class provides three granularity levels:
 *
 * - {@link ChangesetLinter.validateContent} -- validate a markdown string directly
 * - {@link ChangesetLinter.validateFile} -- validate a single file by path
 * - {@link ChangesetLinter.validate} -- validate all changeset files in a directory
 *
 * @example Validate a single file and report errors
 * ```typescript
 * import { ChangesetLinter } from "\@savvy-web/changesets";
 * import type { LintMessage } from "\@savvy-web/changesets";
 *
 * const messages: LintMessage[] = ChangesetLinter.validateFile(
 *   ".changeset/brave-pandas-learn.md",
 * );
 *
 * if (messages.length > 0) {
 *   for (const msg of messages) {
 *     console.error(`${msg.file}:${msg.line}:${msg.column} [${msg.rule}] ${msg.message}`);
 *   }
 *   process.exitCode = 1;
 * }
 * ```
 *
 * @example Validate all changesets in a directory
 * ```typescript
 * import { ChangesetLinter } from "\@savvy-web/changesets";
 * import type { LintMessage } from "\@savvy-web/changesets";
 *
 * const allMessages: LintMessage[] = ChangesetLinter.validate(".changeset");
 *
 * const errorsByFile = new Map<string, LintMessage[]>();
 * for (const msg of allMessages) {
 *   const existing = errorsByFile.get(msg.file) ?? [];
 *   existing.push(msg);
 *   errorsByFile.set(msg.file, existing);
 * }
 *
 * for (const [file, msgs] of errorsByFile) {
 *   console.error(`${file}: ${msgs.length} issue(s)`);
 * }
 * ```
 *
 * @example Validate markdown content directly (useful in tests)
 * ```typescript
 * import { ChangesetLinter } from "\@savvy-web/changesets";
 * import type { LintMessage } from "\@savvy-web/changesets";
 *
 * const content = [
 *   "---",
 *   '"\@savvy-web/core": patch',
 *   "---",
 *   "",
 *   "## Bug Fixes",
 *   "",
 *   "Fixed an edge case in token validation.",
 * ].join("\n");
 *
 * const messages: LintMessage[] = ChangesetLinter.validateContent(content);
 * // messages.length === 0 (valid changeset)
 * ```
 *
 * @see {@link LintMessage} for the diagnostic message shape
 * @see {@link Categories} for the valid section headings checked by the rules
 *
 * @public
 */
export class ChangesetLinter {
	/* v8 ignore next -- private constructor prevents direct instantiation */
	private constructor() {}

	/**
	 * Validate a single changeset file by path.
	 *
	 * @remarks
	 * Reads the file synchronously, strips YAML frontmatter, and runs all
	 * five lint rules. The file path is preserved in each returned
	 * {@link LintMessage} for error reporting.
	 *
	 * @param filePath - Absolute or relative path to the changeset `.md` file
	 * @returns Array of {@link LintMessage} diagnostics (empty if the file is valid)
	 */
	static validateFile(filePath: string): LintMessage[] {
		const raw = readFileSync(filePath, "utf-8");
		return ChangesetLinter.validateContent(raw, filePath);
	}

	/**
	 * Validate a markdown string directly.
	 *
	 * @remarks
	 * Strips YAML frontmatter (if present) and runs all five lint rules
	 * against the remaining content. This method is useful for validating
	 * changeset content that is already in memory, such as in test suites
	 * or editor integrations.
	 *
	 * @param content - Raw markdown content (may include YAML frontmatter)
	 * @param filePath - File path for error reporting; defaults to `"<input>"`
	 *   when validating in-memory content
	 * @returns Array of {@link LintMessage} diagnostics (empty if the content is valid)
	 */
	static validateContent(content: string, filePath = "<input>"): LintMessage[] {
		const body = stripFrontmatter(content);

		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkStringify)
			.use(HeadingHierarchyRule)
			.use(RequiredSectionsRule)
			.use(ContentStructureRule)
			.use(DependencyTableFormatRule)
			.use(UncategorizedContentRule);

		const file = processor.processSync(body);

		return file.messages.map((msg) => ({
			file: filePath,
			/* v8 ignore next 3 -- ruleId/line/column fallbacks; remark-lint always provides these */
			rule: msg.ruleId ?? msg.source ?? "unknown",
			line: msg.line ?? 1,
			column: msg.column ?? 1,
			message: msg.message,
		}));
	}

	/**
	 * Validate all changeset `.md` files in a directory.
	 *
	 * @remarks
	 * Scans the directory for `*.md` files (excluding `README.md`) and runs
	 * {@link ChangesetLinter.validateFile} on each. Results are aggregated
	 * into a single array. The directory is read synchronously.
	 *
	 * This is the method used by the Effect CLI's `lint` and `check`
	 * subcommands to validate the `.changeset/` directory.
	 *
	 * @param dir - Path to the directory containing changeset files
	 *   (typically `.changeset/`)
	 * @returns Aggregated array of {@link LintMessage} diagnostics from all files
	 */
	static validate(dir: string): LintMessage[] {
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md") && f !== "README.md")
			.flatMap((filename) => ChangesetLinter.validateFile(join(dir, filename)));
	}
}
