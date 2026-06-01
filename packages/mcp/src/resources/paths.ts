/**
 * Resolve a relative content path against the content root, appending `.md`
 * (or `index.md` for a trailing slash) and rejecting traversal. Operates on
 * the manifest-resolved relative path, never on URL components.
 *
 * @packageDocumentation
 */

import { isAbsolute, normalize, resolve, sep } from "node:path";

export function resolveResourcePath(root: string, relativePath: string): string {
	if (relativePath.includes("\0")) throw new Error("path contains null byte");
	if (isAbsolute(relativePath)) throw new Error("absolute path not allowed");

	const stripped = relativePath.replace(/^\/+/, "");
	const withIndex = stripped === "" || stripped.endsWith("/") ? `${stripped}index` : stripped;
	const withExt = withIndex.endsWith(".md") ? withIndex : `${withIndex}.md`;
	const resolved = resolve(root, normalize(withExt));

	const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
	if (!resolved.startsWith(rootWithSep) && resolved !== root) throw new Error("path escapes content root");
	return resolved;
}
