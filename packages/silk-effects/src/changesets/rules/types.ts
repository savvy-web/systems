/**
 * Shared types for the kit-node changeset lint rules.
 *
 * @internal
 */

import type { MarkdownNode, Position, Root } from "@effected/markdown";

/**
 * A single lint finding produced by a rule.
 *
 * @internal
 */
export interface RuleFinding {
	/** Unprefixed rule id, e.g. `changeset-heading-hierarchy`. */
	readonly rule: string;
	/** Human-readable message, including the documentation suffix. */
	readonly message: string;
	/** Source position of the offending node. */
	readonly position: Position;
}

/**
 * A lint rule: a pure function from a kit root to its findings.
 *
 * @internal
 */
export type LintRule = (root: Root) => ReadonlyArray<RuleFinding>;

/**
 * Build a {@link RuleFinding} positioned on a node.
 *
 * @param rule - The rule id
 * @param message - The finding message
 * @param node - The offending node
 * @returns The finding
 *
 * @internal
 */
export function finding(rule: string, message: string, node: MarkdownNode): RuleFinding {
	return { rule, message, position: node.position };
}
