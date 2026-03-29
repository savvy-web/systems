import type { Command } from "@effect/platform";
import { CommandExecutor } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { PackageManagerDetector, WorkspaceRoot } from "workspaces-effect";
import { ToolDefinition } from "../schemas/ToolDefinition.js";
import { ResolutionPolicy, SourceRequirement, VersionExtractor } from "../schemas/ToolResults.js";
import { ToolDiscovery, ToolDiscoveryLive } from "./ToolDiscovery.js";

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
function cmdKey(cmd: Command.Command): string {
	if (cmd._tag === "StandardCommand") {
		const args = [...cmd.args];
		return args.length > 0 ? `${cmd.command} ${args.join(" ")}` : cmd.command;
	}
	return "unknown";
}

function makePlatformError() {
	return new SystemError({
		reason: "Unknown",
		module: "Command",
		method: "exec",
		pathOrDescriptor: "",
	});
}

/**
 * Build a mock CommandExecutor. Response keys are matched against the
 * serialized command string. Matching uses exact match first, then checks
 * if any key appears in the command string (for shell-wrapped commands).
 */
function buildExecutorMethods(responses: Record<string, CommandResponse>) {
	function findResponse(cmd: Command.Command): CommandResponse | undefined {
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
		[CommandExecutor.TypeId]: CommandExecutor.TypeId,
		exitCode: (cmd: Command.Command) => {
			const resp = findResponse(cmd);
			if (resp) return Effect.succeed(resp.exitCode);
			return Effect.fail(makePlatformError());
		},
		string: (cmd: Command.Command) => {
			const resp = findResponse(cmd);
			if (resp && resp.exitCode === 0) return Effect.succeed(resp.stdout);
			return Effect.fail(makePlatformError());
		},
		lines: (cmd: Command.Command) => {
			const resp = findResponse(cmd);
			if (resp && resp.exitCode === 0) return Effect.succeed(resp.stdout.split("\n"));
			return Effect.fail(makePlatformError());
		},
		start: () => Effect.fail(makePlatformError()),
		stream: () => {
			throw new Error("stream not implemented in mock");
		},
		streamLines: () => {
			throw new Error("streamLines not implemented in mock");
		},
	};
}

const makeTestExecutor = (responses: Record<string, CommandResponse>) =>
	Layer.succeed(
		CommandExecutor.CommandExecutor,
		buildExecutorMethods(responses) as unknown as CommandExecutor.CommandExecutor,
	);

const makeTestPM = (type: "npm" | "pnpm" | "yarn" | "bun") =>
	Layer.succeed(
		PackageManagerDetector,
		PackageManagerDetector.of({
			detect: (_root: string) => Effect.succeed({ type, version: undefined }),
		}),
	);

const makeTestRoot = (root: string) =>
	Layer.succeed(
		WorkspaceRoot,
		WorkspaceRoot.of({
			find: (_cwd: string) => Effect.succeed(root),
		}),
	);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLayer(
	responses: Record<string, CommandResponse>,
	pm: "npm" | "pnpm" | "yarn" | "bun" = "pnpm",
	root = "/workspace",
) {
	return ToolDiscoveryLive.pipe(
		Layer.provide(makeTestExecutor(responses)),
		Layer.provide(makeTestPM(pm)),
		Layer.provide(makeTestRoot(root)),
	);
}

function run<A, E>(layer: Layer.Layer<ToolDiscovery>, effect: Effect.Effect<A, E, ToolDiscovery>): Promise<A> {
	return Effect.runPromise(Effect.provide(effect, layer));
}

function runExit<A, E>(layer: Layer.Layer<ToolDiscovery>, effect: Effect.Effect<A, E, ToolDiscovery>) {
	return Effect.runPromiseExit(Effect.provide(effect, layer));
}

/**
 * Build a counting executor that tracks invocation count.
 */
