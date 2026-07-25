import { describe, expect, it } from "@effect/vitest";
import { DetectedPackageManager, PackageManagerDetector, WorkspaceRoot } from "@effected/workspaces";
import { Effect, Layer, Option, PlatformError } from "effect";
import type { ChildProcess } from "effect/unstable/process";
import { ChildProcessSpawner } from "effect/unstable/process";
import { ToolDefinition } from "../../src/schemas/ToolDefinition.js";
import { ResolutionPolicy, SourceRequirement, VersionExtractor } from "../../src/schemas/ToolResults.js";
import { ToolDiscovery, ToolDiscoveryLive } from "../../src/services/ToolDiscovery.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

interface CommandResponse {
	stdout: string;
	exitCode: number;
}

/**
 * Serialize a Command to a matchable string key.
 * For standard commands: "binary arg1 arg2"
 */
function cmdKey(cmd: ChildProcess.Command): string {
	if (cmd._tag === "StandardCommand") {
		const args = [...cmd.args];
		return args.length > 0 ? `${cmd.command} ${args.join(" ")}` : cmd.command;
	}
	return "unknown";
}

function makePlatformError() {
	return PlatformError.systemError({
		_tag: "NotFound",
		module: "ChildProcess",
		method: "spawn",
	});
}

/**
 * Build a mock ChildProcessSpawner service. Response keys are matched against
 * the serialized command string. Matching uses exact match first, then checks
 * if any key appears in the command string (for shell-wrapped commands).
 */
function buildSpawnerMethods(responses: Record<string, CommandResponse>) {
	function findResponse(cmd: ChildProcess.Command): CommandResponse | undefined {
		const key = cmdKey(cmd);
		// Exact match
		if (responses[key]) return responses[key];
		// For shell-wrapped commands like "sh -c command -v biome",
		// check if any response key is the shell argument portion.
		if (cmd._tag === "StandardCommand" && cmd.command === "sh") {
			const shellArg = [...cmd.args].slice(1).join(" ");
			if (responses[shellArg]) return responses[shellArg];
		}
		return undefined;
	}

	return {
		exitCode: (cmd: ChildProcess.Command) => {
			const resp = findResponse(cmd);
			if (resp) return Effect.succeed(ChildProcessSpawner.ExitCode(resp.exitCode));
			return Effect.fail(makePlatformError());
		},
		string: (cmd: ChildProcess.Command) => {
			const resp = findResponse(cmd);
			if (resp && resp.exitCode === 0) return Effect.succeed(resp.stdout);
			return Effect.fail(makePlatformError());
		},
		lines: (cmd: ChildProcess.Command) => {
			const resp = findResponse(cmd);
			if (resp && resp.exitCode === 0) return Effect.succeed(resp.stdout.split("\n"));
			return Effect.fail(makePlatformError());
		},
		spawn: () => Effect.fail(makePlatformError()),
		streamString: () => {
			throw new Error("streamString not implemented in mock");
		},
		streamLines: () => {
			throw new Error("streamLines not implemented in mock");
		},
	};
}

const makeTestSpawner = (responses: Record<string, CommandResponse>) =>
	Layer.succeed(
		ChildProcessSpawner.ChildProcessSpawner,
		buildSpawnerMethods(responses) as unknown as ChildProcessSpawner.ChildProcessSpawner["Service"],
	);

const makeTestPM = (type: "npm" | "pnpm" | "yarn" | "bun") =>
	Layer.succeed(PackageManagerDetector, {
		detect: (_root: string) =>
			Effect.succeed(
				DetectedPackageManager.make({
					name: type,
					version: Option.none(),
					runtime: type === "bun" ? ("bun" as const) : ("node" as const),
				}),
			),
	});

const makeTestRoot = (root: string) =>
	Layer.succeed(WorkspaceRoot, {
		find: (_cwd: string) => Effect.succeed(root),
	});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayer(
	responses: Record<string, CommandResponse>,
	pm: "npm" | "pnpm" | "yarn" | "bun" = "pnpm",
	root = "/workspace",
) {
	return ToolDiscoveryLive.pipe(
		Layer.provide(makeTestSpawner(responses)),
		Layer.provide(makeTestPM(pm)),
		Layer.provide(makeTestRoot(root)),
	);
}

/**
 * Provide the per-test ToolDiscovery layer. The layer is a parameter — every
 * test builds its own from a distinct spawner — so it cannot move to a
 * suite-boundary `layer(...)`, and the counting spawner below therefore cannot
 * accumulate across tests and needs no `beforeEach` reset.
 */
function provide<A, E>(
	layer: Layer.Layer<ToolDiscovery>,
	effect: Effect.Effect<A, E, ToolDiscovery>,
): Effect.Effect<A, E> {
	return Effect.provide(effect, layer);
}

