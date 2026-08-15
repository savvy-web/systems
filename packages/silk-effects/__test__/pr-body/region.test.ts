/**
 * The generic `<!-- token:start -->` / `<!-- token:end -->` region grammar.
 */

import { describe, expect, it } from "vitest";
import { Region } from "../../src/pr-body/region.js";

describe("Region.start / Region.end", () => {
	it("render the paired delimiters for a token", () => {
		expect(Region.start("silk-release")).toBe("<!-- silk-release:start -->");
		expect(Region.end("silk-release")).toBe("<!-- silk-release:end -->");
	});
});

describe("Region.read", () => {
	it("returns the content between the delimiters", () => {
		const body = `before\n${Region.start("x")}\ninner\n${Region.end("x")}\nafter`;
		expect(Region.read(body, "x")).toBe("\ninner\n");
	});

	it("returns undefined when the region is absent", () => {
		expect(Region.read("no markers here", "x")).toBeUndefined();
	});

	it("returns undefined for an end-before-start pair", () => {
		expect(Region.read(`${Region.end("x")}${Region.start("x")}`, "x")).toBeUndefined();
	});

	it("returns a nested region of a different token as part of the content", () => {
		const body = [
			Region.start("outer"),
			Region.start("inner"),
			"payload",
			Region.end("inner"),
			Region.end("outer"),
		].join("\n");
		const outer = Region.read(body, "outer");
		expect(outer).toContain(Region.start("inner"));
		expect(outer).toContain("payload");
		expect(outer).toContain(Region.end("inner"));
	});
});

describe("Region.strip", () => {
	it("removes the region and its delimiters, leaving everything else", () => {
		const body = `keep\n${Region.start("x")}gone${Region.end("x")}\nalso keep`;
		expect(Region.strip(body, "x")).toBe("keep\n\nalso keep");
	});

	it("is a no-op on a body without the region", () => {
		expect(Region.strip("untouched", "x")).toBe("untouched");
	});
});

describe("Region.upsert", () => {
	const rendered = (n: number): string => `${Region.start("x")}\ncontent v${n}\n${Region.end("x")}`;

	it("appends below existing content when the region is absent", () => {
		expect(Region.upsert("hand-written intro", "x", rendered(1))).toBe(`hand-written intro\n\n${rendered(1)}`);
	});

	it("seeds an empty body with just the region", () => {
		expect(Region.upsert("", "x", rendered(1))).toBe(rendered(1));
	});

	it("replaces an existing region in place, preserving surrounding bytes", () => {
		const first = Region.upsert("above\n\nmore prose", "x", rendered(1));
		const second = Region.upsert(first, "x", rendered(2));
		expect(second).toContain("above");
		expect(second).toContain("more prose");
		expect(second).toContain("content v2");
		expect(second).not.toContain("content v1");
		expect(second.split(Region.start("x"))).toHaveLength(2);
	});

	it("is idempotent for the same rendered region", () => {
		const once = Region.upsert("prose", "x", rendered(1));
		expect(Region.upsert(once, "x", rendered(1))).toBe(once);
	});
});
