import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import type { ValidationInput } from "../../src/config-validation/ConfigValidator.js";
import { ConfigValidator } from "../../src/config-validation/ConfigValidator.js";
import { ConfigValidatorLive } from "../../src/config-validation/ConfigValidatorLive.js";

const run = (input: ValidationInput) =>
	Effect.runPromiseExit(
		Effect.flatMap(ConfigValidator, (v) => v.validate(input)).pipe(Effect.provide(ConfigValidatorLive)),
	);

const ok: ValidationInput = { baseName: "pkg", hasExports: true };

describe("ConfigValidator", () => {
	it("passes a minimal valid config", async () => {
		const exit = await run({ ...ok });
		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("fails a dangling `from` target", async () => {
		const exit = await run({ ...ok, targets: { a: { from: "nope", registry: "https://r" } } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails a from+name collision", async () => {
		const exit = await run({
			...ok,
			targets: { npm: true, a: { from: "npm", name: "@s/x", registry: "https://r" } },
		});
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails a custom target key with no registry", async () => {
		const exit = await run({ ...ok, targets: { custom: { name: "@s/x" } } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails an exe config with no fileName", async () => {
		const exit = await run({ ...ok, exe: { fileName: "" }, osCpu: { os: ["darwin"], cpu: ["arm64"] } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails an exe config whose targets are empty after os/cpu inference", async () => {
		const exit = await run({ ...ok, exe: { fileName: "tool" }, osCpu: { os: [], cpu: [] } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails a meta tagDefinition with an invalid syntaxKind", async () => {
		const exit = await run({
			...ok,
			meta: { tsdoc: { tagDefinitions: [{ tagName: "@x", syntaxKind: "bogus" as never }] } },
		});
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails when a package without exports asks to emit a model", async () => {
		const exit = await run({ baseName: "pkg", hasExports: false, meta: { localPaths: ["x"] } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("passes valid looseFiles", async () => {
		const exit = await run({ ...ok, looseFiles: { "pnpmfile.mjs": "./src/pnpmfile.ts" } });
		expect(Exit.isSuccess(exit)).toBe(true);
	});

	it("fails looseFiles with an ambiguous .js key and no explicit format", async () => {
		const exit = await run({ ...ok, looseFiles: { "thing.js": "./src/thing.ts" } });
		expect(Exit.isFailure(exit)).toBe(true);
	});

	it("fails looseFiles with a format that contradicts the extension", async () => {
		const exit = await run({ ...ok, looseFiles: { "pnpmfile.mjs": { source: "./s.ts", format: "cjs" } } });
		expect(Exit.isFailure(exit)).toBe(true);
	});
});