function makeCountingExecutor(responses: Record<string, CommandResponse>) {
	let callCount = 0;
	const methods = buildExecutorMethods(responses);

	const counted = {
		...methods,
		exitCode: (cmd: Command.Command) => {
			callCount++;
			return (methods.exitCode as (c: Command.Command) => Effect.Effect<number, SystemError>)(cmd);
		},
		string: (cmd: Command.Command) => {
			callCount++;
			return (methods.string as (c: Command.Command) => Effect.Effect<string, SystemError>)(cmd);
		},
	};

	const executor = Layer.succeed(
		CommandExecutor.CommandExecutor,
		counted as unknown as CommandExecutor.CommandExecutor,
	);

	return { executor, getCallCount: () => callCount };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolDiscovery.resolve", () => {
	it("resolves a tool found only globally", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result.source).toBe("global");
		expect(result.mismatch).toBe(false);
		expect(Option.isSome(result.globalVersion)).toBe(true);
		expect(Option.getOrElse(result.globalVersion, () => "")).toBe("1.9.0");
		expect(Option.isNone(result.localVersion)).toBe(true);
	});

	it("resolves a tool found only locally", async () => {
		const layer = makeLayer({
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result.source).toBe("local");
		expect(result.mismatch).toBe(false);
		expect(Option.isNone(result.globalVersion)).toBe(true);
		expect(Option.isSome(result.localVersion)).toBe(true);
		expect(Option.getOrElse(result.localVersion, () => "")).toBe("1.9.0");
	});

	it("resolves both with same version — prefers local, no mismatch", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result.source).toBe("local");
		expect(result.mismatch).toBe(false);
		expect(Option.getOrElse(result.version, () => "")).toBe("1.9.0");
	});

	it("resolves both with different versions — reports mismatch", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.8.0\n", exitCode: 0 },
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result.mismatch).toBe(true);
		expect(result.source).toBe("local");
		expect(Option.getOrElse(result.version, () => "")).toBe("1.9.0");
	});

	it("fails when tool is not found anywhere", async () => {
		const layer = makeLayer({});

		const exit = await runExit(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.resolve(ToolDefinition.make({ name: "nonexistent" })))),
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("ToolResolutionError");
		}
	});

	it("caches results on second call", async () => {
		const { executor, getCallCount } = makeCountingExecutor({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const layer = ToolDiscoveryLive.pipe(
			Layer.provide(executor),
			Layer.provide(makeTestPM("pnpm")),
			Layer.provide(makeTestRoot("/workspace")),
		);

		const def = ToolDefinition.make({ name: "biome" });

		const [r1, r2, countAfterFirst] = await run(
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
	});
});

// ---------------------------------------------------------------------------
// require
// ---------------------------------------------------------------------------

describe("ToolDiscovery.require", () => {
	it("returns ResolvedTool when found", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.require(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result.name).toBe("biome");
	});

	it("fails with ToolNotFoundError when not found", async () => {
		const layer = makeLayer({});

		const exit = await runExit(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.require(ToolDefinition.make({ name: "nonexistent" })))),
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("ToolNotFoundError");
		}
	});

	it("includes custom message in ToolNotFoundError", async () => {
		const layer = makeLayer({});

		const exit = await runExit(
			layer,
			ToolDiscovery.pipe(
				Effect.andThen((td) => td.require(ToolDefinition.make({ name: "missing" }), "Please install missing")),
			),
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("Please install missing");
		}
	});
});

// ---------------------------------------------------------------------------
// isAvailable
// ---------------------------------------------------------------------------

describe("ToolDiscovery.isAvailable", () => {
	it("returns true when tool is found globally", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
		});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.isAvailable(ToolDefinition.make({ name: "biome" })))),
		);

		expect(result).toBe(true);
	});

	it("returns false when tool is not found", async () => {
		const layer = makeLayer({});

		const result = await run(
			layer,
			ToolDiscovery.pipe(Effect.andThen((td) => td.isAvailable(ToolDefinition.make({ name: "nonexistent" })))),
		);

		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe("ToolDiscovery.clearCache", () => {
	it("forces re-resolution after clearing", async () => {
		const { executor, getCallCount } = makeCountingExecutor({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const layer = ToolDiscoveryLive.pipe(
			Layer.provide(executor),
			Layer.provide(makeTestPM("pnpm")),
			Layer.provide(makeTestRoot("/workspace")),
		);

		const def = ToolDefinition.make({ name: "biome" });

		await run(
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
	});
});

// ---------------------------------------------------------------------------
// SourceRequirement enforcement
// ---------------------------------------------------------------------------

describe("ToolDiscovery SourceRequirement", () => {
	it("OnlyLocal — fails when only found globally", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const exit = await runExit(
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
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("required locally");
		}
	});

	it("OnlyGlobal — fails when only found locally", async () => {
		const layer = makeLayer({
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const exit = await runExit(
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
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("required globally");
		}
	});

	it("Both — fails when only one found", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const exit = await runExit(
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
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("both globally and locally");
		}
	});
});

// ---------------------------------------------------------------------------
// ResolutionPolicy enforcement
// ---------------------------------------------------------------------------

describe("ToolDiscovery ResolutionPolicy", () => {
	it("RequireMatch — fails when versions differ", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "1.8.0\n", exitCode: 0 },
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const exit = await runExit(
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
		);

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			expect(JSON.stringify(exit.cause)).toContain("Version mismatch");
		}
	});
});

// ---------------------------------------------------------------------------
// VersionExtractor variants
// ---------------------------------------------------------------------------

describe("ToolDiscovery VersionExtractor", () => {
	it("None — version is Option.none()", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"pnpm exec biome --version": { stdout: "1.9.0\n", exitCode: 0 },
		});

		const result = await run(
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
	});

	it("Flag with custom parse — applies parse function", async () => {
		const layer = makeLayer({
			"command -v biome": { stdout: "/usr/local/bin/biome", exitCode: 0 },
			"biome --version": { stdout: "biome v1.9.0\n", exitCode: 0 },
		});

		const result = await run(
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
	});
});
