import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ReposLockdown } from "../../src/repos/services/lockdown.js";

const layer = ReposLockdown.layer.pipe(Layer.provide(NodeServices.layer));
const mode = (p: string) => statSync(p).mode & 0o777;

describe("ReposLockdown", () => {
	let root: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-"));
		mkdirSync(join(root, ".repos/demo/src"), { recursive: true });
		writeFileSync(join(root, ".repos/demo/src/a.ts"), "export {}\n");
		mkdirSync(join(root, ".git/modules/.repos/demo"), { recursive: true });
		writeFileSync(join(root, ".git/modules/.repos/demo/config"), "[core]\n");
	});
	afterAll(() => {
		// unlock before rm so cleanup never fails on read-only dirs
		Effect.runSync(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "demo")),
				Effect.provide(layer),
				Effect.ignore,
			),
		);
		rmSync(root, { recursive: true, force: true });
	});

	it.effect("lock sets files 444 and dirs 555 in worktree and module dir", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "demo");
			expect(mode(join(root, ".repos/demo/src/a.ts"))).toBe(0o444);
			expect(mode(join(root, ".repos/demo/src"))).toBe(0o555);
			expect(mode(join(root, ".git/modules/.repos/demo/config"))).toBe(0o444);
		}).pipe(Effect.provide(layer)),
	);

	it.effect("unlock restores 644/755", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "demo");
			yield* lockdown.unlock(root, "demo");
			expect(mode(join(root, ".repos/demo/src/a.ts"))).toBe(0o644);
			expect(mode(join(root, ".repos/demo/src"))).toBe(0o755);
		}).pipe(Effect.provide(layer)),
	);

	it.effect("lock on a missing repo dir is a silent success", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "does-not-exist");
		}).pipe(Effect.provide(layer)),
	);

	it.effect("withUnlocked re-locks even when the inner effect fails", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "demo");
			const failure = yield* Effect.flip(lockdown.withUnlocked(root, "demo", Effect.fail("boom" as const)));
			expect(failure).toBe("boom");
			expect(mode(join(root, ".repos/demo/src/a.ts"))).toBe(0o444);
		}).pipe(Effect.provide(layer)),
	);
});

describe("ReposLockdown — divergent submodule name", () => {
	// Reproduces this repo's own `effect`/`effect-smol` split: the manifest key
	// ("divergent") differs from the module dir git actually registered the
	// submodule under ("divergent-old"). `<root>/.repos/divergent/.git` is a
	// FILE pointing at the real metadata dir via a relative `gitdir:` pointer,
	// the way a real submodule checkout looks.
	let root: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-divergent-"));
		mkdirSync(join(root, ".repos/divergent/src"), { recursive: true });
		writeFileSync(join(root, ".repos/divergent/src/a.ts"), "export {}\n");
		mkdirSync(join(root, ".git/modules/.repos/divergent-old"), { recursive: true });
		writeFileSync(join(root, ".git/modules/.repos/divergent-old/config"), "[core]\n");
		writeFileSync(join(root, ".repos/divergent/.git"), "gitdir: ../../.git/modules/.repos/divergent-old\n");
	});
	afterAll(() => {
		Effect.runSync(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "divergent")),
				Effect.provide(layer),
				Effect.ignore,
			),
		);
		rmSync(root, { recursive: true, force: true });
	});

	it.effect("lock locks the divergently-named module dir, unlock restores it", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "divergent");
			expect(mode(join(root, ".repos/divergent/src/a.ts"))).toBe(0o444);
			expect(mode(join(root, ".git/modules/.repos/divergent-old/config"))).toBe(0o444);

			yield* lockdown.unlock(root, "divergent");
			expect(mode(join(root, ".repos/divergent/src/a.ts"))).toBe(0o644);
			expect(mode(join(root, ".git/modules/.repos/divergent-old/config"))).toBe(0o644);
		}).pipe(Effect.provide(layer)),
	);
});
