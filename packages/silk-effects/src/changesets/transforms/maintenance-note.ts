/**
 * Changelog transform: insert a Maintenance note into an empty version block.
 *
 * @remarks
 * When the targeted version block is empty
 * (or holds only the engine's empty-release placeholder sentence), inserts a
 * `### Maintenance` heading and a one-item list describing why the package
 * released. Idempotent: once the note exists the block is non-empty.
 *
 * @internal
 */

import type { PhrasingContent } from "@effected/markdown";
import { Heading, InlineCode, List, ListItem, Mdast, Paragraph, Root, Text } from "@effected/markdown";

import type { MaintenanceReason } from "../services/maintenance-reason.js";
import type { RootChild, VersionBlock } from "../utils/blocks.js";
import { getHeadingText, getVersionBlocks, isHeadingOfDepth } from "../utils/blocks.js";
import type { ChangelogTransform } from "./types.js";

/**
 * Placeholder sentence `@changesets/apply-release-plan` (>= 8.1.0) emits as the
 * body of a version block that would otherwise render as a bare heading.
 */
const ENGINE_PLACEHOLDER = "No changes in this release.";

/** True when the block's only content is the engine's empty-release placeholder. */
function isPlaceholderOnly(children: ReadonlyArray<RootChild>, block: VersionBlock): boolean {
	if (block.endIndex - block.startIndex !== 1) return false;
	const node = children[block.startIndex];
	return node.type === "paragraph" && Mdast.toText(node).trim() === ENGINE_PLACEHOLDER;
}

/**
 * Options for `maintenanceNote`.
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
			new Text({ value: "Version-only release to keep workspace versions consistent; no changes to this package." }),
		];
	}
	const label = reason.kind === "fixed" ? "fixed version group" : "linked version group";
	const nodes: PhrasingContent[] = [new Text({ value: "Released in lockstep with " })];
	reason.triggers.forEach((trigger, index) => {
		if (index > 0) nodes.push(new Text({ value: ", " }));
		nodes.push(new InlineCode({ value: `${trigger.name}@${trigger.version}` }));
	});
	nodes.push(new Text({ value: ` (${label}).` }));
	return nodes;
}

/**
 * Build a transform that adds a Maintenance note to the targeted empty version block.
 *
 * @param options - The target version and the release reason
 * @returns A transform; a no-op when the block is absent or non-empty
 *
 * @internal
 */
export function maintenanceNote(options: MaintenanceNoteOptions): ChangelogTransform {
	return (root) => {
		const children: RootChild[] = [...root.children];
		const block = getVersionBlocks(children).find((b) => {
			const node = children[b.headingIndex];
			return isHeadingOfDepth(node, [2]) && getHeadingText(node) === options.version;
		});
		if (!block) return root;

		// Only act on an empty block: a dep-bump-only release also has zero
		// changesets but carries a Dependencies section; once the note exists the
		// block is non-empty, making this idempotent.
		const placeholderOnly = isPlaceholderOnly(children, block);
		if (block.endIndex > block.startIndex && !placeholderOnly) return root;

		const heading = new Heading({ depth: 3, children: [new Text({ value: "Maintenance" })] });
		const list = new List({
			ordered: false,
			spread: false,
			children: [
				new ListItem({ spread: false, children: [new Paragraph({ children: buildNoteChildren(options.reason) })] }),
			],
		});
		children.splice(block.startIndex, placeholderOnly ? 1 : 0, heading, list);
		return new Root({ ...root, children });
	};
}
