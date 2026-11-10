/**
 * Class-based API wrapper for changeset linting.
 *
 * Provides a static class interface that runs the front matter and CSH lint rules
 * against changeset markdown files and returns structured diagnostics.
 *
 * @internal
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ChangesetLint } from "@effected/changesets/lint";
import { Option } from "effect";
import { CHANGESET_RULES } from "../lint/index.js";

/**
 * Options for {@link ChangesetLinter}.
 *
 * @public
 */
export interface ChangesetLinterOptions {
	/**
	 * The workspace's package names. When given, the `changeset-known-package`
	 * (CF004) rule checks every front matter key against them; without them,
	 * package names are not checked against the workspace.
	 */
	readonly packages?: Iterable<string> | undefined;
}

/**
 * A single lint diagnostic message produced by changeset validation.
 *
 * @remarks
 * Each `LintMessage` corresponds to one lint rule violation found
 * during changeset validation. Messages include source location information
 * (file, line, column) for integration with editors, CI reporters, and
 * the Effect CLI's `lint` and `check` commands.
 *
 * The front matter rules come from `\@effected/changesets/lint`:
 *
 * - **changeset-front-matter** (CF001) -- a YAML front matter block, a mapping when not empty
 * - **changeset-package-name** (CF002) -- every key names a package
 * - **changeset-release-type** (CF003) -- every value is major, minor, patch or none
 * - **changeset-known-package** (CF004) -- every key names a workspace package (only when the names are given)
 *
 * The five body rules are:
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
	 * Identifier of the lint rule that produced this message.
	 *
	 * @remarks
	 * The rule's primary name: one of the front matter rules
	 * (`"changeset-front-matter"`, `"changeset-package-name"`,
	 * `"changeset-release-type"`, `"changeset-known-package"`) or one of the
	 * five body rules (`"changeset-heading-hierarchy"`,
	 * `"changeset-required-sections"`, `"changeset-content-structure"`,
	 * `"changeset-dependency-table-format"`, `"changeset-uncategorized-content"`).
	 */
	rule: string;

	/**
	 * Line number where the issue was detected (1-based).
	 *
	 * @remarks
	 * Line numbers are relative to the whole file, frontmatter block
	 * included, so they match the lines an editor shows.
	 */
	line: number;

	/**
	 * Column number where the issue was detected (1-based).
	 *
	 * @remarks
	 * Taken from the start position of the offending node.
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
 * Runs `\@effected/changesets/lint`'s front matter rules (CF001-CF004) and the
 * five CSH body rules (heading-hierarchy, required-sections, content-structure,
 * dependency-table-format, uncategorized-content) against changeset markdown
 * and returns structured {@link LintMessage} diagnostics.
 *
 * @remarks
 * This class implements the pre-validation layer of the three-layer
 * pipeline. It validates that changeset markdown conforms to the
 * expected structure before the changelog formatter processes it.
 *
 * The YAML front matter (the `---` delimited block of package bump
 * declarations) is checked by the CF rules, as `\@changesets/parse` reads
 * it; the CSH rules lint only the body after it. Every rule is an
 * `\@effected/markdown-lint` rule, so the same definitions run in
 * markdownlint through `\@savvy-web/silk/changesets/markdownlint`.
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
	 * Reads the file synchronously and runs every lint rule. The file path is
	 * preserved in each returned {@link LintMessage} for error reporting.
	 *
	 * @param filePath - Absolute or relative path to the changeset `.md` file
	 * @param options - The workspace's package names, for CF004
	 * @returns Array of {@link LintMessage} diagnostics (empty if the file is valid)
	 */
	static validateFile(filePath: string, options?: ChangesetLinterOptions): LintMessage[] {
		const raw = readFileSync(filePath, "utf-8");
		return ChangesetLinter.validateContent(raw, filePath, options);
	}

	/**
	 * Validate a markdown string directly.
	 *
	 * @remarks
	 * Runs every lint rule over the whole file, front matter included. This
	 * method is useful for validating changeset content that is already in
	 * memory, such as in test suites or editor integrations.
	 *
	 * @param content - Raw changeset file content, front matter included
	 * @param filePath - File path for error reporting; defaults to `"<input>"`
	 *   when validating in-memory content
	 * @param options - The workspace's package names, for CF004
	 * @returns Array of {@link LintMessage} diagnostics (empty if the content is valid)
	 */
	static validateContent(content: string, filePath = "<input>", options?: ChangesetLinterOptions): LintMessage[] {
		return ChangesetLint.lint(content, {
			name: filePath,
			packages: options?.packages,
			rules: CHANGESET_RULES,
		}).map((diagnostic) => {
			const rule = diagnostic.ruleNames[0];
			return {
				file: filePath,
				rule,
				line: diagnostic.lineNumber,
				column: diagnostic.column,
				message: Option.getOrElse(diagnostic.detail, () => rule),
			};
		});
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
	 * @param options - The workspace's package names, for CF004
	 * @returns Aggregated array of {@link LintMessage} diagnostics from all files
	 */
	static validate(dir: string, options?: ChangesetLinterOptions): LintMessage[] {
		const packages = options?.packages === undefined ? undefined : [...options.packages];
		return readdirSync(dir)
			.filter((f) => f.endsWith(".md") && f !== "README.md")
			.flatMap((filename) => ChangesetLinter.validateFile(join(dir, filename), { packages }));
	}
}
