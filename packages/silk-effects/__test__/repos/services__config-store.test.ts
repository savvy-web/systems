import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ReposConfigStore } from "../../src/repos/services/config-store.js";

// Constant for the suite: the store is stateless and takes `root` as a per-call
// argument, so one layer serves every test (each of which makes its own tmpdir).
const StoreLive = ReposConfigStore.layer.pipe(Layer.provide(NodeServices.layer));

const manifest = {
	repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
};

layer(StoreLive)("ReposConfigStore", (it) => {
	it.effect("round-trips a manifest", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			yield* store.write(root, manifest);
			const out = yield* store.read(root);
			expect(out.repos.spec?.purpose).toBe("spec authority");
			expect(readFileSync(join(root, ".repos", "config.json"), "utf8").endsWith("\n")).toBe(true);
		}),
	);

	it.effect("exists() is false before write and true after", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			expect(yield* store.exists(root)).toBe(false);
			yield* store.write(root, manifest);
			expect(yield* store.exists(root)).toBe(true);
		}),
	);

	// The `read` failure tests below use `Effect.flip` rather than the previous
	// runPromiseExit plus nested is-a-Failure / is-a-Some guards. flip proves the
	// failure arrives on the TYPED channel and makes the kind assertion
	// unconditional — under the old shape it silently skipped whenever an outer
	// guard did not hold. The dropped assertions are exactly those two guard
	// checks per test; every substantive assertion is preserved.
	it.effect("fails with ReposConfigError kind invalid on invalid JSON", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			mkdirSync(join(root, ".repos"), { recursive: true });
			writeFileSync(join(root, ".repos", "config.json"), "{not json");
			const store = yield* ReposConfigStore;
			const error = yield* Effect.flip(store.read(root));
			expect(error.kind).toBe("invalid");
		}),
	);

	it.effect("fails with ReposConfigError kind invalid on schema violation", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			mkdirSync(join(root, ".repos"), { recursive: true });
			writeFileSync(join(root, ".repos", "config.json"), JSON.stringify({ repos: { x: { url: "u" } } }));
			const store = yield* ReposConfigStore;
			const error = yield* Effect.flip(store.read(root));
			expect(error.kind).toBe("invalid");
		}),
	);

	it.effect("fails with ReposConfigError kind missing when the manifest file does not exist", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			const error = yield* Effect.flip(store.read(root));
			expect(error.kind).toBe("missing");
		}),
	);

	it.effect("no .tmp file lingers after a write", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			yield* store.write(root, manifest);
			const files = readdirSync(join(root, ".repos"));
			expect(files).toEqual(["config.json"]);
			expect(existsSync(join(root, ".repos", "config.json.tmp"))).toBe(false);
		}),
	);

	it.effect("add-on-fresh-dir still works: write creates the .repos directory and the manifest", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			yield* store.write(root, manifest);
			expect(existsSync(join(root, ".repos", "config.json"))).toBe(true);
		}),
	);

	it.effect(
		"distinguishes a stat failure from a missing file: a non-directory blocking the manifest path fails kind invalid",
		() =>
			Effect.gen(function* () {
				const root = mkdtempSync(join(tmpdir(), "repos-store-"));
				// Create a FILE where the ".repos" directory should be, so stat-ing
				// ".repos/config.json" fails with ENOTDIR rather than returning false.
				writeFileSync(join(root, ".repos"), "not a directory");
				const store = yield* ReposConfigStore;
				const error = yield* Effect.flip(store.read(root));
				expect(error.kind).toBe("invalid");
				expect(error.reason).toContain("stat failed");
			}),
	);
});
