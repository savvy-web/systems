// packages/mcp/__test__/resources/paths.test.ts
import { sep } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveResourcePath } from "../../src/resources/paths.js";

describe("resolveResourcePath", () => {
	const root = `${sep}srv${sep}content`;

	it("appends .md and resolves under root", () => {
		expect(resolveResourcePath(root, "standards/changeset-discipline")).toBe(
			`${root}${sep}standards${sep}changeset-discipline.md`,
		);
	});

	it("normalizes a trailing slash to the directory index path", () => {
		expect(resolveResourcePath(root, "packages/silk-effects/")).toBe(
			`${root}${sep}packages${sep}silk-effects${sep}index.md`,
		);
	});

	it("rejects traversal", () => {
		expect(() => resolveResourcePath(root, "../secrets")).toThrow(/escapes/);
	});

	it("rejects absolute paths and null bytes", () => {
		expect(() => resolveResourcePath(root, `${sep}etc${sep}passwd`)).toThrow(/absolute/);
		expect(() => resolveResourcePath(root, "a\0b")).toThrow(/null byte/);
	});
});