/**
 * Build a counting spawner that tracks invocation count.
 */
function makeCountingSpawner(responses: Record<string, CommandResponse>) {
	let callCount = 0;
	const methods = buildSpawnerMethods(responses);

	// `Effect.suspend` so each increment happens when the spawn effect RUNS, not
	// when the method is called to build it. The eager form would count a command
	// that was only described, which is precisely what the cache tests below
	// distinguish (a cache hit must build no new spawn AND run none).
	const counted = {
		...methods,
		exitCode: (cmd: ChildProcess.Command) =>
			Effect.suspend(() => {
				callCount++;
				return methods.exitCode(cmd);
			}),
		string: (cmd: ChildProcess.Command) =>
			Effect.suspend(() => {
				callCount++;
				return methods.string(cmd);
			}),
	};

	const spawner = Layer.succeed(
		ChildProcessSpawner.ChildProcessSpawner,
		counted as unknown as ChildProcessSpawner.ChildProcessSpawner["Service"],
	);

	return { spawner, getCallCount: () => callCount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolDiscovery.resolve", () => {
	it.effect("resolves a tool found only globally", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result.source).toBe("global");
			expect(result.mismatch).toBe(false);
			expect(Option.isSome(result.globalVersion)).toBe(true);
			expect(Option.getOrElse(result.globalVersion, () => "")).toBe("1.9.0");
			expect(Option.isNone(result.localVersion)).toBe(true);
		}),
	);

	it.effect("resolves a tool found only locally", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result.source).toBe("local");
			expect(result.mismatch).toBe(false);
			expect(Option.isNone(result.globalVersion)).toBe(true);
			expect(Option.isSome(result.localVersion)).toBe(true);
			expect(Option.getOrElse(result.localVersion, () => "")).toBe("1.9.0");
		}),
	);

	it.effect("resolves both with same version — prefers local, no mismatch", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result.source).toBe("local");
			expect(result.mismatch).toBe(false);
			expect(Option.getOrElse(result.version, () => "")).toBe("1.9.0");
		}),
	);

	it.effect("resolves both with different versions — reports mismatch", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.8.0\n", exitCode: 0 },
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result.mismatch).toBe(true);
			expect(result.source).toBe("local");
			expect(Option.getOrElse(result.version, () => "")).toBe("1.9.0");
		}),
	);

	// `Effect.flip` replaces runExit plus a defensive is-a-Failure guard, and
	// tightens the assertion: the old form stringified the whole Cause and
	// substring-matched it, which would also pass on a DEFECT carrying that text.
	// flip proves the failure arrives on the typed channel as that error.
	it.effect("fails when tool is not found anywhere", () =>
		Effect.gen(function* () {
			const layer = makeLayer({});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "nonexistent" })))),
				),
			);

			expect(error._tag).toBe("ToolResolutionError");
		}),
	);

	it.effect("caches results on second call", () =>
		Effect.gen(function* () {
			const { spawner, getCallCount } = makeCountingSpawner({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const layer = ToolDiscoveryLive.pipe(
				Layer.provide(spawner),
				Layer.provide(makeTestPM("pnpm")),
				Layer.provide(makeTestRoot("/workspace")),
			);

			const def = ToolDefinition.make({ name: "biome" });

			const [r1, r2, countAfterFirst] = yield* provide(
				layer,
				Effect.gen(function* () {
					const td = yield* ToolDiscovery;
					const first = yield* td.resolve(def);
					const afterFirst = getCallCount();
					const second = yield* td.resolve(def);
					return [first, second, afterFirst] as const;
				}),
			);

			expect(r1.name).toBe(r2.name);
			expect(r1.source).toBe(r2.source);
			expect(getCallCount()).toBe(countAfterFirst);
		}),
	);
});

// ---------------------------------------------------------------------------
// require
// ---------------------------------------------------------------------------

