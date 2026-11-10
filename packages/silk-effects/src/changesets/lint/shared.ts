/**
 * Shared helpers for the CSH changeset lint rules.
 *
 * @internal
 */

import type { MarkdownNode, Root } from "@effected/markdown";
import type { LintContext } from "@effected/markdown-lint";
import type { RootChild } from "../utils/blocks.js";

/** The tag every CSH rule carries, so a markdownlint config can toggle them as a group. */
export const TAGS: readonly [string, ...string[]] = ["changeset"];

/**
 * The document's top-level blocks, front matter excluded.
 *
 * @remarks
 * Both hosts parse the whole file with front matter capture on, so the root
 * carries a `frontmatter` node first; the CSH rules lint the body only.
 *
 * @internal
 */
export function bodyChildren(root: Root): ReadonlyArray<RootChild> {
	return root.children.filter((node): node is RootChild => node.type !== "frontmatter");
}

/**
 * Report one finding positioned on `node`, with `message` as its detail.
 *
 * @internal
 */
export function reportAt(
	context: LintContext,
	report: (diagnostic: ReturnType<LintContext["diagnostic"]>) => void,
	node: MarkdownNode,
	message: string,
): void {
	report(context.diagnostic({ at: node, detail: message }));
}
