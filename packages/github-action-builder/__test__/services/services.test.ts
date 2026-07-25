/**
 * Tests for Effect services.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { AppLayer } from "../../src/layers/app.js";
import { BuildService } from "../../src/services/build.js";
import { ConfigService } from "../../src/services/config.js";
import { ValidationService } from "../../src/services/validation.js";

const testDir = resolve(process.cwd(), ".test-fixtures-services");

layer(AppLayer)("Effect Services", (it) => {
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
		it.effect("loads default config when no config file exists", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const result = yield* configService.load({ cwd: testDir });

				expect(result.usingDefaults).toBe(true);
				expect(result.config.entries.main).toBe("src/main.ts");
			}),
		);

		it.effect("loads config from file when it exists", () =>
			Effect.gen(function* () {
				writeFileSync(
					resolve(testDir, "action.config.ts"),
					`
export default {
  entries: { main: "src/custom.ts" },
  build: { minify: false },
};
`,
				);

				const configService = yield* ConfigService;
				const result = yield* configService.load({ cwd: testDir });

				expect(result.usingDefaults).toBe(false);
				expect(result.config.entries.main).toBe("src/custom.ts");
				expect(result.config.build.minify).toBe(false);
			}),
		);

		it.effect("resolves partial config with defaults", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const config = yield* configService.resolve({
					build: { minify: false },
				});

				expect(config.entries.main).toBe("src/main.ts"); // default
				expect(config.build.minify).toBe(false); // overridden
			}),
		);

		it.effect("detects entries in project", () =>
			Effect.gen(function* () {
				writeFileSync(resolve(testDir, "src/pre.ts"), "export {};");
				writeFileSync(resolve(testDir, "src/post.ts"), "export {};");

				const configService = yield* ConfigService;
				const result = yield* configService.detectEntries(testDir);

				expect(result.success).toBe(true);
				expect(result.entries).toHaveLength(3);
				expect(result.entries.map((e) => e.type).sort()).toEqual(["main", "post", "pre"]);
			}),
		);

		it.effect("fails when main entry is missing", () =>
			Effect.gen(function* () {
				rmSync(resolve(testDir, "src/main.ts"));

				const configService = yield* ConfigService;
				const error = yield* Effect.flip(configService.detectEntries(testDir));

				expect(error._tag).toBe("MainEntryMissing");
			}),
		);

		it.effect("detects worker entries when worker source files exist", () =>
			Effect.gen(function* () {
				writeFileSync(resolve(testDir, "src/turbo-server.ts"), "export {};");

				const configService = yield* ConfigService;
				const result = yield* configService.detectEntries(testDir, {
					workers: { "turbo-server": "src/turbo-server.ts" },
				});

				expect(result.success).toBe(true);
				const workerEntry = result.entries.find((e) => e.type === "turbo-server");
				expect(workerEntry).toBeDefined();
				expect(workerEntry?.output).toBe("dist/turbo-server.js");
			}),
		);

		it.effect("fails with WorkerEntryMissing when a worker source file does not exist", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const error = yield* Effect.flip(
					configService.detectEntries(testDir, {
						workers: { "turbo-server": "src/turbo-server.ts" },
					}),
				);

				expect(error._tag).toBe("WorkerEntryMissing");
				expect((error as { workerName: string }).workerName).toBe("turbo-server");
			}),
		);

		it.effect("fails with WorkerEntryInvalidName for a reserved lifecycle worker name", () =>
			Effect.gen(function* () {
				writeFileSync(resolve(testDir, "src/main-worker.ts"), "export {};");

				const configService = yield* ConfigService;
				const error = yield* Effect.flip(
					configService.detectEntries(testDir, {
						workers: { main: "src/main-worker.ts" },
					}),
				);

				expect(error._tag).toBe("WorkerEntryInvalidName");
				expect((error as { workerName: string }).workerName).toBe("main");
			}),
		);

		it.effect("fails with WorkerEntryInvalidName for a path-unsafe worker name", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const error = yield* Effect.flip(
					configService.detectEntries(testDir, {
						workers: { "../escape": "src/escape.ts" },
					}),
				);

				expect(error._tag).toBe("WorkerEntryInvalidName");
			}),
		);
	});

	describe("ValidationService", () => {
		it.effect("validates valid project structure", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });

				expect(result.valid).toBe(true);
				expect(result.errors).toHaveLength(0);
			}),
		);

		it.effect("returns warning when action.yml is missing", () =>
			Effect.gen(function* () {
				rmSync(resolve(testDir, "action.yml"));

				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });

				// Should have warning about missing action.yml
				expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
			}),
		);

		it.effect("formats validation result", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Explicitly disable strict mode for predictable test behavior
				const result = yield* validationService.validate(config, { cwd: testDir, strict: false });
				const formatted = validationService.formatResult(result);

				expect(typeof formatted).toBe("string");
				// Format includes either "passed" for valid results or warnings/errors
				expect(formatted.length).toBeGreaterThan(0);
				if (result.valid && result.warnings.length === 0) {
					expect(formatted).toContain("passed");
				}
			}),
		);

		it.effect("fails with ValidationFailed in strict mode when warnings exist", () =>
			Effect.gen(function* () {
				rmSync(resolve(testDir, "action.yml"));

				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;

				const { config } = yield* configService.load({ cwd: testDir });
				// Enable strict mode - warnings should become errors
				const error = yield* Effect.flip(validationService.validate(config, { cwd: testDir, strict: true }));

				expect(error._tag).toBe("ValidationFailed");
			}),
		);

		it.effect("isStrict returns correct value based on config", () =>
			Effect.gen(function* () {
				const validationService = yield* ValidationService;
				const explicitTrue = yield* validationService.isStrict(true);
				const explicitFalse = yield* validationService.isStrict(false);

				expect(explicitTrue).toBe(true);
				expect(explicitFalse).toBe(false);
			}),
		);
	});

	describe("BuildService", () => {
		it.effect("provides formatResult method", () =>
			Effect.gen(function* () {
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
				const formatted = buildService.formatResult(mockResult);

				expect(typeof formatted).toBe("string");
				expect(formatted).toContain("Build");
			}),
		);
	});

	describe("Layer Composition", () => {
		it.effect("AppLayer provides all services", () =>
			Effect.gen(function* () {
				const configService = yield* ConfigService;
				const validationService = yield* ValidationService;
				const buildService = yield* BuildService;

				expect(typeof configService.load).toBe("function");
				expect(typeof validationService.validate).toBe("function");
				expect(typeof buildService.build).toBe("function");
			}),
		);
	});
});

layer(AppLayer)("BuildService.formatBytes", (it) => {
	it.effect("formats bytes", () =>
		Effect.gen(function* () {
			const buildService = yield* BuildService;
			expect(buildService.formatBytes(500)).toBe("500 B");
		}),
	);

	it.effect("formats kilobytes", () =>
		Effect.gen(function* () {
			const buildService = yield* BuildService;
			expect(buildService.formatBytes(1024)).toBe("1.0 KB");
			expect(buildService.formatBytes(1536)).toBe("1.5 KB");
		}),
	);

	it.effect("formats megabytes", () =>
		Effect.gen(function* () {
			const buildService = yield* BuildService;
			expect(buildService.formatBytes(1024 * 1024)).toBe("1.0 MB");
			expect(buildService.formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
		}),
	);
});
