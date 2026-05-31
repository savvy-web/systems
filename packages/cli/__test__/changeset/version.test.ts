import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Effect, Layer, Logger } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PackageManagerDetector, WorkspaceDiscovery } from "workspaces-effect";

import { runVersion } from "../../src/commands/changeset/commands/version.js";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
	execFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(() => '{"name":"root"}'),
}));

vi.mock("@savvy-web/silk-effects", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@savvy-web/silk-effects")>();
	return {
		...actual,
		Changesets: {
			...actual.Changesets,
			ChangelogTransformer: {
				transformFile: vi.fn(),
				transformContent: actual.Changesets.ChangelogTransformer.transformContent,
			},
			VersionFiles: {
				processResolvedVersionFiles: vi.fn(() => []),
			},
		},
	};
});

import { Changesets } from "@savvy-web/silk-effects";

const ChangelogTransformer = Changesets.ChangelogTransformer as unknown as {
	transformFile: ReturnType<typeof vi.fn>;
	transformContent: (typeof Changesets.ChangelogTransformer)["transformContent"];
};
const VersionFiles = Changesets.VersionFiles as unknown as {
	processResolvedVersionFiles: ReturnType<typeof vi.fn>;
};

type InspectedConfig = Changesets.InspectedConfig;
const { ConfigInspector, ConfigurationError, makeConfigInspectorTest } = Changesets;

const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

function makeInspected(overrides: Partial<InspectedConfig> = {}): InspectedConfig {
	return {
		configPath: "/project/.changeset/config.json",
		projectDir: "/project",
		changelog: "@savvy-web/changesets/changelog",
		baseBranch: "main",
		access: "restricted",
		ignore: [],
		packages: [],
		legacyVersionFilesUsed: false,
		...overrides,
	};
}

const ValidConfigInspectorLayer = makeConfigInspectorTest(makeInspected());

const TestPackageManagerDetectorLayer = Layer.succeed(PackageManagerDetector, {
	detect: () => Effect.succeed({ type: "pnpm" as const, version: "10.0.0", runtime: "node" as const }),
});

const TestWorkspaceDiscoveryLayer = Layer.succeed(WorkspaceDiscovery, {
	listPackages: () => Effect.succeed([]),
	getPackage: () => Effect.fail({ _tag: "PackageNotFoundError" as const, name: "", reason: "" } as never),
	importerMap: () => Effect.succeed(new Map()),
	refresh: () => Effect.void,
});

const TestLayers = Layer.mergeAll(
	ValidConfigInspectorLayer,
	TestPackageManagerDetectorLayer,
	TestWorkspaceDiscoveryLayer,
);

afterEach(() => {
	vi.resetAllMocks();
});