describe("ToolDiscovery.require", () => {
	it.effect("returns ResolvedTool when found", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.require(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result.name).toBe("biome");
		}),
	);

	it.effect("fails with ToolNotFoundError when not found", () =>
		Effect.gen(function* () {
			const layer = makeLayer({});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(Effect.andThen((td) => td.require(ToolDefinition.make({ name: "nonexistent" })))),
				),
			);

			expect(error._tag).toBe("ToolNotFoundError");
		}),
	);

	it.effect("includes custom message in ToolNotFoundError", () =>
		Effect.gen(function* () {
			const layer = makeLayer({});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(
						Effect.andThen((td) => td.require(ToolDefinition.make({ name: "missing" }), "Please install missing")),
					),
				),
			);

			expect(JSON.stringify(error)).toContain("Please install missing");
		}),
	);
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("ToolDiscovery.isAvailable", () => {
	it.effect("returns true when tool is found globally", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.isAvailable(ToolDefinition.make({ name: "biome" })))),
			);

			expect(result).toBe(true);
		}),
	);

	it.effect("returns false when tool is not found", () =>
		Effect.gen(function* () {
			const layer = makeLayer({});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(Effect.andThen((td) => td.isAvailable(ToolDefinition.make({ name: "nonexistent" })))),
			);

			expect(result).toBe(false);
		}),
	);
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe("ToolDiscovery.clearCache", () => {
	it.effect("forces re-resolution after clearing", () =>
		Effect.gen(function* () {
			const { spawner, getCallCount } = makeCountingSpawner({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const layer = ToolDiscoveryLive.pipe(
				Layer.provide(spawner),
				Layer.provide(makeTestPM("pnpm")),
				Layer.provide(makeTestRoot("/workspace")),
			);

			const def = ToolDefinition.make({ name: "biome" });

			yield* provide(
				layer,
				Effect.gen(function* () {
					const td = yield* ToolDiscovery;
					yield* td.resolve(def);
					const countAfterFirst = getCallCount();
					yield* td.clearCache;
					yield* td.resolve(def);
					expect(getCallCount()).toBeGreaterThan(countAfterFirst);
				}),
			);
		}),
	);
});

// ---------------------------------------------------------------------------
// SourceRequirement enforcement
// ---------------------------------------------------------------------------

describe("ToolDiscovery SourceRequirement", () => {
	it.effect("OnlyLocal — fails when only found globally", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(
						Effect.andThen((td) =>
							td.resolve(
								ToolDefinition.make({
									name: "biome",
									source: SourceRequirement.OnlyLocal(),
								}),
							),
						),
					),
				),
			);

			expect(JSON.stringify(error)).toContain("required locally");
		}),
	);

	it.effect("OnlyGlobal — fails when only found locally", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(
						Effect.andThen((td) =>
							td.resolve(
								ToolDefinition.make({
									name: "biome",
									source: SourceRequirement.OnlyGlobal(),
								}),
							),
						),
					),
				),
			);

			expect(JSON.stringify(error)).toContain("required globally");
		}),
	);

	it.effect("Both — fails when only one found", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(
						Effect.andThen((td) =>
							td.resolve(
								ToolDefinition.make({
									name: "biome",
									source: SourceRequirement.Both(),
								}),
							),
						),
					),
				),
			);

			expect(JSON.stringify(error)).toContain("both globally and locally");
		}),
	);
});

// ---------------------------------------------------------------------------
// ResolutionPolicy enforcement
// ---------------------------------------------------------------------------

describe("ToolDiscovery ResolutionPolicy", () => {
	it.effect("RequireMatch — fails when versions differ", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "1.8.0\n", exitCode: 0 },
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const error = yield* Effect.flip(
				provide(
					layer,
					ToolDiscovery.pipe(
						Effect.andThen((td) =>
							td.resolve(
								ToolDefinition.make({
									name: "biome",
									policy: ResolutionPolicy.RequireMatch(),
								}),
							),
						),
					),
				),
			);

			expect(JSON.stringify(error)).toContain("Version mismatch");
		}),
	);
});

// ---------------------------------------------------------------------------
// VersionExtractor variants
// ---------------------------------------------------------------------------

describe("ToolDiscovery VersionExtractor", () => {
	it.effect("None — version is Option.none()", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(
					Effect.andThen((td) =>
						td.resolve(
							ToolDefinition.make({
								name: "biome",
								versionExtractor: VersionExtractor.None(),
							}),
						),
					),
				),
			);

			expect(Option.isNone(result.version)).toBe(true);
			expect(Option.isNone(result.globalVersion)).toBe(true);
			expect(Option.isNone(result.localVersion)).toBe(true);
		}),
	);

	it.effect("Flag with custom parse — applies parse function", () =>
		Effect.gen(function* () {
			const layer = makeLayer({
				"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
				"biome --version": { stdout: "biome v1.9.0\n", exitCode: 0 },
			});

			const result = yield* provide(
				layer,
				ToolDiscovery.pipe(
					Effect.andThen((td) =>
						td.resolve(
							ToolDefinition.make({
								name: "biome",
								versionExtractor: VersionExtractor.Flag({
									flag: "--version",
									parse: (s) => s.replace(/^biome v/, "").trim(),
								}),
							}),
						),
					),
				),
			);

			expect(Option.getOrElse(result.globalVersion, () => "")).toBe("1.9.0");
		}),
	);
});
