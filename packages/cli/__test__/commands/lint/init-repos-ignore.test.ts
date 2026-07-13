import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { BiomeSchemaSyncLive, Lint, ManagedSectionLive } from "@savvy-web/silk-effects";
import { Effect, Layer, LogLevel, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runLintInit } from "../../../src/commands/lint/init.js";

const TestLayer = Layer.provideMerge(Layer.merge(ManagedSectionLive, BiomeSchemaSyncLive), NodeFileSystem.layer).pipe(
	Layer.provide(Logger.minimumLogLevel(LogLevel.None)),
);

describe("runLintInit: .repos ignore propagation", () => {
	let testDir: string;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(
			tmpdir(),
			`lint-staged-init-repos-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	it("adds the missing **/.repos ignore to an existing config while leaving other entries untouched", async () => {
		// Existing config predates the .repos exclusion: it carries the other
		// default ignores plus a user-added entry, but not "**/.repos".
		const existing = {
			...Lint.MARKDOWNLINT_TEMPLATE,
			ignores: [
				"**/.git",
				"**/node_modules",
				"**/.cache",
				"**/coverage",
				"**/.coverage",
				"**/dist",
				"**/CHANGELOG.md",
				"**/.claude/plans",
				"**/docs/superpowers",
				"**/__test__/**/fixtures/**",
				"**/__fixtures__/**",
				"**/my-vendor",
			],
		};
		mkdirSync(join(testDir, "lib/configs"), { recursive: true });
		writeFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), `${JSON.stringify(existing, null, "\t")}\n`);

		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const merged = JSON.parse(readFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), "utf8"));

		// The new .repos exclusion is appended via the template union-merge.
		expect(merged.ignores).toContain("**/.repos");
		// Every pre-existing entry, including the user-added one, survives untouched.
		for (const glob of existing.ignores) {
			expect(merged.ignores).toContain(glob);
		}
		// No duplicates introduced.
		expect(merged.ignores.filter((g: string) => g === "**/.repos")).toHaveLength(1);
	});

	it("is idempotent when the config already contains **/.repos: it appears exactly once and other entries survive", async () => {
		const existing = {
			...Lint.MARKDOWNLINT_TEMPLATE,
			ignores: ["**/.git", "**/node_modules", "**/.repos", "**/dist", "**/my-vendor"],
		};
		mkdirSync(join(testDir, "lib/configs"), { recursive: true });
		writeFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), `${JSON.stringify(existing, null, "\t")}\n`);

		const handler = runLintInit({
			force: false,
			config: "lint-staged.config.ts",
			preset: "silk",
		});
		await Effect.runPromise(Effect.provide(handler, TestLayer));

		const merged = JSON.parse(readFileSync(join(testDir, Lint.MARKDOWNLINT_CONFIG_PATH), "utf8"));

		// The pre-existing .repos entry is not duplicated.
		expect(merged.ignores.filter((g: string) => g === "**/.repos")).toHaveLength(1);
		// Every pre-existing entry, including the user-added one, survives.
		for (const glob of existing.ignores) {
			expect(merged.ignores).toContain(glob);
		}
	});
});
