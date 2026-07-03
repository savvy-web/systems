/**
 * Remark transform: insert a Maintenance section into empty version blocks.
 *
 * When a version block in the CHANGELOG contains no changesets (is structurally
 * empty), this plugin inserts a `### Maintenance` section explaining why the
 * package released with no direct changes, based on the {@link MaintenanceReason}
 * provided.
 *
 * @remarks
 * This plugin is run after {@link SilkChangesetTransformPreset} (which produces
 * the initial CHANGELOG structure) and is applied to each version block
 * individually via its {@link MaintenanceNoteOptions}. It makes the plugin
 * deliberately parameterized per file rather than a preset member, allowing
 * callers to decide which version blocks need maintenance notes.
 *
 * The plugin checks whether a version block is structurally empty (contains no
 * content between its heading and the next version heading). If empty, it inserts
 * a `### Maintenance` heading followed by a list item with a descriptive
 * paragraph. The paragraph text varies by {@link MaintenanceReason.kind}:
 *
 * - `fixed` or `linked`: lists the triggered packages and describes the version
 *   group.
 * - `unspecified`: generic text explaining a version-only release.
 *
 * The plugin is idempotent: if the Maintenance section already exists, no further
 * action is taken.
 *
 * @example
 * ```typescript
 * import { MaintenanceNotePlugin } from "\@savvy-web/changesets/remark";
 * import remarkParse from "remark-parse";
 * import remarkStringify from "remark-stringify";
 * import { unified } from "unified";
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(MaintenanceNotePlugin, {
 *     version: "2.3.1",
 *     reason: { kind: "fixed", triggers: [{ name: "@pkg/dep", version: "2.3.1" }] },
 *   })
 *   .use(remarkStringify);
 *
 * const result = processor.processSync("## 2.3.1\n");
 * // Output includes "### Maintenance" with description
 * ```
 *
 * @see {@link NormalizeFormatPlugin} for format normalization before this plugin
 * @see {@link SilkChangesetTransformPreset} for the full preset (this plugin runs after)
 *
 * @public
 */

import type { Heading, List, Paragraph, PhrasingContent, Root } from "mdast";
import type { Plugin } from "unified";

import type { MaintenanceReason } from "../../services/maintenance-reason.js";
import { getHeadingText, getVersionBlocks } from "../../utils/version-blocks.js";

/**
 * Options for {@link MaintenanceNotePlugin}.
 *
 * @public
 */
export interface MaintenanceNoteOptions {
	/** Version heading text to target (e.g. `"2.3.1"`). */
	readonly version: string;
	/** Why the package released with no changesets of its own. */
	readonly reason: MaintenanceReason;
}

function buildNoteChildren(reason: MaintenanceReason): PhrasingContent[] {
	if (reason.kind === "unspecified" || reason.triggers.length === 0) {
		return [
			{
				type: "text",
				value: "Version-only release to keep workspace versions consistent; no changes to this package.",
			},
		];
	}
	const label = reason.kind === "fixed" ? "fixed version group" : "linked version group";
	const children: PhrasingContent[] = [{ type: "text", value: "Released in lockstep with " }];
	reason.triggers.forEach((trigger, index) => {
		if (index > 0) children.push({ type: "text", value: ", " });
		children.push({ type: "inlineCode", value: `${trigger.name}@${trigger.version}` });
	});
	children.push({ type: "text", value: ` (${label}).` });
	return children;
}

export const MaintenanceNotePlugin: Plugin<[MaintenanceNoteOptions], Root> = (options) => {
	return (tree: Root) => {
		const block = getVersionBlocks(tree).find(
			(b) => getHeadingText(tree.children[b.headingIndex] as Heading) === options.version,
		);
		if (!block) return;
		// Only act on a structurally empty block: a dep-bump-only release also
		// has zero changesets but carries a Dependencies section; and once the
		// note exists the block is non-empty, making the plugin idempotent.
		if (block.endIndex > block.startIndex) return;

		const heading: Heading = { type: "heading", depth: 3, children: [{ type: "text", value: "Maintenance" }] };
		const paragraph: Paragraph = { type: "paragraph", children: buildNoteChildren(options.reason) };
		const list: List = {
			type: "list",
			ordered: false,
			spread: false,
			children: [{ type: "listItem", spread: false, children: [paragraph] }],
		};
		tree.children.splice(block.startIndex, 0, heading, list);
	};
};