describe("runVersion Effect handler", () => {
	it("skips execSync and logs dry-run message when dryRun is true", async () => {
		vi.mocked(existsSync).mockReturnValue(false); // no config and no changelogs
		await Effect.runPromise(runVersion(true).pipe(Effect.provide(TestLayers), Effect.provide(silentLogger)));
		expect(execSync).not.toHaveBeenCalled();
	});

	it("runs execSync with changeset version command when dryRun is false", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		await Effect.runPromise(runVersion(false).pipe(Effect.provide(TestLayers), Effect.provide(silentLogger)));
		expect(execSync).toHaveBeenCalledWith("pnpm exec changeset version", {
			cwd: process.cwd(),
			stdio: "inherit",
		});
	});

	it("handles zero changelogs gracefully", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		await Effect.runPromise(runVersion(true).pipe(Effect.provide(TestLayers), Effect.provide(silentLogger)));
		expect(ChangelogTransformer.transformFile).not.toHaveBeenCalled();
	});

	it("transforms each discovered changelog file", async () => {
		const packagesLayer = Layer.succeed(WorkspaceDiscovery, {
			listPackages: () =>
				Effect.succeed([
					{ name: "pkg-a", version: "1.0.0", path: "/project/packages/a" },
					{ name: "pkg-b", version: "2.0.0", path: "/project/packages/b" },
				] as never),
			getPackage: () => Effect.fail({ _tag: "PackageNotFoundError" as const, name: "", reason: "" } as never),
			importerMap: () => Effect.succeed(new Map()),
			refresh: () => Effect.void,
		});

		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			return s.endsWith("packages/a/CHANGELOG.md") || s.endsWith("packages/b/CHANGELOG.md");
		});

		await Effect.runPromise(
			runVersion(true).pipe(
				Effect.provide(Layer.mergeAll(ValidConfigInspectorLayer, TestPackageManagerDetectorLayer, packagesLayer)),
				Effect.provide(silentLogger),
			),
		);

		expect(ChangelogTransformer.transformFile).toHaveBeenCalledTimes(2);
	});

	it("rejects when execSync throws an error", async () => {
		vi.mocked(existsSync).mockReturnValue(false);
		vi.mocked(execSync).mockImplementation(() => {
			throw new Error("command not found");
		});

		await expect(
			Effect.runPromise(runVersion(false).pipe(Effect.provide(TestLayers), Effect.provide(silentLogger))),
		).rejects.toThrow("changeset version failed: command not found");
	});

	it("rejects when transformFile throws an error", async () => {
		const packagesLayer = Layer.succeed(WorkspaceDiscovery, {
			listPackages: () => Effect.succeed([{ name: "pkg-a", version: "1.0.0", path: "/project/packages/a" }] as never),
			getPackage: () => Effect.fail({ _tag: "PackageNotFoundError" as const, name: "", reason: "" } as never),
			importerMap: () => Effect.succeed(new Map()),
			refresh: () => Effect.void,
		});

		vi.mocked(existsSync).mockReturnValue(true);
		vi.mocked(ChangelogTransformer.transformFile).mockImplementation(() => {
			throw new Error("ENOENT: no such file");
		});

		// existsSync returns true everywhere — also for .changeset/config.json,
		// which would force a config inspect call. Provide a valid inspector layer
		// (the default TestLayers does, but we override workspaces here).
		await expect(
			Effect.runPromise(
				runVersion(true).pipe(
					Effect.provide(Layer.mergeAll(ValidConfigInspectorLayer, TestPackageManagerDetectorLayer, packagesLayer)),
					Effect.provide(silentLogger),
				),
			),
		).rejects.toThrow(/Failed to transform .*\/CHANGELOG.md: ENOENT/);
	});

	it("skips version files when inspected config has no packages with versionFiles", async () => {
		// existsSync returns true for the config path so requireValidConfig runs;
		// the inspector layer returns an empty packages list so processing is skipped.
		vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith(".changeset/config.json"));
		await Effect.runPromise(runVersion(true).pipe(Effect.provide(TestLayers), Effect.provide(silentLogger)));
		expect(VersionFiles.processResolvedVersionFiles).not.toHaveBeenCalled();
	});

	it("processes version files when inspector reports packages with versionFiles", async () => {
		const InspectorWithVF = makeConfigInspectorTest(
			makeInspected({
				packages: [
					{
						name: "@scope/foo",
						workspaceDir: "/project/packages/foo",
						version: "2.0.0",
						additionalScopes: [],
						additionalScopeFiles: [],
						versionFiles: [
							{
								glob: "plugin.json",
								paths: ["$.version"],
								matchedFiles: ["/project/plugin.json"],
							},
						],
					},
				],
			}),
		);
		vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith(".changeset/config.json"));
		vi.mocked(VersionFiles.processResolvedVersionFiles).mockReturnValue([
			{ filePath: "/project/plugin.json", jsonPaths: ["$.version"], version: "2.0.0", previousValues: ["1.0.0"] },
		]);

		await Effect.runPromise(
			runVersion(true).pipe(
				Effect.provide(Layer.mergeAll(InspectorWithVF, TestPackageManagerDetectorLayer, TestWorkspaceDiscoveryLayer)),
				Effect.provide(silentLogger),
			),
		);

		expect(VersionFiles.processResolvedVersionFiles).toHaveBeenCalledTimes(1);
		const callArgs = vi.mocked(VersionFiles.processResolvedVersionFiles).mock.calls[0];
		expect(callArgs[0]).toHaveLength(1);
		expect(callArgs[1]).toBe(true);
	});

	it("reads fresh package.json versions from disk after changeset version mutates them", async () => {
		// The inspector cache (and the underlying WorkspaceDiscovery cache) is
		// warmed by requireValidConfig BEFORE `changeset version` runs, so its
		// `scope.version` is the pre-bump value. version.ts must re-read each
		// scope's package.json from disk after the bump so processResolvedVersionFiles
		// writes the new version into the linked versionFiles target.
		const StaleInspector = makeConfigInspectorTest(
			makeInspected({
				packages: [
					{
						name: "@scope/foo",
						workspaceDir: "/project/packages/foo",
						version: "1.0.0", // pre-bump cached
						additionalScopes: [],
						additionalScopeFiles: [],
						versionFiles: [
							{
								glob: "plugin.json",
								paths: ["$.version"],
								matchedFiles: ["/project/plugin.json"],
							},
						],
					},
				],
			}),
		);
		vi.mocked(existsSync).mockImplementation((p) => {
			const s = String(p);
			return s.endsWith(".changeset/config.json") || s.endsWith("/packages/foo/package.json");
		});
		vi.mocked(VersionFiles.processResolvedVersionFiles).mockReturnValue([]);
		// Post-bump disk state: @scope/foo's package.json now declares 2.0.0.
		vi.mocked(readFileSync).mockImplementation(((p: unknown) => {
			const s = String(p);
			if (s.endsWith("/packages/foo/package.json")) {
				return '{"name":"@scope/foo","version":"2.0.0"}';
			}
			return '{"name":"root"}';
		}) as typeof readFileSync);

		await Effect.runPromise(
			runVersion(false).pipe(
				Effect.provide(Layer.mergeAll(StaleInspector, TestPackageManagerDetectorLayer, TestWorkspaceDiscoveryLayer)),
				Effect.provide(silentLogger),
			),
		);

		const passedScopes = vi.mocked(VersionFiles.processResolvedVersionFiles).mock.calls[0]?.[0];
		expect(passedScopes?.[0]?.version).toBe("2.0.0");
	});

	it("refuses to run when the config inspector returns ConfigurationError", async () => {
		const failingInspector = Layer.succeed(ConfigInspector, {
			inspect: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
			classify: () => Effect.fail(new ConfigurationError({ field: "options", reason: "synthetic" })),
		});
		vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith(".changeset/config.json"));

		const exit = await Effect.runPromiseExit(
			runVersion(false).pipe(
				Effect.provide(Layer.mergeAll(failingInspector, TestPackageManagerDetectorLayer, TestWorkspaceDiscoveryLayer)),
				Effect.provide(silentLogger),
			),
		);
		expect(exit._tag).toBe("Failure");
		// Confirm execSync was not called — refusal happens before the version step.
		expect(execSync).not.toHaveBeenCalled();
	});

	it("falls back to npm when PackageManagerDetector fails", async () => {
		const failingDetectorLayer = Layer.succeed(PackageManagerDetector, {
			detect: () => Effect.fail({ _tag: "PackageManagerDetectionError" as const, reason: "no pm found" } as never),
		});
		vi.mocked(existsSync).mockReturnValue(false);

		await Effect.runPromise(
			runVersion(false).pipe(
				Effect.provide(Layer.mergeAll(ValidConfigInspectorLayer, failingDetectorLayer, TestWorkspaceDiscoveryLayer)),
				Effect.provide(silentLogger),
			),
		);

		expect(execSync).toHaveBeenCalledWith("npx changeset version", {
			cwd: process.cwd(),
			stdio: "inherit",
		});
	});
});
