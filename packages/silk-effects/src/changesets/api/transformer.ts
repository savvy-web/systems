/**
 * Class-based API wrapper for changelog transformation.
 *
 * Provides a static class interface that runs all remark transform
 * plugins against CHANGELOG markdown content as the post-processing
 * layer of the three-layer pipeline.
 *
 * @internal
 */

import { readFileSync, writeFileSync } from "node:fs";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { ContributorFootnotesPlugin } from "../remark/plugins/contributor-footnotes.js";
import { DeduplicateItemsPlugin } from "../remark/plugins/deduplicate-items.js";
import { IssueLinkRefsPlugin } from "../remark/plugins/issue-link-refs.js";
import { MergeSectionsPlugin } from "../remark/plugins/merge-sections.js";
import { NormalizeFormatPlugin } from "../remark/plugins/normalize-format.js";
import { ReorderSectionsPlugin } from "../remark/plugins/reorder-sections.js";

/**
 * Static class for post-processing CHANGELOG.md files.
 *
 * Implements the third layer of the three-layer pipeline by running
 * six remark transform plugins in a fixed order to clean up, normalize,
 * and enhance changelog output produced by the formatter layer.
 *
 * @remarks
 * The six plugins run in this order:
 *
 * 1. **MergeSectionsPlugin** -- merges duplicate section headings (e.g., two
 *    "Features" sections from separate changesets are combined into one)
 * 2. **ReorderSectionsPlugin** -- reorders sections by category priority
 *    (Breaking Changes first, Other last) using the {@link Categories} priority values
 * 3. **DeduplicateItemsPlugin** -- removes duplicate list items within a section
 * 4. **ContributorFootnotesPlugin** -- converts inline contributor mentions
 *    into footnote references for cleaner formatting
 * 5. **IssueLinkRefsPlugin** -- converts inline issue/PR links into markdown
 *    reference-style links collected at the bottom of the document
 * 6. **NormalizeFormatPlugin** -- applies consistent formatting (spacing,
 *    trailing newlines, heading levels)
 *
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
 * @see {@link Categories} for the priority order used by ReorderSectionsPlugin
 * @see {@link ChangesetLinter} for the pre-validation layer (layer 1)
 * @see {@link Changelog} for the formatter layer (layer 2)
 *
 * @public
 */
export class ChangelogTransformer {
	/* v8 ignore next -- private constructor prevents direct instantiation */
	private constructor() {}

	/**
	 * Transform CHANGELOG markdown content by running all six transform plugins.
	 *
	 * @remarks
	 * The input is parsed with `remark-parse` and `remark-gfm` (for table
	 * support), processed through all six plugins in order, and stringified
	 * back to markdown. The operation is synchronous and idempotent.
	 *
	 * @param content - Raw CHANGELOG markdown string (may contain multiple
	 *   version blocks, GFM tables, footnotes, and reference links)
	 * @returns The transformed markdown string with sections merged, reordered,
	 *   deduplicated, and normalized
	 */
	static transformContent(content: string): string {
		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(MergeSectionsPlugin)
			.use(ReorderSectionsPlugin)
			.use(DeduplicateItemsPlugin)
			.use(ContributorFootnotesPlugin)
			.use(IssueLinkRefsPlugin)
			.use(NormalizeFormatPlugin)
			.use(remarkStringify);

		const file = processor.processSync(content);
		return String(file);
	}

	/**
	 * Transform a CHANGELOG file in-place.
	 *
	 * @remarks
	 * Reads the file synchronously, runs all transform plugins via
	 * {@link ChangelogTransformer.transformContent}, and writes the result
	 * back to the same path. The file is overwritten atomically (single
	 * `writeFileSync` call).
	 *
	 * This is the method used by the Effect CLI's `transform` subcommand
	 * when invoked without the `--dry-run` or `--check` flags.
	 *
	 * @param filePath - Absolute or relative path to the CHANGELOG.md file
	 */
	static transformFile(filePath: string): void {
		const content = readFileSync(filePath, "utf-8");
		const result = ChangelogTransformer.transformContent(content);
		writeFileSync(filePath, result, "utf-8");
	}
}
