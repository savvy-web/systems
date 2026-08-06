import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect, it, layer } from "@effect/vitest";
import { Effect, Fiber, Latch, Layer } from "effect";
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

	it.effect("update() initializes an absent manifest and persists the merge", () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			const next = yield* store.update(root, (m) => ({
				repos: { ...m.repos, spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
			}));
			expect(next.repos.spec?.purpose).toBe("spec authority");
			const out = yield* store.read(root);
			expect(out.repos.spec?.ref).toBe("1.0.0");
		}),
	);
});

// The two suites below exercise `update`'s lock-acquisition backoff, which
// sleeps for real (bounded, capped at 2s). `it.effect`'s virtual `TestClock`
// cannot drive that safely here: each retry's `fs.open` is genuine async I/O,
// so a newly-scheduled sleep is not yet registered by the time a single
// `TestClock.adjust` call drains its window (the classic real-I/O-under-a-
// virtual-clock desync). `it.live` runs against the real clock instead, so
// these stay outside the suite-boundary `layer(...)` block per house
// convention (`MethodsNonLive` has no `.live`).
it.live(
	"a fresh (young) foreign lock file still blocks until the backoff window times out",
	() =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			mkdirSync(join(root, ".repos"), { recursive: true });
			writeFileSync(join(root, ".repos", "config.json.lock"), "");
			const store = yield* ReposConfigStore;
			const error = yield* Effect.flip(store.update(root, (m) => m));
			expect(error.kind).toBe("invalid");
			expect(error.path).toContain("config.json.lock");
		}).pipe(Effect.provide(StoreLive)),
	10_000,
);

it.live(
	"a stale lock file (older than LOCK_MAX_AGE_MS) is reclaimed and update() succeeds",
	() =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			mkdirSync(join(root, ".repos"), { recursive: true });
			const lockPath = join(root, ".repos", "config.json.lock");
			writeFileSync(lockPath, "");
			// Backdate the lock's mtime well past LOCK_MAX_AGE_MS (60s) so
			// `acquireLock` reads it as abandoned by a killed holder rather than
			// as still actively held.
			const staleTime = new Date(Date.now() - 5 * 60_000);
			utimesSync(lockPath, staleTime, staleTime);
			const store = yield* ReposConfigStore;
			const next = yield* store.update(root, (m) => ({
				repos: { ...m.repos, spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } },
			}));
			expect(next.repos.spec?.purpose).toBe("spec authority");
			// The reclaimed lock is removed by the successful acquire/release
			// cycle -- no lock file should linger afterward.
			expect(existsSync(lockPath)).toBe(false);
		}).pipe(Effect.provide(StoreLive)),
	10_000,
);

it.live(
	"serializes two concurrent update() calls so neither merge is lost",
	() =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), "repos-store-"));
			const store = yield* ReposConfigStore;
			yield* store.write(root, manifest);

			const holding = yield* Latch.make();
			const proceed = yield* Latch.make();

			// Fiber 1 acquires the lock, signals it is holding it, then blocks
			// until released — forcing fiber 2 to observe a lock file that is
			// genuinely still held, not merely scheduled first.
			const fiber1 = yield* Effect.forkChild(
				store.update(root, (m) =>
					Effect.gen(function* () {
						yield* holding.open;
						yield* proceed.await;
						return {
							repos: { ...m.repos, a: { url: "https://example.com/a.git", ref: "1.0.0", purpose: "a" } },
						};
					}),
				),
			);
			yield* holding.await;

			// Fiber 2 starts while the lock is held: its first `open` attempt
			// must fail EEXIST and fall into the retry/backoff path.
			const fiber2 = yield* Effect.forkChild(
				store.update(root, (m) => ({
					repos: { ...m.repos, b: { url: "https://example.com/b.git", ref: "1.0.0", purpose: "b" } },
				})),
			);

			yield* proceed.open;
			yield* Fiber.join(fiber1);
			yield* Fiber.join(fiber2);

			const final = yield* store.read(root);
			expect(final.repos.spec).toBeDefined();
			expect(final.repos.a).toBeDefined();
			expect(final.repos.b).toBeDefined();
		}).pipe(Effect.provide(StoreLive)),
	10_000,
);
