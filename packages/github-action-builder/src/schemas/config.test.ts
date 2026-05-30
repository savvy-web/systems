/**
 * Tests for Effect Schema structs.
 */
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	BuildOptionsSchema,
	ConfigInputSchema,
	ConfigSchema,
	EntriesSchema,
	PersistLocalOptionsSchema,
	ValidationOptionsSchema,
	defineConfig,
} from "./config.js";

describe("Entries Schema", () => {
	it("applies defaults when decoding empty object", () => {
		const entries = Schema.decodeUnknownSync(EntriesSchema)({});
		expect(entries.main).toBe("src/main.ts");
		expect(entries.pre).toBeUndefined();
		expect(entries.post).toBeUndefined();
	});

	it("accepts custom main entry", () => {
		const entries = Schema.decodeUnknownSync(EntriesSchema)({ main: "src/action.ts" });
		expect(entries.main).toBe("src/action.ts");
	});

	it("accepts all entry types", () => {
		const entries = Schema.decodeUnknownSync(EntriesSchema)({
			main: "src/main.ts",
			pre: "src/pre.ts",
			post: "src/post.ts",
		});
		expect(entries.main).toBe("src/main.ts");
		expect(entries.pre).toBe("src/pre.ts");
		expect(entries.post).toBe("src/post.ts");
	});

	it("decodes from plain object", () => {
		const decoded = Schema.decodeUnknownSync(EntriesSchema)({
			main: "src/custom.ts",
		});
		expect(decoded.main).toBe("src/custom.ts");
	});
});

describe("BuildOptions Schema", () => {
	it("applies defaults when decoding empty object", () => {
		const options = Schema.decodeUnknownSync(BuildOptionsSchema)({});
		expect(options.minify).toBe(true);
		expect(options.sourceMap).toBe(false);
		expect(options.externals).toEqual([]);
	});

	it("accepts custom options", () => {
		const options = Schema.decodeUnknownSync(BuildOptionsSchema)({
			minify: false,
			sourceMap: true,
			externals: ["@aws-sdk/client-s3"],
		});
		expect(options.minify).toBe(false);
		expect(options.sourceMap).toBe(true);
		expect(options.externals).toEqual(["@aws-sdk/client-s3"]);
	});

	it("decodes from plain object", () => {
		const decoded = Schema.decodeUnknownSync(BuildOptionsSchema)({
			minify: false,
		});
		expect(decoded.minify).toBe(false);
	});

	it("defaults ignore to an empty array", () => {
		const options = Schema.decodeUnknownSync(BuildOptionsSchema)({});
		expect(options.ignore).toEqual([]);
	});

	it("accepts an ignore list", () => {
		const options = Schema.decodeUnknownSync(BuildOptionsSchema)({
			ignore: ["libxmljs2"],
		});
		expect(options.ignore).toEqual(["libxmljs2"]);
	});
});

describe("ValidationOptions Schema", () => {
	it("applies defaults when decoding empty object", () => {
		const options = Schema.decodeUnknownSync(ValidationOptionsSchema)({});
		expect(options.requireActionYml).toBe(true);
		expect(options.maxBundleSize).toBeUndefined();
		expect(options.strict).toBeUndefined();
	});

	it("accepts custom options", () => {
		const options = Schema.decodeUnknownSync(ValidationOptionsSchema)({
			requireActionYml: false,
			maxBundleSize: "5mb",
			strict: true,
		});
		expect(options.requireActionYml).toBe(false);
		expect(options.maxBundleSize).toBe("5mb");
		expect(options.strict).toBe(true);
	});
});

describe("PersistLocalOptions Schema", () => {
	it("applies defaults when decoding empty object", () => {
		const options = Schema.decodeUnknownSync(PersistLocalOptionsSchema)({});
		expect(options.enabled).toBe(true);
		expect(options.path).toBe(".github/actions/local");
		expect(options.actTemplate).toBe(true);
	});

	it("accepts custom options", () => {
		const options = Schema.decodeUnknownSync(PersistLocalOptionsSchema)({
			enabled: false,
			path: ".github/actions/custom",
			actTemplate: false,
		});
		expect(options.enabled).toBe(false);
		expect(options.path).toBe(".github/actions/custom");
		expect(options.actTemplate).toBe(false);
	});
});

