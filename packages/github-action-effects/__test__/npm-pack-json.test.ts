import { describe, expect, it } from "vitest";
import { parseNpmPackJson } from "../src/utils/npm-pack-json.js";

describe("parseNpmPackJson", () => {
	it("reads the npm 11 array form", () => {
		const stdout = JSON.stringify([
			{ filename: "pkg-1.0.0.tgz", name: "pkg", version: "1.0.0", integrity: "sha512-abc", entryCount: 2 },
		]);

		const entries = parseNpmPackJson(stdout);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.filename).toBe("pkg-1.0.0.tgz");
		expect(entries[0]?.entryCount).toBe(2);
	});

	it("reads the npm 12 name-keyed object form", () => {
		// npm 12 changed `pack --json` to the object form `publish --json` already
		// used: `{ "<pkg-name>": <entry> }`. Reading `[0]` off it yields undefined,
		// which surfaced as "npm pack returned empty result" on every publish.
		const stdout = JSON.stringify({
			pkg: { filename: "pkg-1.0.0.tgz", name: "pkg", version: "1.0.0", integrity: "sha512-abc", entryCount: 2 },
		});

		const entries = parseNpmPackJson(stdout);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.filename).toBe("pkg-1.0.0.tgz");
		expect(entries[0]?.entryCount).toBe(2);
	});

	it("reads a scoped package name as the object key", () => {
		const stdout = JSON.stringify({
			"@scope/pkg": { filename: "scope-pkg-1.0.0.tgz", name: "@scope/pkg", entryCount: 1 },
		});

		expect(parseNpmPackJson(stdout)[0]?.name).toBe("@scope/pkg");
	});

	it("reads a bare single entry object with no wrapper key", () => {
		// `publish --dry-run --json` on some npm versions emits one unwrapped entry.
		const stdout = JSON.stringify({ size: 1234, unpackedSize: 5678, entryCount: 9 });

		const entries = parseNpmPackJson(stdout);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.entryCount).toBe(9);
	});

	it("returns no entries for the npm 11 empty array", () => {
		expect(parseNpmPackJson("[]")).toHaveLength(0);
	});

	it("returns no entries for the npm 12 empty object", () => {
		expect(parseNpmPackJson("{}")).toHaveLength(0);
	});

	it("throws with npm's summary when npm emits an error envelope", () => {
		// npm 12 emits `{ error: { code, summary, detail } }` on stdout.
		const stdout = JSON.stringify({
			error: { code: "MODULE_NOT_FOUND", summary: "Cannot find module 'sigstore'", detail: "" },
		});

		expect(() => parseNpmPackJson(stdout)).toThrow(/MODULE_NOT_FOUND: Cannot find module 'sigstore'/);
	});

	it("throws on unparseable output", () => {
		expect(() => parseNpmPackJson("not json")).toThrow();
	});
});
