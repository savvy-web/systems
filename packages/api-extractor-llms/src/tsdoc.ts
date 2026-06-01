// packages/api-extractor-llms/src/tsdoc.ts
/**
 * Pure TSDoc + API-model extraction helpers, ported from
 * rspress-plugin-api-extractor's ApiParser. Each reads documentation off an
 * ApiItem and returns plain data — no rendering, no I/O.
 *
 * @packageDocumentation
 */

import type { ApiItem } from "@microsoft/api-extractor-model";
import { ApiDocumentedItem, ApiReleaseTagMixin, ReleaseTag } from "@microsoft/api-extractor-model";
import type { DocNode } from "@microsoft/tsdoc";

/** Recursively flatten a TSDoc DocNode tree to plain text (code spans → backticks). */
export function extractPlainText(node: DocNode): string {
	// biome-ignore lint/suspicious/noExplicitAny: TSDoc node internals require dynamic access
	const nodeAny = node as any;

	if (node.kind === "PlainText") return nodeAny.text || "";
	if (node.kind === "SoftBreak") return " ";
	if (node.kind === "CodeSpan") return `\`${nodeAny.code || ""}\``;
	if (node.kind === "LinkTag") {
		if (nodeAny.linkText) return extractPlainText(nodeAny.linkText);
		const ref = nodeAny.codeDestination?.memberReferences?.[0]?.memberIdentifier;
		return ref?.identifier || "";
	}

	const parts: string[] = [];
	if (typeof nodeAny.getChildNodes === "function") {
		for (const child of nodeAny.getChildNodes() as DocNode[]) {
			const childText = extractPlainText(child);
			if (childText) parts.push(childText);
		}
	}
	return parts.join("");
}

/** The TSDoc `@summary` section as a single cleaned line. */
export function getSummary(item: ApiItem): string {
	if (item instanceof ApiDocumentedItem) {
		const tsdoc = item.tsdocComment;
		if (tsdoc?.summarySection) {
			return extractPlainText(tsdoc.summarySection).replace(/\s+/g, " ").trim();
		}
	}
	return "";
}

/** `@param` blocks merged with parameter types from the declaration excerpt. */
export function getParams(item: ApiItem): Array<{ name: string; type?: string; description: string }> {
	const out: Array<{ name: string; type?: string; description: string }> = [];
	const paramTypes = new Map<string, string>();
	// biome-ignore lint/suspicious/noExplicitAny: API Extractor types require dynamic access
	const parameters = (item as any).parameters;
	if (Array.isArray(parameters)) {
		for (const param of parameters) {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic access
			const excerpt = (param as any).parameterTypeExcerpt;
			// biome-ignore lint/suspicious/noExplicitAny: dynamic access
			const name = (param as any).name || "";
			if (excerpt?.text) paramTypes.set(name, String(excerpt.text).trim());
		}
	}

	if (item instanceof ApiDocumentedItem) {
		const tsdoc = item.tsdocComment;
		if (tsdoc?.params) {
			for (const block of tsdoc.params.blocks) {
				// biome-ignore lint/suspicious/noExplicitAny: dynamic access
				const blockAny = block as any;
				const name = blockAny.parameterName || "";
				const description = extractPlainText(blockAny.content).replace(/\s+/g, " ").trim();
				const type = paramTypes.get(name);
				out.push({ name, ...(type != null ? { type } : {}), description });
			}
			return out;
		}
	}

	for (const [name, type] of paramTypes.entries()) out.push({ name, type, description: "" });
	return out;
}

/** The `@returns` block description, if present. */
export function getReturns(item: ApiItem): { description: string } | null {
	if (item instanceof ApiDocumentedItem) {
		const tsdoc = item.tsdocComment;
		if (tsdoc?.returnsBlock) {
			// biome-ignore lint/suspicious/noExplicitAny: TSDoc returns block internals need dynamic access
			const description = extractPlainText((tsdoc.returnsBlock as any).content)
				.replace(/\s+/g, " ")
				.trim();
			return description.length > 0 ? { description } : null;
		}
	}
	return null;
}

/** All `@example` fenced-code blocks (falls back to plain text). */
export function getExamples(item: ApiItem): Array<{ language: string; code: string }> {
	const examples: Array<{ language: string; code: string }> = [];
	if (!(item instanceof ApiDocumentedItem)) return examples;
	const tsdoc = item.tsdocComment;
	// biome-ignore lint/suspicious/noExplicitAny: dynamic access
	for (const block of ((tsdoc?.customBlocks as any) || []) as any[]) {
		if (block.blockTag?.tagNameWithUpperCase !== "@EXAMPLE") continue;
		const content = block.content;
		let found = false;
		for (const node of (content?.nodes || []) as Array<{ kind: string; language?: string; code?: string }>) {
			if (node.kind === "FencedCode") {
				examples.push({ language: node.language || "typescript", code: node.code || "" });
				found = true;
			}
		}
		if (!found) {
			const text = extractPlainText(content).trim();
			if (text) examples.push({ language: "typescript", code: text });
		}
	}
	return examples;
}

/** Reads the deprecation-block message from an ApiItem, if one is present. */
export function getDeprecation(item: ApiItem): { message: string } | null {
	if (item instanceof ApiDocumentedItem) {
		const tsdoc = item.tsdocComment;
		if (tsdoc?.deprecatedBlock) {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic access
			const message = extractPlainText((tsdoc.deprecatedBlock as any).content)
				.replace(/\s+/g, " ")
				.trim();
			return { message };
		}
	}
	return null;
}

/** The release tag (Public/Beta/Alpha/Internal) or "Public" when absent. */
export function getReleaseTag(item: ApiItem): string {
	if (ApiReleaseTagMixin.isBaseClassOf(item)) {
		switch (item.releaseTag) {
			case ReleaseTag.Public:
				return "Public";
			case ReleaseTag.Beta:
				return "Beta";
			case ReleaseTag.Alpha:
				return "Alpha";
			case ReleaseTag.Internal:
				return "Internal";
			default:
				return "Public";
		}
	}
	return "Public";
}

/** True when the item carries the given TSDoc modifier tag (without the `@`). */
export function hasModifierTag(item: ApiItem, tagName: string): boolean {
	if (item instanceof ApiDocumentedItem) {
		const tsdoc = item.tsdocComment;
		// biome-ignore lint/suspicious/noExplicitAny: TSDoc modifier set requires dynamic access
		const nodes = (tsdoc?.modifierTagSet as any)?.nodes || [];
		// biome-ignore lint/suspicious/noExplicitAny: dynamic access
		return nodes.some((t: any) => t.tagName === `@${tagName}`);
	}
	return false;
}
