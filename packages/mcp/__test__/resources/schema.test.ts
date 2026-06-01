// packages/mcp/__test__/resources/schema.test.ts
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DocFrontMatter, ManifestEntry } from "../../src/resources/schema.js";

describe("DocFrontMatter", () => {
	const valid = {
		id: "standards/changeset-discipline",
		title: "Changeset discipline",
		summary: "When and why a changeset is required.",
		tier: "standards",
		source: "hand",
		tags: ["changeset", "release"],
	};

	it("decodes a minimal valid doc and defaults status to stable", () => {
		const decoded = Schema.decodeUnknownSync(DocFrontMatter)(valid);
		expect(decoded.status).toBe("stable");
		expect(decoded.tier).toBe("standards");
	});

	it("rejects an id whose first segment is not a known tier prefix shape", () => {
		expect(() => Schema.decodeUnknownSync(DocFrontMatter)({ ...valid, id: "Bad Id With Spaces" })).toThrow();
	});

	it("accepts a directory-index id with a trailing slash", () => {
		const decoded = Schema.decodeUnknownSync(DocFrontMatter)({
			...valid,
			id: "packages/silk-effects/",
			tier: "packages",
		});
		expect(decoded.id).toBe("packages/silk-effects/");
	});

	it("rejects a priority outside 0..1", () => {
		expect(() => Schema.decodeUnknownSync(DocFrontMatter)({ ...valid, priority: 1.5 })).toThrow();
	});

	it("ManifestEntry requires a derived uri", () => {
		const entry = Schema.decodeUnknownSync(ManifestEntry)({
			...valid,
			uri: "silk://standards/changeset-discipline",
			status: "stable",
		});
		expect(entry.uri).toBe("silk://standards/changeset-discipline");
	});
});
