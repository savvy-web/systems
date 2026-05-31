import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { GlobSchema, PackageScopeSchema, PackagesRecordSchema } from "../../src/changesets/schemas/package-scope.js";

describe("GlobSchema", () => {
	const decode = Schema.decodeUnknownSync(GlobSchema);

	it("accepts simple repo-relative globs", () => {
		expect(decode("plugin/**")).toBe("plugin/**");
		expect(decode("src/components/*.tsx")).toBe("src/components/*.tsx");
		expect(decode("README.md")).toBe("README.md");
	});

	it("accepts negation patterns", () => {
		expect(decode("!plugin/cache/**")).toBe("!plugin/cache/**");
		expect(decode("!**/node_modules/**")).toBe("!**/node_modules/**");
	});

	it("rejects empty strings", () => {
		expect(() => decode("")).toThrow();
	});

	it("rejects absolute paths", () => {
		expect(() => decode("/etc/passwd")).toThrow();
		expect(() => decode("/absolute/path/**")).toThrow();
	});

	it("rejects leading parent traversal", () => {
		expect(() => decode("../sibling/**")).toThrow();
	});

	it("rejects embedded parent traversal", () => {
		expect(() => decode("foo/../bar")).toThrow();
		expect(() => decode("plugin/../etc/passwd")).toThrow();
	});

	it("rejects non-string values", () => {
		expect(() => decode(42)).toThrow();
		expect(() => decode(null)).toThrow();
		expect(() => decode([])).toThrow();
	});
});

describe("PackageScopeSchema", () => {
	const decode = Schema.decodeUnknownSync(PackageScopeSchema);

	it("accepts an empty object — package uses only its workspace dir", () => {
		const result = decode({});
		expect(result.additionalScopes).toBeUndefined();
		expect(result.versionFiles).toBeUndefined();
	});

	it("accepts additionalScopes only", () => {
		const result = decode({ additionalScopes: ["plugin/**"] });
		expect(result.additionalScopes).toEqual(["plugin/**"]);
		expect(result.versionFiles).toBeUndefined();
	});

	it("accepts versionFiles only", () => {
		const result = decode({
			versionFiles: [{ glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"] }],
		});
		expect(result.versionFiles).toHaveLength(1);
		expect(result.additionalScopes).toBeUndefined();
	});

	it("accepts both additionalScopes and versionFiles", () => {
		const result = decode({
			additionalScopes: ["plugin/**", "!plugin/.cache/**"],
			versionFiles: [{ glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"] }],
		});
		expect(result.additionalScopes).toHaveLength(2);
		expect(result.versionFiles).toHaveLength(1);
	});

	it("rejects additionalScopes with invalid globs", () => {
		expect(() => decode({ additionalScopes: ["/absolute"] })).toThrow();
		expect(() => decode({ additionalScopes: ["../parent"] })).toThrow();
		expect(() => decode({ additionalScopes: [""] })).toThrow();
	});

	it("rejects versionFiles with invalid entries", () => {
		expect(() => decode({ versionFiles: [{ glob: "" }] })).toThrow();
		expect(() => decode({ versionFiles: [{ glob: "p.json", paths: ["invalid"] }] })).toThrow();
	});

	it("rejects versionFiles entries that include a `package` field (strict decode)", () => {
		const strict = Schema.decodeUnknownSync(PackageScopeSchema, { onExcessProperty: "error" });
		expect(() =>
			strict({
				versionFiles: [{ glob: "p.json", package: "@savvy-web/changesets" }],
			}),
		).toThrow();
	});
});

describe("PackagesRecordSchema", () => {
	const decode = Schema.decodeUnknownSync(PackagesRecordSchema);

	it("accepts an empty record", () => {
		const result = decode({});
		expect(Object.keys(result)).toHaveLength(0);
	});

	it("accepts a record with one package", () => {
		const result = decode({
			"@savvy-web/changesets": {
				additionalScopes: ["plugin/**"],
			},
		});
		expect(result["@savvy-web/changesets"]?.additionalScopes).toEqual(["plugin/**"]);
	});

	it("accepts a record with multiple packages", () => {
		const result = decode({
			"@savvy-web/changesets": { additionalScopes: ["plugin/**"] },
			"@savvy-web/commitlint": {},
			"@savvy-web/lint-staged": {
				versionFiles: [{ glob: "manifest.json" }],
			},
		});
		expect(Object.keys(result)).toHaveLength(3);
	});

	it("rejects record values that are not objects", () => {
		expect(() => decode({ "@savvy-web/changesets": "minor" })).toThrow();
		expect(() => decode({ "@savvy-web/changesets": null })).toThrow();
	});

	it("rejects record values with invalid additionalScopes", () => {
		expect(() => decode({ "@x/y": { additionalScopes: ["/absolute"] } })).toThrow();
	});

	it("does not validate that keys resolve to known workspace packages (that's ConfigInspector's job)", () => {
		// Schema-level validation accepts any string key.
		const result = decode({ "totally-fake-package-name": {} });
		expect(result["totally-fake-package-name"]).toEqual({});
	});
});