describe("ConfigInput Schema", () => {
	it("accepts empty object with all optional fields", () => {
		const input = Schema.decodeUnknownSync(ConfigInputSchema)({});
		expect(input.entries).toBeUndefined();
		expect(input.build).toBeUndefined();
		expect(input.validation).toBeUndefined();
	});

	it("accepts partial configuration", () => {
		const input = Schema.decodeUnknownSync(ConfigInputSchema)({
			entries: { main: "src/action.ts" },
			build: { minify: false },
		});
		expect(input.entries?.main).toBe("src/action.ts");
		expect(input.build?.minify).toBe(false);
	});

	it("decodes from plain object", () => {
		const decoded = Schema.decodeUnknownSync(ConfigInputSchema)({
			entries: { main: "custom.ts", pre: "pre.ts" },
			build: { minify: false },
		});
		expect(decoded.entries?.main).toBe("custom.ts");
		expect(decoded.entries?.pre).toBe("pre.ts");
		expect(decoded.build?.minify).toBe(false);
	});

	it("accepts build.ignore", () => {
		const input = Schema.decodeUnknownSync(ConfigInputSchema)({
			build: { ignore: ["libxmljs2"] },
		});
		expect(input.build?.ignore).toEqual(["libxmljs2"]);
	});
});

describe("Config Schema", () => {
	it("decodes with nested schemas applying defaults", () => {
		const config = Schema.decodeUnknownSync(ConfigSchema)({
			entries: {},
			build: {},
			validation: {},
			persistLocal: {},
		});
		expect(config.entries.main).toBe("src/main.ts");
		expect(config.build.minify).toBe(true);
		expect(config.validation.requireActionYml).toBe(true);
		expect(config.persistLocal.enabled).toBe(true);
		expect(config.persistLocal.path).toBe(".github/actions/local");
		expect(config.persistLocal.actTemplate).toBe(true);
	});
});

describe("defineConfig", () => {
	it("returns fully resolved config with defaults", () => {
		const config = defineConfig({});
		expect(config.entries).toBeDefined();
		expect(config.build).toBeDefined();
		expect(config.validation).toBeDefined();
		expect(config.persistLocal).toBeDefined();
		expect(config.entries.main).toBe("src/main.ts");
		expect(config.build.minify).toBe(true);
		expect(config.validation.requireActionYml).toBe(true);
		expect(config.persistLocal.enabled).toBe(true);
		expect(config.persistLocal.path).toBe(".github/actions/local");
		expect(config.persistLocal.actTemplate).toBe(true);
	});

	it("merges partial config with defaults", () => {
		const config = defineConfig({
			entries: { main: "src/action.ts" },
			build: { minify: false },
		});
		expect(config.entries.main).toBe("src/action.ts");
		expect(config.entries.pre).toBeUndefined();
		expect(config.build.minify).toBe(false);
	});

	it("handles all entry types", () => {
		const config = defineConfig({
			entries: {
				main: "src/main.ts",
				pre: "src/setup.ts",
				post: "src/cleanup.ts",
			},
		});
		expect(config.entries.main).toBe("src/main.ts");
		expect(config.entries.pre).toBe("src/setup.ts");
		expect(config.entries.post).toBe("src/cleanup.ts");
	});

	it("handles all build options", () => {
		const config = defineConfig({
			entries: { main: "src/action.ts", pre: "src/pre.ts", post: "src/post.ts" },
			build: {
				minify: false,
				sourceMap: true,
				externals: ["some-external"],
			},
			validation: { requireActionYml: false, maxBundleSize: "5mb", strict: true },
		});
		expect(config.build.minify).toBe(false);
		expect(config.build.sourceMap).toBe(true);
		expect(config.build.externals).toEqual(["some-external"]);
	});

	it("handles all validation options", () => {
		const config = defineConfig({
			validation: {
				requireActionYml: false,
				maxBundleSize: "10mb",
				strict: true,
			},
		});
		expect(config.validation.requireActionYml).toBe(false);
		expect(config.validation.maxBundleSize).toBe("10mb");
		expect(config.validation.strict).toBe(true);
	});

	it("handles all persistLocal options", () => {
		const config = defineConfig({
			persistLocal: {
				enabled: false,
				path: ".github/actions/custom",
				actTemplate: false,
			},
		});
		expect(config.persistLocal.enabled).toBe(false);
		expect(config.persistLocal.path).toBe(".github/actions/custom");
		expect(config.persistLocal.actTemplate).toBe(false);
	});
});
