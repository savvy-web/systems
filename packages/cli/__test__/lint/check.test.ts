import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Workspaces } from "@effected/workspaces";
import {
	BiomeSchemaSyncLive,
	ConfigDiscoveryLive,
	ManagedSectionLive,
	ToolDiscoveryLive,
} from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WorkspacesKitLive = Workspaces.layer();

import { runLintCheck } from "../../src/commands/lint/check.js";
import { runLintInit } from "../../src/commands/lint/init.js";

const SilkLive = Layer.mergeAll(ManagedSectionLive, BiomeSchemaSyncLive, ConfigDiscoveryLive, ToolDiscoveryLive);
const BaseAppLayer = SilkLive.pipe(Layer.provideMerge(WorkspacesKitLive), Layer.provideMerge(NodeServices.layer));

/** Build a TestLayer that captures every Effect.log line into `sink` (replaces the default logger). */
function captureLayer(sink: string[]) {
	const captureLogger = Logger.make(({ message }) => {
		const text = Array.isArray(message) ? message.join(" ") : String(message);
		sink.push(text);
	});
	return Layer.provideMerge(BaseAppLayer, Logger.layer([captureLogger]));
}

/** Bootstrap a workspace root + leaf package so workspaces-effect resolves cleanly. */
function bootstrapWorkspace(dir: string) {
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({
			name: "scratch-root",
			version: "0.0.0",
			packageManager: "pnpm@10.0.0",
			workspaces: ["package"],
		}),
	);
	mkdirSync(join(dir, "package"), { recursive: true });
	writeFileSync(join(dir, "package/package.json"), JSON.stringify({ name: "scratch-pkg", version: "0.0.0" }));
}

const BEGIN_LINT = "# --- BEGIN SAVVY-LINT MANAGED SECTION ---";
const END_LINT = "# --- END SAVVY-LINT MANAGED SECTION ---";

const LEGACY_PRE_COMMIT = `#!/usr/bin/env sh
# Legacy pre-commit (single SAVVY-LINT section, no SAVVY-BASE)

${BEGIN_LINT}
# DO NOT EDIT between these markers - managed by savvy-lint
if ! { [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; }; then
ROOT=$(git rev-parse --show-toplevel)
PM=pnpm
case "$PM" in
  pnpm) pnpm exec lint-staged --config "$ROOT/lint-staged.config.ts" ;;
  bun)  bunx lint-staged --config "$ROOT/lint-staged.config.ts" ;;
esac
fi
${END_LINT}
`;

describe("runLintCheck", () => {
	let testDir: string;
	let originalCwd: string;
	let logs: string[];

	beforeEach(() => {
		originalCwd = process.cwd();
		testDir = join(
			tmpdir(),
			`lint-staged-check-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);
		bootstrapWorkspace(testDir);
		logs = [];
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(testDir, { recursive: true, force: true });
	});

	async function runCheck(quiet: boolean) {
		const handler = runLintCheck({ quiet });
		await Effect.runPromise(Effect.provide(handler, captureLayer(logs)));
	}

	async function runInit(preset: "minimal" | "standard" | "silk", config = "lint-staged.config.ts") {
		const handler = runLintInit({ force: false, config, preset });
		await Effect.runPromise(Effect.provide(handler, captureLayer([])));
	}

	it("reports an overall PASS verdict when init was just run with silk preset", async () => {
		await runInit("silk");
		await runCheck(false);

		expect(logs.some((l) => l.includes("Lint-staged is configured correctly"))).toBe(true);
		expect(logs.some((l) => l.includes("Some issues found"))).toBe(false);
		expect(logs.some((l) => l.includes("Base section: up-to-date"))).toBe(true);
		expect(logs.some((l) => l.includes("Lint section: up-to-date"))).toBe(true);
	});

	it("degrades the verdict when pre-commit has only a legacy SAVVY-LINT section (no SAVVY-BASE)", async () => {
		// Pre-commit only — no hygiene hooks and no config file (those would trigger their own
		// warnings); the assertion focuses on section health, so write the config to silence that branch.
		mkdirSync(join(testDir, ".husky"), { recursive: true });
		writeFileSync(join(testDir, ".husky/pre-commit"), LEGACY_PRE_COMMIT);
		writeFileSync(join(testDir, "lint-staged.config.ts"), "export default {};\n");

		await runCheck(false);

		// SAVVY-BASE never installed → base section is missing → verdict degraded.
		expect(logs.some((l) => l.includes("Base section: not found"))).toBe(true);
		expect(logs.some((l) => l.includes("Some issues found"))).toBe(true);
		expect(logs.some((l) => l.includes("Lint-staged is configured correctly"))).toBe(false);
	});

	it("degrades the verdict when the savvy-lint section content is outdated", async () => {
		await runInit("silk");
		// Corrupt only the savvy-lint section body so the SAVVY-LINT marker still resolves
		// but the content no longer matches the expected one-liner.
		const preCommit = readFileSync(join(testDir, ".husky/pre-commit"), "utf8");
		const tampered = preCommit.replace(
			'in_ci || pm_exec lint-staged --config "$ROOT/lint-staged.config.ts"',
			'in_ci || pm_exec lint-staged-CORRUPTED --config "$ROOT/lint-staged.config.ts"',
		);
		writeFileSync(join(testDir, ".husky/pre-commit"), tampered);

		logs.length = 0;
		await runCheck(false);

		expect(logs.some((l) => l.includes("Lint section: outdated"))).toBe(true);
		expect(logs.some((l) => l.includes("Some issues found"))).toBe(true);
		expect(logs.some((l) => l.includes("Lint-staged is configured correctly"))).toBe(false);
	});

	it("passes with a clean verdict under the minimal preset (no hygiene hooks installed)", async () => {
		await runInit("minimal");

		// Minimal preset writes pre-commit only — no post-checkout, post-merge, or post-commit.
		expect(() => readFileSync(join(testDir, ".husky/post-checkout"), "utf8")).toThrow();
		expect(() => readFileSync(join(testDir, ".husky/post-merge"), "utf8")).toThrow();
		expect(() => readFileSync(join(testDir, ".husky/post-commit"), "utf8")).toThrow();

		await runCheck(false);

		// A missing hygiene hook FILE does not degrade sectionsHealthy — this locks in the
		// preset-agnostic behavior. The overall verdict still passes.
		expect(logs.some((l) => l.includes("Lint-staged is configured correctly"))).toBe(true);
		expect(logs.some((l) => l.includes("Some issues found"))).toBe(false);
	});

	it("emits no warnings in quiet mode when everything is up-to-date", async () => {
		await runInit("silk");
		logs.length = 0;
		await runCheck(true);

		// In quiet mode, only warnings are printed. A clean install should print nothing.
		const warningLines = logs.filter((l) => l.includes("⚠"));
		expect(warningLines).toEqual([]);
	});

	it("emits exactly the section warnings in quiet mode when pre-commit is missing", async () => {
		// No init — no .husky/ at all. Quiet mode should warn about the missing hook.
		await runCheck(true);

		expect(logs.some((l) => l.includes("No husky pre-commit hook found"))).toBe(true);
		expect(logs.some((l) => l.includes("No lint-staged config file found"))).toBe(true);
	});
});
