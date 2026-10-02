import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Workspaces } from "@effected/workspaces";
import { ChangesetConfigReader, Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

const WorkspacesKitLive = Workspaces.layer();

import { runConfigValidate } from "../../src/commands/changeset/commands/config-validate.js";
import { Capture } from "../utils/capture.js";
import { TestExit } from "../utils/exit.js";

const { ConfigInspector } = Changesets;

const TestLive = ConfigInspector.layer.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReader.layer, WorkspacesKitLive)),
	Layer.provide(NodeServices.layer),
);
/** Logs silenced, plus the fixed presentation environment the handler's report renders under. */
const silentLogger = Layer.merge(Logger.layer([]), Capture.env);

function setupFixture(opts: { configJson: Record<string, unknown> }): string {
	const dir = mkdtempSync(join(tmpdir(), "cs-cli-validate-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "root", version: "1.0.0", private: true }));
	writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages:\n");
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, ".changeset"), { recursive: true });
	writeFileSync(join(dir, ".changeset", "config.json"), JSON.stringify(opts.configJson, null, 2));
	return dir;
}

describe("config validate – runConfigValidate handler", () => {
	let dir: string;

	beforeEach(() => {
		TestExit.reset();
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it.effect("exits 0 on a valid config", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: {
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo" }],
					baseBranch: "main",
				},
			});
			yield* runConfigValidate(dir).pipe(Effect.provide(TestLive), Effect.provide(silentLogger));
			expect(TestExit.code()).toBe(0);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("exits 1 on an unknown package key", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: {
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/ghost": {} } }],
				},
			});
			yield* runConfigValidate(dir).pipe(Effect.provide(TestLive), Effect.provide(silentLogger));
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("exits 1 on dual-shape", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: {
					changelog: [
						"@savvy-web/changesets/changelog",
						{
							repo: "owner/repo",
							packages: {},
							versionFiles: [{ glob: "x.json", package: "@scope/foo" }],
						},
					],
				},
			});
			yield* runConfigValidate(dir).pipe(Effect.provide(TestLive), Effect.provide(silentLogger));
			expect(TestExit.code()).toBe(1);
		}).pipe(Effect.provide(TestExit.layer)),
	);

	it.effect("prints the outcome as one stdout line: the config path and its package count", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: { changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo" }], baseBranch: "main" },
			});
			const result = yield* Capture.run(runConfigValidate(dir).pipe(Effect.provide(TestLive)));

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toEqual([`✓ ${join(dir, ".changeset", "config.json")} — 0 packages declared`]);
		}),
	);

	it.effect("prints a finding as one stdout line naming the config, the field and the reason", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: {
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/ghost": {} } }],
				},
			});
			const result = yield* Capture.run(runConfigValidate(dir).pipe(Effect.provide(TestLive)), { audience: "agent" });

			expect(result.exitCode).toBe(1);
			expect(result.stderr).toEqual([]);
			expect(result.stdout).toHaveLength(1);
			expect(result.stdout[0]).toMatch(
				new RegExp(
					`^✗ ${join(dir, ".changeset", "config.json").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} — \\S+: .+@scope/ghost`,
				),
			);
		}),
	);
});
