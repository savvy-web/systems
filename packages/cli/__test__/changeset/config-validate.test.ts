import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Workspaces } from "@effected/workspaces";
import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";

const WorkspacesKitLive = Workspaces.layer();

import { runConfigValidate } from "../../src/commands/changeset/commands/config-validate.js";

const { ConfigInspectorLive } = Changesets;

const TestLive = ConfigInspectorLive.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspacesKitLive)),
	Layer.provide(NodeServices.layer),
);
const silentLogger = Logger.layer([]);

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
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		process.exitCode = savedExitCode;
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
			expect(process.exitCode).toBeUndefined();
		}),
	);

	it.effect("exits 1 on an unknown package key", () =>
		Effect.gen(function* () {
			dir = setupFixture({
				configJson: {
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/ghost": {} } }],
				},
			});
			yield* runConfigValidate(dir).pipe(Effect.provide(TestLive), Effect.provide(silentLogger));
			expect(process.exitCode).toBe(1);
		}),
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
			expect(process.exitCode).toBe(1);
		}),
	);
});
