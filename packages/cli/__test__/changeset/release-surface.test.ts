import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspacesLive } from "workspaces-effect";

import { renderHuman, runReleaseSurface } from "../../src/commands/changeset/commands/release-surface.js";

const { ConfigInspectorLive } = Changesets;

const TestLive = ConfigInspectorLive.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspacesLive)),
	Layer.provide(NodeContext.layer),
);
const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

function setupFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "cs-cli-rs-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "root", version: "1.0.0", private: true, workspaces: ["packages/foo"] }),
	);
	writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n');
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, "packages/foo"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/package.json"), JSON.stringify({ name: "@scope/foo", version: "1.2.3" }));
	mkdirSync(join(dir, "plugin"), { recursive: true });
	writeFileSync(join(dir, "plugin/SKILL.md"), "");
	mkdirSync(join(dir, ".changeset"), { recursive: true });
	writeFileSync(
		join(dir, ".changeset", "config.json"),
		JSON.stringify(
			{
				changelog: [
					"@savvy-web/changesets/changelog",
					{
						repo: "owner/repo",
						packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } },
					},
				],
				baseBranch: "main",
			},
			null,
			2,
		),
	);
	return dir;
}

describe("release-surface – runReleaseSurface handler", () => {
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

	it("succeeds for a declared package", async () => {
		await Effect.runPromise(
			runReleaseSurface(dir, "@scope/foo", false).pipe(Effect.provide(TestLive), Effect.provide(silentLogger)),
		);
		expect(process.exitCode).toBeUndefined();
	});

	it("emits valid JSON when --json is set", async () => {
		const logs: string[] = [];
		const captureLogger = Logger.replace(
			Logger.defaultLogger,
			Logger.make(({ message }) => {
				logs.push(String(message));
			}),
		);
		await Effect.runPromise(
			runReleaseSurface(dir, "@scope/foo", true).pipe(Effect.provide(TestLive), Effect.provide(captureLogger)),
		);
		expect(logs).toHaveLength(1);
		const parsed = JSON.parse(logs[0]);
		expect(parsed.name).toBe("@scope/foo");
		expect(parsed.version).toBe("1.2.3");
		expect(parsed.additionalScopes).toEqual(["plugin/**"]);
	});

	it("sets exitCode=1 when package is not declared", async () => {
		await Effect.runPromise(
			runReleaseSurface(dir, "@scope/ghost", false).pipe(
				Effect.provide(TestLive),
				Effect.provide(silentLogger),
				Effect.ignore,
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("sets exitCode=1 when the inspector fails", async () => {
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			JSON.stringify(
				{
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/unknown": {} } }],
				},
				null,
				2,
			),
		);
		await Effect.runPromise(
			runReleaseSurface(dir, "@scope/unknown", false).pipe(
				Effect.provide(TestLive),
				Effect.provide(silentLogger),
				Effect.ignore,
			),
		);
		expect(process.exitCode).toBe(1);
	});
});

describe("renderHuman", () => {
	const minimal = {
		name: "@scope/foo",
		workspaceDir: "/p/packages/foo",
		version: "1.0.0",
		additionalScopes: [] as ReadonlyArray<string>,
		additionalScopeFiles: [] as ReadonlyArray<string>,
		versionFiles: [],
	};

	it("renders the minimal scope with a hint", () => {
		const out = renderHuman(minimal);
		expect(out).toContain("@scope/foo");
		expect(out).toContain("workspace dir is the entire release surface");
	});

	it("renders additionalScopes and matched files", () => {
		const out = renderHuman({
			...minimal,
			additionalScopes: ["plugin/**", "!plugin/cache/**"],
			additionalScopeFiles: ["/p/plugin/a.md", "/p/plugin/b.md"],
		});
		expect(out).toContain("plugin/**");
		expect(out).toContain("!plugin/cache/**");
		expect(out).toContain("/p/plugin/a.md");
		expect(out).toContain("Resolved files (2)");
	});

	it("renders versionFiles", () => {
		const out = renderHuman({
			...minimal,
			versionFiles: [
				{
					glob: "plugin/.claude-plugin/plugin.json",
					paths: ["$.version"],
					matchedFiles: ["/p/plugin/.claude-plugin/plugin.json"],
				},
			],
		});
		expect(out).toContain("plugin/.claude-plugin/plugin.json");
		expect(out).toContain("$.version");
		expect(out).toContain("/p/plugin/.claude-plugin/plugin.json");
	});
});
