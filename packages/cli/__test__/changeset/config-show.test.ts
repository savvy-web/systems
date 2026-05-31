import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspacesLive } from "workspaces-effect";

import { renderHuman, runConfigShow } from "../../src/commands/changeset/commands/config-show.js";

const { ConfigInspectorLive } = Changesets;

const TestLive = ConfigInspectorLive.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspacesLive)),
	Layer.provide(NodeContext.layer),
);

const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

function setupFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "cs-cli-show-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "root", version: "1.0.0", private: true }));
	writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n");
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, ".changeset"), { recursive: true });
	writeFileSync(
		join(dir, ".changeset", "config.json"),
		JSON.stringify(
			{
				changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo" }],
				baseBranch: "main",
				access: "restricted",
			},
			null,
			2,
		),
	);
	return dir;
}

describe("config show – runConfigShow handler", () => {
	let dir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		dir = setupFixture();
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		process.exitCode = savedExitCode;
	});

	it("succeeds with valid config and json=false", async () => {
		await Effect.runPromise(runConfigShow(dir, false).pipe(Effect.provide(TestLive), Effect.provide(silentLogger)));
		expect(process.exitCode).toBeUndefined();
	});

	it("succeeds with valid config and json=true", async () => {
		await Effect.runPromise(runConfigShow(dir, true).pipe(Effect.provide(TestLive), Effect.provide(silentLogger)));
		expect(process.exitCode).toBeUndefined();
	});

	it("sets exitCode=1 on ConfigurationError (bad config)", async () => {
		// Overwrite the config to declare an unknown package in `packages`.
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			JSON.stringify(
				{
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/ghost": {} } }],
					baseBranch: "main",
				},
				null,
				2,
			),
		);
		await Effect.runPromise(
			runConfigShow(dir, false).pipe(Effect.provide(TestLive), Effect.provide(silentLogger), Effect.ignore),
		);
		expect(process.exitCode).toBe(1);
	});
});

describe("renderHuman", () => {
	const baseCfg = {
		configPath: "/p/.changeset/config.json",
		projectDir: "/p",
		changelog: "@savvy-web/changesets/changelog",
		baseBranch: "main",
		access: "restricted" as const,
		ignore: [],
		packages: [],
		legacyVersionFilesUsed: false,
	};

	it("renders the minimal shape", () => {
		const out = renderHuman(baseCfg);
		expect(out).toContain("Config:");
		expect(out).toContain("Project:");
		expect(out).toContain("(none declared)");
	});

	it("calls out legacy versionFiles usage", () => {
		const out = renderHuman({ ...baseCfg, legacyVersionFilesUsed: true });
		expect(out).toMatch(/deprecated/);
		expect(out).toMatch(/1\.0\.0/);
	});

	it("renders packages with additionalScopes and versionFiles", () => {
		const out = renderHuman({
			...baseCfg,
			packages: [
				{
					name: "@scope/foo",
					workspaceDir: "/p/packages/foo",
					version: "1.2.3",
					additionalScopes: ["plugin/**"],
					additionalScopeFiles: ["/p/plugin/SKILL.md"],
					versionFiles: [
						{
							glob: "plugin/.claude-plugin/plugin.json",
							paths: ["$.version"],
							matchedFiles: ["/p/plugin/.claude-plugin/plugin.json"],
						},
					],
				},
			],
		});
		expect(out).toContain("@scope/foo");
		expect(out).toContain("v1.2.3");
		expect(out).toContain("plugin/**");
		expect(out).toContain("plugin/.claude-plugin/plugin.json");
		expect(out).toContain("$.version");
	});
});
