import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ReposConfigStore, ReposConfigStoreLive } from "../../src/repos/services/config-store.js";

const run = <A, E>(effect: Effect.Effect<A, E, ReposConfigStore>) =>
	Effect.runPromise(
		effect.pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeServices.layer)) as Effect.Effect<A, E>,
	);

const manifest = {
	repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
};

describe("ReposConfigStore", () => {
	it("round-trips a manifest", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		const out = await run(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				yield* store.write(root, manifest);
				return yield* store.read(root);
			}),
		);
		expect(out.repos.spec?.purpose).toBe("spec authority");
		expect(readFileSync(join(root, ".repos", "config.json"), "utf8").endsWith("\n")).toBe(true);
	});
	it("exists() is false before write and true after", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		const store = await run(
			Effect.gen(function* () {
				return yield* ReposConfigStore;
			}),
		);
		expect(await run(store.exists(root))).toBe(false);
		await run(store.write(root, manifest));
		expect(await run(store.exists(root))).toBe(true);
	});
	it("fails with ReposConfigError kind invalid on invalid JSON", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		mkdirSync(join(root, ".repos"), { recursive: true });
		writeFileSync(join(root, ".repos", "config.json"), "{not json");
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeServices.layer)),
		);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			const error = Cause.findErrorOption(exit.cause);
			expect(error._tag).toBe("Some");
			if (error._tag === "Some") {
				expect(error.value.kind).toBe("invalid");
			}
		}
	});
	it("fails with ReposConfigError kind invalid on schema violation", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		mkdirSync(join(root, ".repos"), { recursive: true });
		writeFileSync(join(root, ".repos", "config.json"), JSON.stringify({ repos: { x: { url: "u" } } }));
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeServices.layer)),
		);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			const error = Cause.findErrorOption(exit.cause);
			expect(error._tag).toBe("Some");
			if (error._tag === "Some") {
				expect(error.value.kind).toBe("invalid");
			}
		}
	});
	it("fails with ReposConfigError kind missing when the manifest file does not exist", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeServices.layer)),
		);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			const error = Cause.findErrorOption(exit.cause);
			expect(error._tag).toBe("Some");
			if (error._tag === "Some") {
				expect(error.value.kind).toBe("missing");
			}
		}
	});

	it("no .tmp file lingers after a write", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		await run(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				yield* store.write(root, manifest);
			}),
		);
		const files = readdirSync(join(root, ".repos"));
		expect(files).toEqual(["config.json"]);
		expect(existsSync(join(root, ".repos", "config.json.tmp"))).toBe(false);
	});

	it("add-on-fresh-dir still works: write creates the .repos directory and the manifest", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		await run(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				yield* store.write(root, manifest);
			}),
		);
		expect(existsSync(join(root, ".repos", "config.json"))).toBe(true);
	});

	it("distinguishes a stat failure from a missing file: a non-directory blocking the manifest path fails kind invalid", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		// Create a FILE where the ".repos" directory should be, so stat-ing
		// ".repos/config.json" fails with ENOTDIR rather than returning false.
		writeFileSync(join(root, ".repos"), "not a directory");
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeServices.layer)),
		);
		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure") {
			const error = Cause.findErrorOption(exit.cause);
			expect(error._tag).toBe("Some");
			if (error._tag === "Some") {
				expect(error.value.kind).toBe("invalid");
				expect(error.value.reason).toContain("stat failed");
			}
		}
	});
});
