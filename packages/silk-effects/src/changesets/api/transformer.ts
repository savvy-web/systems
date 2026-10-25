/**
 * Class-based API wrapper for changelog transformation.
 *
 * Provides a static class interface that runs the `@effected/markdown`
 * kit-node changelog transforms against CHANGELOG markdown content as the
 * post-processing layer of the three-layer pipeline.
 *
 * @internal
 */

import { readFileSync, writeFileSync } from "node:fs";

import { aggregateDependencyTables } from "../transforms/aggregate-dependency-tables.js";
import { contributorFootnotes } from "../transforms/contributor-footnotes.js";
import { deduplicateItems } from "../transforms/deduplicate-items.js";
import { issueLinkRefs } from "../transforms/issue-link-refs.js";
import type { MaintenanceNoteOptions } from "../transforms/maintenance-note.js";
import { maintenanceNote } from "../transforms/maintenance-note.js";
import { mergeSections } from "../transforms/merge-sections.js";
import { normalizeFormat } from "../transforms/normalize-format.js";
import { reorderSections } from "../transforms/reorder-sections.js";
import type { ChangelogTransform } from "../transforms/types.js";
import { emitKitMarkdown, parseKitMarkdown } from "../utils/markdown-emit.js";

/**
 * Optional per-file behavior for {@link ChangelogTransformer}.
 *
 * @public
 */
export interface TransformOptions {
	/** Insert a Maintenance note into this version block when it ends up empty. */
	readonly maintenance?: MaintenanceNoteOptions;
	/**
	 * Whether to aggregate `Thanks \@user!` attributions into a `### Thanks`
	 * section (default `true`). When `false`, inline attributions and any
	 * existing Thanks section are stripped and no section is emitted.
	 * Mirrors the `thanks` changelog option in `.changeset/config.json`.
	 */
	readonly thanks?: boolean;
}

/**
 * Static class for post-processing CHANGELOG.md files.
 *
 * Implements the third layer of the three-layer pipeline by running seven
 * `@effected/markdown` kit-node transforms in a fixed order to clean up,
 * normalize, and enhance changelog output produced by the formatter layer:
 * aggregate dependency tables, merge duplicate sections, reorder sections by
 * category priority, deduplicate list items, aggregate contributor thanks,
 * convert issue references to reference links, and normalize formatting. An
 * optional maintenance-note transform runs last.
 *
 * @remarks
 * The transformer operates on the full CHANGELOG.md content (all versions),
 * not just the latest release block. It is idempotent -- running it multiple
 * times produces the same output.
 *
 * @example Transform changelog content in memory
 * ```typescript
 * import { ChangelogTransformer } from "\@savvy-web/changesets";
 *
 * const rawChangelog = [
 *   "# Changelog",
 *   "",
 *   "## 1.2.0",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added new auth endpoint",
 *   "",
 *   "### Features",
 *   "",
 *   "- Added rate limiting",
 * ].join("\n");
 *
 * const cleaned: string = ChangelogTransformer.transformContent(rawChangelog);
 * // Duplicate "Features" sections are merged into one
 * ```
 *
 * @example Transform a CHANGELOG.md file in-place
 * ```typescript
 * import { ChangelogTransformer } from "\@savvy-web/changesets";
 *
 * // Reads, transforms, and writes back to the same path
 * ChangelogTransformer.transformFile("CHANGELOG.md");
 * ```
 *
 * @example Check for changes without writing (dry-run pattern)
 * ```typescript
 * import { readFileSync } from "node:fs";
 * import { ChangelogTransformer } from "\@savvy-web/changesets";
 *
 * const original: string = readFileSync("CHANGELOG.md", "utf-8");
 * const transformed: string = ChangelogTransformer.transformContent(original);
 *
 * if (original !== transformed) {
 *   console.error("CHANGELOG.md needs transformation");
 *   process.exitCode = 1;
 * }
 * ```
 *
 * @see {@link Categories} for the priority order used when reordering sections
 * @see {@link ChangesetLinter} for the pre-validation layer (layer 1)
 * @see {@link Changelog} for the formatter layer (layer 2)
 *
 * @public
 */
export class ChangelogTransformer {
	/* v8 ignore next -- private constructor prevents direct instantiation */
	private constructor() {}

	/**
	 * Transform CHANGELOG markdown content by running the kit-node
	 * changelog transforms.
	 *
	 * @remarks
	 * The input is parsed into `@effected/markdown` nodes (GFM dialect, author
	 * spellings canonicalized), folded through every transform in order, and
	 * emitted back to markdown through the canonical `@effected/markdown`
	 * stringifier. The operation is synchronous and idempotent.
	 *
	 * @param content - Raw CHANGELOG markdown string (may contain multiple
	 *   version blocks, GFM tables, footnotes, and reference links)
	 * @param options - Optional transformation options, including maintenance note configuration
	 * @returns The transformed markdown string with dependency tables aggregated,
	 *   sections merged, reordered, deduplicated, and normalized
	 */
	static transformContent(content: string, options?: TransformOptions): string {
		const pipeline: ChangelogTransform[] = [
			aggregateDependencyTables,
			mergeSections,
			reorderSections,
			deduplicateItems,
			contributorFootnotes(options?.thanks !== undefined ? { thanks: options.thanks } : undefined),
			issueLinkRefs,
			normalizeFormat,
		];
		if (options?.maintenance) {
			pipeline.push(maintenanceNote(options.maintenance));
		}
		return emitKitMarkdown(pipeline.reduce((root, transform) => transform(root), parseKitMarkdown(content)));
	}

	/**
	 * Transform a CHANGELOG file in-place.
	 *
	 * @remarks
	 * Reads the file synchronously, runs all transforms via
	 * {@link ChangelogTransformer.transformContent}, and writes the result
	 * back to the same path. The file is overwritten atomically (single
	 * `writeFileSync` call).
	 *
	 * This is the method used by the Effect CLI's `transform` subcommand
	 * when invoked without the `--dry-run` or `--check` flags.
	 *
	 * @param filePath - Absolute or relative path to the CHANGELOG.md file
	 * @param options - Optional transformation options, including maintenance note configuration
	 */
	static transformFile(filePath: string, options?: TransformOptions): void {
		const content = readFileSync(filePath, "utf-8");
		const result = ChangelogTransformer.transformContent(content, options);
		writeFileSync(filePath, result, "utf-8");
	}
}
