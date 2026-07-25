import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import type { PackageManagerError } from "../../src/errors/PackageManagerError.js";
import type { CommandResponse } from "../../src/layers/CommandRunnerTest.js";
import { CommandRunnerTest } from "../../src/layers/CommandRunnerTest.js";
import { PackageManagerAdapterLive } from "../../src/layers/PackageManagerAdapterLive.js";
import { PackageManagerAdapter } from "../../src/services/PackageManagerAdapter.js";

// -- Mock FileSystem --

interface MockFileEntry {
	readonly content: string;
}

const makeMockFs = (files: Record<string, MockFileEntry>): FileSystem.FileSystem => {
	return {
		readFileString: (path: string) => {
			const entry = files[path];
			if (!entry) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.succeed(entry.content);
		},

		access: (path: string) => {
			if (!files[path]) {
				return Effect.fail({ _tag: "SystemError", message: `File not found: ${path}` } as never);
			}
			return Effect.void;
		},

		readDirectory: () => Effect.succeed([]),
		writeFileString: () => Effect.void,
		chmod: () => Effect.void,
		chown: () => Effect.void,
		copy: () => Effect.void,
		copyFile: () => Effect.void,
		exists: () => Effect.succeed(true),
		link: () => Effect.void,
		makeDirectory: () => Effect.void,
		makeTempDirectory: () => Effect.succeed("/tmp/test"),
		makeTempDirectoryScoped: () => Effect.succeed("/tmp/test"),
		makeTempFile: () => Effect.succeed("/tmp/test-file"),
		makeTempFileScoped: () => Effect.succeed("/tmp/test-file"),
		open: () => Effect.die("not implemented"),
		readFile: () => Effect.die("not implemented"),
		readLink: () => Effect.succeed("/tmp"),
		realPath: () => Effect.succeed("/tmp"),
		remove: () => Effect.void,
		rename: () => Effect.void,
		sink: () => Effect.die("not implemented") as never,
		stat: () => Effect.die("not implemented"),
		stream: () => Effect.die("not implemented") as never,
		symlink: () => Effect.void,
		truncate: () => Effect.void,
		utimes: () => Effect.void,
		watch: () => Effect.die("not implemented") as never,
		writeFile: () => Effect.void,
	} as unknown as FileSystem.FileSystem;
};

const makeTestLayer = (files: Record<string, MockFileEntry>, responses: ReadonlyMap<string, CommandResponse>) =>
	Layer.provide(
		PackageManagerAdapterLive,
		Layer.mergeAll(CommandRunnerTest.layer(responses), Layer.succeed(FileSystem.FileSystem, makeMockFs(files))),
	);

const run = <A, E>(
	files: Record<string, MockFileEntry>,
	responses: ReadonlyMap<string, CommandResponse>,
	effect: Effect.Effect<A, E, PackageManagerAdapter>,
) => Effect.provide(effect, makeTestLayer(files, responses));

const runFail = (
	files: Record<string, MockFileEntry>,
	responses: ReadonlyMap<string, CommandResponse>,
	effect: Effect.Effect<unknown, PackageManagerError, PackageManagerAdapter>,
) => Effect.flip(Effect.provide(effect, makeTestLayer(files, responses)));

