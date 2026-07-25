import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
	JsonPathSchema,
	// biome-ignore lint/suspicious/noDeprecatedImports: tests cover the deprecated 0.9.0 shape until it is removed in 1.0.0
	LegacyVersionFileConfigSchema,
	// biome-ignore lint/suspicious/noDeprecatedImports: tests cover the deprecated 0.9.0 shape until it is removed in 1.0.0
	LegacyVersionFilesSchema,
	VersionFileConfigSchema,
	VersionFilesSchema,
} from "../../src/changesets/schemas/version-files.js";

describe("JsonPathSchema", () => {
	const decode = Schema.decodeUnknownSync(JsonPathSchema);

	it("accepts valid JSONPath expressions", () => {
		expect(decode("$.version")).toBe("$.version");
		expect(decode("$.metadata.version")).toBe("$.metadata.version");
		expect(decode("$.plugins[*].version")).toBe("$.plugins[*].version");
		expect(decode("$.plugins[0].version")).toBe("$.plugins[0].version");
	});

	it("rejects paths not starting with $.", () => {
		expect(() => decode("version")).toThrow();
		expect(() => decode(".version")).toThrow();
		expect(() => decode("$version")).toThrow();
	});

	it("rejects bare root path", () => {
		expect(() => decode("$.")).toThrow();
	});

	it("rejects non-string values", () => {
		expect(() => decode(123)).toThrow();
		expect(() => decode(null)).toThrow();
	});
});

describe("VersionFileConfigSchema (new shape)", () => {
	const decode = Schema.decodeUnknownSync(VersionFileConfigSchema);

	it("accepts config with glob and paths", () => {
		const result = decode({
			glob: "plugin.json",
			paths: ["$.version"],
		});
		expect(result.glob).toBe("plugin.json");
		expect(result.paths).toEqual(["$.version"]);
	});

	it("accepts config with glob only (paths optional)", () => {
		const result = decode({ glob: "plugin.json" });
		expect(result.glob).toBe("plugin.json");
		expect(result.paths).toBeUndefined();
	});

	it("accepts config with multiple paths", () => {
		const result = decode({
			glob: ".claude-plugin/marketplace.json",
			paths: ["$.metadata.version", "$.plugins[*].version"],
		});
		expect(result.paths).toHaveLength(2);
	});

	it("rejects empty glob", () => {
		expect(() => decode({ glob: "" })).toThrow();
	});

	it("rejects invalid JSONPath in paths", () => {
		expect(() => decode({ glob: "plugin.json", paths: ["invalid"] })).toThrow();
	});

	it("rejects missing glob", () => {
		expect(() => decode({ paths: ["$.version"] })).toThrow();
	});

	it("rejects unknown `package` field when decoded with onExcessProperty:'error'", () => {
		// The new shape intentionally omits `package`; owners come from the
		// parent `packages` record key. Under permissive decode the excess
		// property is silently dropped, so we exercise the strict path here.
		// ConfigInspector (Phase 2) decodes with this option set so misplaced
		// legacy entries surface as errors rather than data loss.
		const strict = Schema.decodeUnknownSync(VersionFileConfigSchema, { onExcessProperty: "error" });
		expect(() =>
			strict({
				glob: "plugin.json",
				paths: ["$.version"],
				package: "@savvy-web/changesets",
			}),
		).toThrow();
	});
});

describe("VersionFilesSchema (new shape — array)", () => {
	const decode = Schema.decodeUnknownSync(VersionFilesSchema);

	it("accepts an array of new-shape entries", () => {
		const result = decode([{ glob: "plugin.json", paths: ["$.version"] }, { glob: "**/manifest.json" }]);
		expect(result).toHaveLength(2);
	});

	it("accepts an empty array", () => {
		const result = decode([]);
		expect(result).toHaveLength(0);
	});

	it("rejects non-array input", () => {
		expect(() => decode("not an array")).toThrow();
		expect(() => decode({ glob: "plugin.json" })).toThrow();
	});

	it("rejects entries that include a `package` field under strict decode", () => {
		const strict = Schema.decodeUnknownSync(VersionFilesSchema, { onExcessProperty: "error" });
		expect(() => strict([{ glob: "plugin.json", package: "@savvy-web/changesets" }])).toThrow();
	});
});

describe("LegacyVersionFileConfigSchema (deprecated shape)", () => {
	const decode = Schema.decodeUnknownSync(LegacyVersionFileConfigSchema);

	it("accepts config with glob and paths", () => {
		const result = decode({
			glob: "plugin.json",
			paths: ["$.version"],
		});
		expect(result.glob).toBe("plugin.json");
		expect(result.paths).toEqual(["$.version"]);
	});

	it("accepts config with glob only", () => {
		const result = decode({ glob: "plugin.json" });
		expect(result.glob).toBe("plugin.json");
		expect(result.paths).toBeUndefined();
		expect(result.package).toBeUndefined();
	});

	it("accepts config with `package` field naming the owner inline", () => {
		const result = decode({
			glob: "plugin.json",
			paths: ["$.version"],
			package: "@savvy-web/changesets",
		});
		expect(result.package).toBe("@savvy-web/changesets");
	});

	it("accepts config without `package` field (falls back to path-based workspace resolution at runtime)", () => {
		const result = decode({ glob: "plugin.json" });
		expect(result.package).toBeUndefined();
	});

	it("rejects empty glob", () => {
		expect(() => decode({ glob: "" })).toThrow();
	});

	it("rejects invalid JSONPath in paths", () => {
		expect(() => decode({ glob: "plugin.json", paths: ["invalid"] })).toThrow();
	});

	it("rejects missing glob", () => {
		expect(() => decode({ paths: ["$.version"] })).toThrow();
	});
});

describe("LegacyVersionFilesSchema (deprecated shape — array)", () => {
	const decode = Schema.decodeUnknownSync(LegacyVersionFilesSchema);

	it("accepts an array of legacy entries", () => {
		const result = decode([
			{ glob: "plugin.json", paths: ["$.version"], package: "@savvy-web/changesets" },
			{ glob: "**/manifest.json" },
		]);
		expect(result).toHaveLength(2);
	});

	it("accepts an empty array", () => {
		const result = decode([]);
		expect(result).toHaveLength(0);
	});

	it("rejects non-array input", () => {
		expect(() => decode("not an array")).toThrow();
	});
});
