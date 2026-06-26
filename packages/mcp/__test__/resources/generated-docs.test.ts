import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { resolveContentRoot } from "../../src/resources/load.js";
import { Manifest } from "../../src/resources/schema.js";

describe("generated docs", () => {
	it("generated package docs appear in the manifest with the api tag and /api/ id", () => {
		const root = resolveContentRoot();
		const manifest = Schema.decodeUnknownSync(Manifest)(JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")));
		const generated = manifest.entries.filter((e) => e.source === "generated");
		// Skip-tolerant: if generation was skipped (no models), this is a no-op
		// rather than a false failure. The verification recipe always builds first.
		if (generated.length === 0) return;
		// Symbol pages live at <pkg>/api/<kind>/<slug>; the per-package index page
		// (#179) lives at the bare <pkg>/api. Both are under the api namespace.
		expect(generated.every((e) => /\/api(\/|$)/.test(e.id))).toBe(true);
		expect(generated.every((e) => e.tags.includes("api"))).toBe(true);
	});
});