describe("PackageManagerAdapterLive", () => {
	describe("detect", () => {
		it.effect("detects from packageManager field in package.json", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "pnpm@9.1.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("pnpm");
				expect(result.version).toBe("9.1.0");
			}),
		);

		it.effect("detects from packageManager field and includes lockfile when present", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "pnpm@9.1.0" }) },
					"pnpm-lock.yaml": { content: "" },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("pnpm");
				expect(result.version).toBe("9.1.0");
				expect(result.lockfile).toBe("pnpm-lock.yaml");
			}),
		);

		it.effect("detects npm from packageManager field", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "npm@10.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("npm");
				expect(result.version).toBe("10.0.0");
			}),
		);

		it.effect("detects yarn from packageManager field", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "yarn@4.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("yarn");
				expect(result.version).toBe("4.0.0");
			}),
		);

		it.effect("detects bun from packageManager field", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "bun@1.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("bun");
				expect(result.version).toBe("1.0.0");
			}),
		);

		it.effect("detects deno from packageManager field", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "deno@2.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("deno");
				expect(result.version).toBe("2.0.0");
			}),
		);

		it.effect("detects from lockfile scanning", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
					"yarn.lock": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn --version", { exitCode: 0, stdout: "4.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("yarn");
				expect(result.version).toBe("4.0.0");
				expect(result.lockfile).toBe("yarn.lock");
			}),
		);

		it.effect("detects bun from bun.lockb", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
					"bun.lockb": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["bun --version", { exitCode: 0, stdout: "1.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("bun");
				expect(result.version).toBe("1.0.0");
				expect(result.lockfile).toBe("bun.lockb");
			}),
		);

		it.effect("detects deno from deno.lock", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
					"deno.lock": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["deno --version", { exitCode: 0, stdout: "2.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("deno");
				expect(result.version).toBe("2.0.0");
				expect(result.lockfile).toBe("deno.lock");
			}),
		);

		it.effect("detects pnpm from pnpm-lock.yaml", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
					"pnpm-lock.yaml": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm --version", { exitCode: 0, stdout: "9.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("pnpm");
				expect(result.version).toBe("9.0.0");
				expect(result.lockfile).toBe("pnpm-lock.yaml");
			}),
		);

		it.effect("fails when no packageManager field and no lockfile", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
				};

				const error = yield* runFail(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(error.operation).toBe("detect");
				expect(error.reason).toContain("no lockfile found");
			}),
		);

		it.effect("detects npm from package-lock.json", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test" }) },
					"package-lock.json": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["npm --version", { exitCode: 0, stdout: "10.2.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("npm");
				expect(result.version).toBe("10.2.0");
			}),
		);

		it.effect("ignores invalid packageManager field format", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: "invalid-format" }) },
					"yarn.lock": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn --version", { exitCode: 0, stdout: "4.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("yarn");
				expect(result.version).toBe("4.0.0");
			}),
		);

		it.effect("ignores non-string packageManager field", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ name: "test", packageManager: 123 }) },
					"package-lock.json": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["npm --version", { exitCode: 0, stdout: "10.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("npm");
				expect(result.version).toBe("10.0.0");
			}),
		);

		it.effect("handles missing package.json gracefully", () =>
			Effect.gen(function* () {
				const files = {
					"yarn.lock": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn --version", { exitCode: 0, stdout: "4.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("yarn");
				expect(result.version).toBe("4.0.0");
			}),
		);

		it.effect("handles invalid JSON in package.json gracefully", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: "not json" },
					"pnpm-lock.yaml": { content: "" },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm --version", { exitCode: 0, stdout: "9.0.0\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.detect()),
				);
				expect(result.name).toBe("pnpm");
				expect(result.version).toBe("9.0.0");
			}),
		);
	});

	describe("install", () => {
		it.effect("runs correct command for detected PM (pnpm, frozen)", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm install --frozen-lockfile", { exitCode: 0, stdout: "", stderr: "" }],
				]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install()),
				);
			}),
		);

		it.effect("runs npm ci for npm with frozen lockfile", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["npm ci", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: true })),
				);
			}),
		);

		it.effect("runs npm install when frozen is false", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["npm install", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: false })),
				);
			}),
		);

		it.effect("runs yarn install --immutable for yarn with frozen lockfile", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "yarn@4.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn install --immutable", { exitCode: 0, stdout: "", stderr: "" }],
				]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: true })),
				);
			}),
		);

		it.effect("runs yarn install when frozen is false", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "yarn@4.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["yarn install", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: false })),
				);
			}),
		);

		it.effect("runs bun install --frozen-lockfile for bun with frozen lockfile", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "bun@1.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["bun install --frozen-lockfile", { exitCode: 0, stdout: "", stderr: "" }],
				]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: true })),
				);
			}),
		);

		it.effect("runs bun install when frozen is false", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "bun@1.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["bun install", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: false })),
				);
			}),
		);

		it.effect("runs deno install (no frozen flag)", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "deno@2.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["deno install", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: true })),
				);
			}),
		);

		it.effect("runs pnpm install when frozen is false", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["pnpm install", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ frozen: false })),
				);
			}),
		);

		it.effect("maps install failure to PackageManagerError", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["npm ci", { exitCode: 1, stdout: "", stderr: "install failed" }],
				]);

				const error = yield* runFail(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install()),
				);
				expect(error.operation).toBe("install");
				expect(error.pm).toBe("npm");
				expect(error.reason).toContain("Install failed");
			}),
		);

		it.effect("passes cwd option to exec", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([["npm ci", { exitCode: 0, stdout: "", stderr: "" }]]);

				yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.install({ cwd: "/some/path" })),
				);
			}),
		);
	});

	describe("getCachePaths", () => {
		it.effect("queries correct command for npm", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["npm config get cache", { exitCode: 0, stdout: "/home/user/.npm\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result).toEqual(["/home/user/.npm"]);
			}),
		);

		it.effect("queries correct command for pnpm", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm store path", { exitCode: 0, stdout: "/home/user/.local/share/pnpm/store\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result).toEqual(["/home/user/.local/share/pnpm/store"]);
			}),
		);

		it.effect("queries correct command for yarn", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "yarn@4.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn cache dir", { exitCode: 0, stdout: "/home/user/.yarn/cache\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result).toEqual(["/home/user/.yarn/cache"]);
			}),
		);

		it.effect("returns hardcoded path for bun", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "bun@1.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result[0]).toContain(".bun/install/cache");
			}),
		);

		it.effect("returns hardcoded path for deno", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "deno@2.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(result[0]).toContain("deno");
			}),
		);

		it.effect("maps npm cache command failure to PackageManagerError", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["npm config get cache", { exitCode: 1, stdout: "", stderr: "error" }],
				]);

				const error = yield* runFail(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(error.operation).toBe("cache");
				expect(error.pm).toBe("npm");
				expect(error.reason).toContain("Failed to get cache paths");
			}),
		);

		it.effect("maps pnpm cache command failure to PackageManagerError", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm store path", { exitCode: 1, stdout: "", stderr: "error" }],
				]);

				const error = yield* runFail(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(error.operation).toBe("cache");
				expect(error.pm).toBe("pnpm");
			}),
		);

		it.effect("maps yarn cache command failure to PackageManagerError", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "yarn@4.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["yarn cache dir", { exitCode: 1, stdout: "", stderr: "error" }],
				]);

				const error = yield* runFail(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getCachePaths()),
				);
				expect(error.operation).toBe("cache");
				expect(error.pm).toBe("yarn");
			}),
		);
	});

	describe("getLockfilePaths", () => {
		it.effect("returns correct lockfiles for yarn", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "yarn@4.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["yarn.lock"]);
			}),
		);

		it.effect("returns correct lockfiles for npm", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "npm@10.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["package-lock.json"]);
			}),
		);

		it.effect("returns correct lockfiles for pnpm", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["pnpm-lock.yaml"]);
			}),
		);

		it.effect("returns correct lockfiles for bun", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "bun@1.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["bun.lockb", "bun.lock"]);
			}),
		);

		it.effect("returns correct lockfiles for deno", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "deno@2.0.0" }) },
				};

				const result = yield* run(
					files,
					new Map(),
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.getLockfilePaths()),
				);
				expect(result).toEqual(["deno.lock"]);
			}),
		);
	});

	describe("exec", () => {
		it.effect("delegates to CommandRunner", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm run build", { exitCode: 0, stdout: "build output\n", stderr: "" }],
				]);

				const result = yield* run(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.exec(["run", "build"])),
				);
				expect(result.stdout).toBe("build output\n");
				expect(result.exitCode).toBe(0);
			}),
		);

		it.effect("maps errors to PackageManagerError", () =>
			Effect.gen(function* () {
				const files = {
					"package.json": { content: JSON.stringify({ packageManager: "pnpm@9.0.0" }) },
				};
				const responses = new Map<string, CommandResponse>([
					["pnpm run fail", { exitCode: 1, stdout: "", stderr: "error output" }],
				]);

				const error = yield* runFail(
					files,
					responses,
					Effect.flatMap(PackageManagerAdapter, (svc) => svc.exec(["run", "fail"])),
				);
				expect(error.operation).toBe("exec");
				expect(error.pm).toBe("pnpm");
			}),
		);
	});
});
