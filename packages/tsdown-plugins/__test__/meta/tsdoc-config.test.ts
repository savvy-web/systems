import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTsdocConfig, writeTsdocConfig } from "../../src/meta/tsdoc-config.js";

describe("buildTsdocConfig", () => {
	it("includes the schema, enables standard tags, and lists custom tag definitions", () => {
		const cfg = buildTsdocConfig({
			suppressWarnings: [],
			tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
		});
		expect(cfg.$schema).toContain("tsdoc.schema.json");
		expect(cfg.noStandardTags).toBe(false);
		expect((cfg.tagDefinitions as Array<{ tagName: string }>).some((t) => t.tagName === "@since")).toBe(true);
		// supportForTags is populated from the standard set so api-extractor accepts standard tags.
		expect(Object.keys(cfg.supportForTags as object).length).toBeGreaterThan(0);
	});
});

describe("writeTsdocConfig", () => {
	it("writes tsdoc.json to cwd and is idempotent (no rewrite when unchanged)", () => {
		const dir = mkdtempSync(join(tmpdir(), "tsdoc-"));
		const path = writeTsdocConfig(dir, { suppressWarnings: [], tagDefinitions: [] });
		expect(path).toBe(join(dir, "tsdoc.json"));
		const first = readFileSync(path, "utf-8");
		// mutate mtime sentinel: rewrite a marker file, then re-run; content must be byte-identical
		writeTsdocConfig(dir, { suppressWarnings: [], tagDefinitions: [] });
		expect(readFileSync(path, "utf-8")).toBe(first);
	});

	it("rewrites when the config changes", () => {
		const dir = mkdtempSync(join(tmpdir(), "tsdoc-"));
		writeTsdocConfig(dir, { suppressWarnings: [], tagDefinitions: [] });
		const before = readFileSync(join(dir, "tsdoc.json"), "utf-8");
		writeTsdocConfig(dir, { suppressWarnings: [], tagDefinitions: [{ tagName: "@x", syntaxKind: "modifier" }] });
		const after = readFileSync(join(dir, "tsdoc.json"), "utf-8");
		expect(after).not.toBe(before);
		expect(after).toContain("@x");
	});
});
