/**
 * Link known API item names in prose to their docs. Ported from
 * rspress-plugin-api-extractor's MarkdownCrossLinker; the scanning is shared and
 * the URL is supplied by an injected RouteFormatter so each consumer chooses its
 * own scheme (path routes for a site, silk:// URIs for the MCP). Pure.
 *
 * @packageDocumentation
 */

import type { ApiItemRef, RouteFormatter } from "./types.js";

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class CrossLinker {
	private readonly byName: ReadonlyMap<string, ApiItemRef>;
	private readonly routeFor: RouteFormatter;

	constructor(refs: ReadonlyArray<ApiItemRef>, routeFor: RouteFormatter) {
		this.byName = new Map(refs.map((r) => [r.name, r]));
		this.routeFor = routeFor;
	}

	/** Wrap known item names in markdown links, skipping code spans + existing links. */
	addLinks(text: string): string {
		let result = text;
		// Longest names first so "HookEvent" matches before "Hook".
		const names = [...this.byName.keys()].sort((a, b) => b.length - a.length);
		for (const name of names) {
			const ref = this.byName.get(name);
			if (!ref) continue;
			const route = this.routeFor(ref);
			const regex = new RegExp(`\\b${escapeRegExp(name)}\\b(?![a-zA-Z])`, "g");
			result = result.replace(regex, (match, offset: number) => {
				const before = result.slice(0, offset);
				if (before.endsWith("](") || before.endsWith("[")) return match; // already a link
				if ((before.match(/`/g) || []).length % 2 === 1) return match; // inside a code span
				return `[${match}](${route})`;
			});
		}
		return result;
	}
}
