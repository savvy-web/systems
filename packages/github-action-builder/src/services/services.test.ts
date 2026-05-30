/**
 * Tests for Effect services.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppLayer } from "../layers/app.js";
import { BuildService } from "./build.js";
import { ConfigService } from "./config.js";
import { ValidationService } from "./validation.js";

describe("Effect Services", () => {
	const testDir = resolve(process.cwd(), ".test-fixtures-services");

	beforeEach(() => {
		mkdirSync(resolve(testDir, "src"), { recursive: true });
		writeFileSync(
			resolve(testDir, "src/main.ts"),
			`
import * as core from "@actions/core";
core.info("Hello from main");
`,
		);
		writeFileSync(
			resolve(testDir, "action.yml"),
			`
name: "Test Action"
description: "A test action"
runs:
  using: "node24"
  main: "dist/main/index.js"
`,
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("ConfigService", () => {
		it("loads default config when no config file exists", async () => {
			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const result = yield* configService.load({ cwd: testDir });
				return result;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.usingDefaults).toBe(true);
			expect(result.config.entries.main).toBe("src/main.ts");
		});

		it("loads config from file when it exists", async () => {
			writeFileSync(
				resolve(testDir, "action.config.ts"),
				`
export default {
  entries: { main: "src/custom.ts" },
  build: { minify: false },
};
`,
			);

			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const result = yield* configService.load({ cwd: testDir });
				return result;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.usingDefaults).toBe(false);
			expect(result.config.entries.main).toBe("src/custom.ts");
			expect(result.config.build.minify).toBe(false);
		});

		it("resolves partial config with defaults", async () => {
			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const config = yield* configService.resolve({
					build: { minify: false },
				});
				return config;
			});

			const config = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(config.entries.main).toBe("src/main.ts"); // default
			expect(config.build.minify).toBe(false); // overridden
		});

		it("detects entries in project", async () => {
			writeFileSync(resolve(testDir, "src/pre.ts"), "export {};");
			writeFileSync(resolve(testDir, "src/post.ts"), "export {};");

			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const result = yield* configService.detectEntries(testDir);
				return result;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.success).toBe(true);
			expect(result.entries).toHaveLength(3);
			expect(result.entries.map((e) => e.type).sort()).toEqual(["main", "post", "pre"]);
		});

		it("fails when main entry is missing", async () => {
			rmSync(resolve(testDir, "src/main.ts"));

			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const result = yield* configService.detectEntries(testDir);
				return result;
			}).pipe(
				Effect.either, // Convert to Either to catch errors
			);

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			// Either Left means failure, Right means success
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("MainEntryMissing");
			} else {
				// If detectEntries returns a result object instead of failing
				expect(result.right.success).toBe(false);
			}
		});
	});

	describe("ValidationService", () => {
		it("validates valid project structure", async () => {
			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });
				return result;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("returns warning when action.yml is missing", async () => {
			rmSync(resolve(testDir, "action.yml"));

			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });
				return result;
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			// Should have warning about missing action.yml
			expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
		});

		it("formats validation result", async () => {
			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });
				const formatted = validationService.formatResult(result);
				return { formatted, result };
			});

			const { formatted, result } = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(typeof formatted).toBe("string");
			// Format includes either "passed" for valid results or warnings/errors
			expect(formatted.length).toBeGreaterThan(0);
			if (result.valid && result.warnings.length === 0) {
				expect(formatted).toContain("passed");
			}
		});

		it("fails with ValidationFailed in strict mode when warnings exist", async () => {
			rmSync(resolve(testDir, "action.yml"));

			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Enable strict mode - warnings should become errors
				const result = yield* validationService.validate(config, { cwd: testDir, strict: true });
				return result;
			}).pipe(Effect.either);

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			// In strict mode with warnings, should fail with ValidationFailed
			expect(result._tag).toBe("Left");
			if (result._tag === "Left") {
				expect(result.left._tag).toBe("ValidationFailed");
			}
		});

		it("isStrict returns correct value based on config", async () => {
			const program = Effect.gen(function* () {
				const validationService = yield* ValidationService;
				const explicitTrue = yield* validationService.isStrict(true);
				const explicitFalse = yield* validationService.isStrict(false);
				return { explicitTrue, explicitFalse };
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.explicitTrue).toBe(true);
			expect(result.explicitFalse).toBe(false);
		});
	});

	describe("BuildService", () => {
		it("provides formatResult method", async () => {
			const program = Effect.gen(function* () {
				const buildService = yield* BuildService;
				const mockResult = {
					success: true,
					entries: [
						{
							success: true,
							stats: {
								entry: "main",
								size: 1024,
								duration: 100,
								outputPath: "dist/main/index.js",
							},
						},
					],
					duration: 100,
				};
				return buildService.formatResult(mockResult);
			});

			const formatted = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(typeof formatted).toBe("string");
			expect(formatted).toContain("Build");
		});
	});

	describe("Layer Composition", () => {
		it("AppLayer provides all services", async () => {
			const program = Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;
				const buildService = yield* BuildService;

				return {
					hasConfig: typeof configService.load === "function",
					hasValidation: typeof validationService.validate === "function",
					hasBuild: typeof buildService.build === "function",
				};
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));

			expect(result.hasConfig).toBe(true);
			expect(result.hasValidation).toBe(true);
			expect(result.hasBuild).toBe(true);
		});
	});
});

describe("BuildService.formatBytes", () => {
	it("formats bytes", async () => {
		const program = Effect.gen(function* () {
			const buildService = yield* BuildService;
			return buildService.formatBytes(500);
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result).toBe("500 B");
	});

	it("formats kilobytes", async () => {
		const program = Effect.gen(function* () {
			const buildService = yield* BuildService;
			return {
				kb: buildService.formatBytes(1024),
				kb15: buildService.formatBytes(1536),
			};
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result.kb).toBe("1.0 KB");
		expect(result.kb15).toBe("1.5 KB");
	});

	it("formats megabytes", async () => {
		const program = Effect.gen(function* () {
			const buildService = yield* BuildService;
			return {
				mb: buildService.formatBytes(1024 * 1024),
				mb15: buildService.formatBytes(1.5 * 1024 * 1024),
			};
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
		expect(result.mb).toBe("1.0 MB");
		expect(result.mb15).toBe("1.5 MB");
	});
});
