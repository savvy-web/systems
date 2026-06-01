import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { resolveContentRoot } from "../../src/resources/load.js";
import { resolveResourcePath } from "../../src/resources/paths.js";
import { Manifest } from "../../src/resources/schema.js";

describe("catalog integrity", () => {
	it("every manifest URI resolves to a bundled markdown body", () => {
		const root = resolveContentRoot();
		const manifest = Schema.decodeUnknownSync(Manifest)(JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")));
		expect(manifest.entries.length).toBeGreaterThan(0);
		for (const e of manifest.entries) {
			const file = resolveResourcePath(root, e.uri.replace(/^silk:\/\//, ""));
			expect(existsSync(file), `${e.uri} -> ${file}`).toBe(true);
		}
	});
});
