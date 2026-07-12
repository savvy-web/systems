import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ReposConfigStore, ReposConfigStoreLive } from "../../src/repos/services/config-store.js";

const run = <A, E>(effect: Effect.Effect<A, E, ReposConfigStore>) =>
	Effect.runPromise(
		effect.pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeContext.layer)) as Effect.Effect<A, E>,
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
		expect(out.repos["spec"]?.purpose).toBe("spec authority");
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
	it("fails with ReposConfigError on invalid JSON", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		mkdirSync(join(root, ".repos"), { recursive: true });
		writeFileSync(join(root, ".repos", "config.json"), "{not json");
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeContext.layer)),
		);
		expect(exit._tag).toBe("Failure");
	});
	it("fails with ReposConfigError on schema violation", async () => {
		const root = mkdtempSync(join(tmpdir(), "repos-store-"));
		mkdirSync(join(root, ".repos"), { recursive: true });
		writeFileSync(join(root, ".repos", "config.json"), JSON.stringify({ repos: { x: { url: "u" } } }));
		const exit = await Effect.runPromiseExit(
			Effect.gen(function* () {
				const store = yield* ReposConfigStore;
				return yield* store.read(root);
			}).pipe(Effect.provide(ReposConfigStoreLive), Effect.provide(NodeContext.layer)),
		);
		expect(exit._tag).toBe("Failure");
	});
});
