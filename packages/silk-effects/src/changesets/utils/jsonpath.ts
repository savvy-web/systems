/**
 * Minimal JSONPath get/set for version file updates.
 *
 * @remarks
 * Implements a subset of the JSONPath specification sufficient for
 * reading and writing version fields in JSON configuration files.
 * The parser tokenizes a JSONPath string into {@link Segment} objects,
 * then the get/set functions traverse or mutate an object graph
 * using a breadth-first expansion strategy (each segment fans out
 * the current set of matched nodes).
 *
 * Supported syntax:
 * - `$.foo.bar` — nested property access
 * - `$.foo[*].bar` — array wildcard (iterate all elements)
 * - `$.foo[0].bar` — array index access
 *
 * Not supported: recursive descent (`..`), filter expressions, or
 * script expressions.
 *
 * @see {@link VersionFiles} for the public utility that uses JSONPath
 *   to update version fields in workspace files
 *
 * @internal
 */

/**
 * A single segment in a parsed JSONPath expression.
 *
 * @remarks
 * Represents one step in the path traversal:
 * - `property` — access an object key by name
 * - `index` — access an array element by numeric index
 * - `wildcard` — iterate over all elements of an array
 *
 * @internal
 */
export type Segment =
	| { readonly type: "property"; readonly key: string }
	| { readonly type: "index"; readonly index: number }
	| { readonly type: "wildcard" };

/**
 * Tokenize a JSONPath string into segments.
 *
 * @remarks
 * Strips the leading `$.` prefix, then splits on `.` boundaries while
 * preserving bracket expressions (`[*]`, `[0]`). Each token is converted
 * to the corresponding {@link Segment} discriminated union variant.
 *
 * @param path - JSONPath string (e.g., `"$.foo[*].bar"`)
 * @returns Array of path segments
 * @throws If the path does not start with `$.`
 * @throws If the path cannot be tokenized after the `$.` prefix
 *
 * @example
 * ```typescript
 * import { parseJsonPath } from "../utils/jsonpath.js";
 *
 * const segments = parseJsonPath("$.packages[*].version");
 * // [
 * //   { type: "property", key: "packages" },
 * //   { type: "wildcard" },
 * //   { type: "property", key: "version" },
 * // ]
 * ```
 *
 * @internal
 */
export function parseJsonPath(path: string): Segment[] {
	if (!path.startsWith("$.")) {
		throw new Error(`Invalid JSONPath: must start with "$." — got "${path}"`);
	}

	const segments: Segment[] = [];
	const raw = path.slice(2); // strip "$."

	if (raw === "") {
		return segments;
	}

	// Split on `.` but preserve bracket expressions
	const tokens = raw.match(/[^.[\]]+|\[\*\]|\[\d+\]/g);

	if (!tokens) {
		throw new Error(`Invalid JSONPath: could not parse "${path}"`);
	}

	for (const token of tokens) {
		if (token === "[*]") {
			segments.push({ type: "wildcard" });
		} else if (token.startsWith("[") && token.endsWith("]")) {
			segments.push({ type: "index", index: Number.parseInt(token.slice(1, -1), 10) });
		} else {
			segments.push({ type: "property", key: token });
		}
	}

	return segments;
}

/**
 * Collect all values matching a JSONPath expression.
 *
 * @remarks
 * Uses a breadth-first expansion: starting with the root object,
 * each segment fans out the current set of matched nodes. Wildcards
 * expand arrays into their individual elements. Non-object/non-array
 * nodes at any intermediate step are silently skipped.
 *
 * @param obj - The object to query
 * @param path - JSONPath string (e.g., `"$.version"`)
 * @returns Array of all matched values (empty if no matches)
 *
 * @example
 * ```typescript
 * import { jsonPathGet } from "../utils/jsonpath.js";
 *
 * const obj = { packages: [{ version: "1.0.0" }, { version: "2.0.0" }] };
 * const versions = jsonPathGet(obj, "$.packages[*].version");
 * // ["1.0.0", "2.0.0"]
 * ```
 *
 * @internal
 */
export function jsonPathGet(obj: unknown, path: string): unknown[] {
	const segments = parseJsonPath(path);
	let current: unknown[] = [obj];

	for (const segment of segments) {
		const next: unknown[] = [];

		for (const node of current) {
			if (node === null || node === undefined || typeof node !== "object") {
				continue;
			}

			switch (segment.type) {
				case "property": {
					const value = (node as Record<string, unknown>)[segment.key];
					if (value !== undefined) {
						next.push(value);
					}
					break;
				}
				case "index": {
					if (Array.isArray(node) && segment.index < node.length) {
						next.push(node[segment.index]);
					}
					break;
				}
				case "wildcard": {
					if (Array.isArray(node)) {
						next.push(...node);
					}
					break;
				}
			}
		}

		current = next;
	}

	return current;
}

/**
 * Mutate all matching locations in an object in-place.
 *
 * @remarks
 * Walks to the parent(s) of the final segment, then sets the value
 * at each matching location. Only updates existing keys/indices;
 * does not create new properties or extend arrays. Returns the count
 * of locations actually updated.
 *
 * @param obj - The object to modify in-place
 * @param path - JSONPath string (e.g., `"$.packages[*].version"`)
 * @param value - The value to set at each matching location
 * @returns The number of locations updated (0 if no matches or empty path)
 *
 * @example
 * ```typescript
 * import { jsonPathSet } from "../utils/jsonpath.js";
 *
 * const obj = { version: "1.0.0" };
 * const count = jsonPathSet(obj, "$.version", "2.0.0");
 * // count === 1, obj.version === "2.0.0"
 * ```
 *
 * @internal
 */
export function jsonPathSet(obj: unknown, path: string, value: unknown): number {
	const segments = parseJsonPath(path);

	if (segments.length === 0) {
		return 0;
	}

	// Walk to the parent(s) of the final segment
	const lastSegment = segments[segments.length - 1];
	const parentSegments = segments.slice(0, -1);

	let parents: unknown[] = [obj];

	for (const segment of parentSegments) {
		const next: unknown[] = [];

		for (const node of parents) {
			if (node === null || node === undefined || typeof node !== "object") {
				continue;
			}

			switch (segment.type) {
				case "property": {
					const child = (node as Record<string, unknown>)[segment.key];
					if (child !== undefined) {
						next.push(child);
					}
					break;
				}
				case "index": {
					if (Array.isArray(node) && segment.index < node.length) {
						next.push(node[segment.index]);
					}
					break;
				}
				case "wildcard": {
					if (Array.isArray(node)) {
						next.push(...node);
					}
					break;
				}
			}
		}

		parents = next;
	}

	// Set value at the final segment on each parent
	let count = 0;

	for (const parent of parents) {
		if (parent === null || parent === undefined || typeof parent !== "object") {
			continue;
		}

		switch (lastSegment.type) {
			case "property": {
				if (lastSegment.key in (parent as Record<string, unknown>)) {
					(parent as Record<string, unknown>)[lastSegment.key] = value;
					count++;
				}
				break;
			}
			case "index": {
				if (Array.isArray(parent) && lastSegment.index < parent.length) {
					parent[lastSegment.index] = value;
					count++;
				}
				break;
			}
			case "wildcard": {
				if (Array.isArray(parent)) {
					for (let i = 0; i < parent.length; i++) {
						parent[i] = value;
						count++;
					}
				}
				break;
			}
		}
	}

	return count;
}
