import { FileSystem } from "@effect/platform";
import { Effect, Equal, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ShellSectionDefinition } from "../../src/schemas/SectionDefinition.js";
import { ManagedSection, ManagedSectionLive } from "../../src/services/ManagedSection.js";

const makeTestFs = (files: Record<string, string>) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: (path: string) => Effect.succeed(path in files),
		readFileString: (path: string) =>
			path in files ? Effect.succeed(files[path]) : Effect.fail(new Error(`ENOENT: ${path}`)),
		writeFileString: (path: string, content: string) =>
			Effect.sync(() => {
				files[path] = content;
			}),
	} as unknown as FileSystem.FileSystem);

function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.runPromise(Effect.provide(effect, layer));
}

describe("lint-staged consumer workflow", () => {
	const LintSection = ShellSectionDefinition.make({ toolName: "SAVVY-LINT" });

	const preCommitBlock = LintSection.generate(
		(cfg: { configPath: string }) =>
			`\n# Skip in CI\nif ! { [ -n "$CI" ]; }; then\nlint-staged --config "$ROOT/${cfg.configPath}"\nfi\n`,
	);

	const shellScriptsBlock = LintSection.generate(
		(_cfg?: undefined) => `\n# Skip in CI\nif ! { [ -n "$CI" ]; }; then\ngit config core.fileMode false\nfi\n`,
	);

	it("init workflow: sync creates hooks", async () => {
		const files: Record<string, string> = {};
		const section = await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				const r1 = yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/lint-staged.config.ts" }));
				const r2 = yield* s.sync(".husky/post-checkout", shellScriptsBlock(undefined));
				return { r1, r2 };
			}),
		);

		expect(section.r1._tag).toBe("Created");
		expect(section.r2._tag).toBe("Created");
		expect(files[".husky/pre-commit"]).toContain("lint-staged");
		expect(files[".husky/post-checkout"]).toContain("core.fileMode");
	});

	it("init workflow: sync is idempotent", async () => {
		const files: Record<string, string> = {};
		await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
			}),
		);

		const result = await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				return yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
			}),
		);

		expect(result._tag).toBe("Unchanged");
	});

	it("check workflow: detects up-to-date hook", async () => {
		const files: Record<string, string> = {};
		await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
			}),
		);

		const result = await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				return yield* s.check(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
			}),
		);

		expect(result._tag).toBe("Found");
		if (result._tag === "Found") {
			expect(result.isUpToDate).toBe(true);
		}
	});

	it("check workflow: detects outdated hook", async () => {
		const files: Record<string, string> = {};
		await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "old/path.ts" }));
			}),
		);

		const result = await runWith(
			files,
			Effect.gen(function* () {
				const s = yield* ManagedSection;
				return yield* s.check(".husky/pre-commit", preCommitBlock({ configPath: "new/path.ts" }));
			}),
		);

		expect(result._tag).toBe("Found");
		if (result._tag === "Found") {
			expect(result.isUpToDate).toBe(false);
			expect(result.diff._tag).toBe("Changed");
		}
	});

	it("Equal.equals works between blocks from same definition", () => {
		const a = preCommitBlock({ configPath: "lib/cfg.ts" });
		const b = preCommitBlock({ configPath: "lib/cfg.ts" });
		expect(Equal.equals(a, b)).toBe(true);
	});

	it("Equal.equals detects different config", () => {
		const a = preCommitBlock({ configPath: "lib/a.ts" });
		const b = preCommitBlock({ configPath: "lib/b.ts" });
		expect(Equal.equals(a, b)).toBe(false);
	});
});
