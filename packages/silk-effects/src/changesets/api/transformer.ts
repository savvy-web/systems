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
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { ContributorFootnotesPlugin } from "../remark/plugins/contributor-footnotes.js";
import type { MaintenanceNoteOptions } from "../remark/plugins/maintenance-note.js";
import { MaintenanceNotePlugin } from "../remark/plugins/maintenance-note.js";
import { SilkChangesetTransformPreset } from "../remark/presets.js";
import { emitMarkdown } from "../utils/markdown-emit.js";

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
 * Implements the third layer of the three-layer pipeline by running
 * the {@link SilkChangesetTransformPreset} plugins (currently seven) in a
 * fixed order to clean up, normalize, and enhance changelog output produced
 * by the formatter layer.
 *
 * @remarks
 * See {@link SilkChangesetTransformPreset} for the ordered plugin list and
 * the rationale behind each plugin's position.
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
	 * Transform CHANGELOG markdown content by running the
	 * {@link SilkChangesetTransformPreset} plugins.
	 *
	 * @remarks
	 * The input is parsed with `remark-parse` and `remark-gfm` (for table
	 * support), processed through every plugin in {@link SilkChangesetTransformPreset}
	 * in order, and emitted back to markdown through the canonical
	 * `@effected/markdown` stringifier. The operation is synchronous and
	 * idempotent.
	 *
	 * @param content - Raw CHANGELOG markdown string (may contain multiple
	 *   version blocks, GFM tables, footnotes, and reference links)
	 * @param options - Optional transformation options, including maintenance note configuration
	 * @returns The transformed markdown string with dependency tables aggregated,
	 *   sections merged, reordered, deduplicated, and normalized
	 */
	static transformContent(content: string, options?: TransformOptions): string {
		const processor = unified().use(remarkParse).use(remarkGfm);
		for (const plugin of SilkChangesetTransformPreset) {
			// ContributorFootnotesPlugin is the one preset member that takes
			// options — pass `thanks` through when the caller set it.
			if (plugin === ContributorFootnotesPlugin && options?.thanks !== undefined) {
				processor.use(ContributorFootnotesPlugin, { thanks: options.thanks });
			} else {
				processor.use(plugin);
			}
		}
		if (options?.maintenance) {
			processor.use(MaintenanceNotePlugin, options.maintenance);
		}

		const parsed = processor.parse(content);
		const transformed = processor.runSync(parsed) as Root;
		return emitMarkdown(transformed);
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
	 * @param options - Optional transformation options, including maintenance note configuration
	 */
	static transformFile(filePath: string, options?: TransformOptions): void {
		const content = readFileSync(filePath, "utf-8");
		const result = ChangelogTransformer.transformContent(content, options);
		writeFileSync(filePath, result, "utf-8");
	}
}
