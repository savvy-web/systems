import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, FileSystem, Layer } from "effect";
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

// Per-test provide is REQUIRED here, not an unoptimised leftover: the layer closes over the
// caller's `files` record, so each test (and each call within a test) needs its own build.
// Hoisting this into a suite-boundary `layer(...)` block would memoise one filesystem across
// every test and silently share mutable state between them.
function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.provide(effect, layer);
}

describe("lint-staged consumer workflow", () => {
	const LintSection = ShellSectionDefinition.make({ toolName: "SAVVY-LINT" });

	const preCommitBlock = LintSection.generate(
		(cfg: { configPath: string }) =>
			`# Skip in CI\nif ! { [ -n "$CI" ]; }; then\nlint-staged --config "$ROOT/${cfg.configPath}"\nfi`,
	);

	const shellScriptsBlock = LintSection.generate(
		(_cfg?: undefined) => `# Skip in CI\nif ! { [ -n "$CI" ]; }; then\ngit config core.fileMode false\nfi`,
	);

	it.effect("init workflow: sync creates hooks", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const section = yield* runWith(
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
		}),
	);

	it.effect("init workflow: sync is idempotent", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
				}),
			);

			const result = yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					return yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
				}),
			);

			expect(result._tag).toBe("Unchanged");
		}),
	);

	it.effect("check workflow: detects up-to-date hook", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "lib/cfg.ts" }));
				}),
			);

			const result = yield* runWith(
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
		}),
	);

	it.effect("check workflow: detects outdated hook", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					yield* s.sync(".husky/pre-commit", preCommitBlock({ configPath: "old/path.ts" }));
				}),
			);

			const result = yield* runWith(
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
		}),
	);

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
