import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, Layer, Path, PlatformError } from "effect";
import { ReposLockdown } from "../../src/repos/services/lockdown.js";

const layer = ReposLockdown.layer.pipe(Layer.provide(NodeServices.layer));
const mode = (p: string) => statSync(p).mode & 0o777;
const isRoot = process.getuid?.() === 0;

describe("ReposLockdown", () => {
	let root: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-"));
		mkdirSync(join(root, ".repos/demo/src"), { recursive: true });
		writeFileSync(join(root, ".repos/demo/src/a.ts"), "export {}\n");
		mkdirSync(join(root, ".git/modules/.repos/demo"), { recursive: true });
		writeFileSync(join(root, ".git/modules/.repos/demo/config"), "[core]\n");
	});
	afterAll(() =>
		// unlock before rm so cleanup never fails on read-only dirs; the fs ops
		// are async, so this must be runPromise — runSync throws AsyncFiberError
		// from the hook and fails the whole suite.
		Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "demo")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
		}),
	);

	it.effect("lock sets files 444 and dirs 555 in the worktree, and leaves the module gitdir WRITABLE", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "demo");
			expect(mode(join(root, ".repos/demo/src/a.ts"))).toBe(0o444);
			expect(mode(join(root, ".repos/demo/src"))).toBe(0o555);
			// The gitdir is deliberately NOT locked: a read-only one breaks
			// `git pull`'s default submodule recursion (it cannot write
			// FETCH_HEAD) and every client that keeps per-gitdir state. See the
			// scope note on ReposLockdown.
			expect(mode(join(root, ".git/modules/.repos/demo/config"))).toBe(0o644);
		}).pipe(Effect.provide(layer)),
	);

	it.effect("unlock frees a gitdir locked by an older version, and lock never re-locks it (migration)", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			// Simulate a tree locked by the previous both-trees implementation.
			chmodSync(join(root, ".git/modules/.repos/demo/config"), 0o444);
			chmodSync(join(root, ".git/modules/.repos/demo"), 0o555);

			yield* lockdown.unlock(root, "demo");
			expect(mode(join(root, ".git/modules/.repos/demo/config"))).toBe(0o644);
			expect(mode(join(root, ".git/modules/.repos/demo"))).toBe(0o755);

			yield* lockdown.lock(root, "demo");
			expect(mode(join(root, ".git/modules/.repos/demo/config"))).toBe(0o644);
			expect(mode(join(root, ".repos/demo/src/a.ts"))).toBe(0o444);
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
	// Reproduces the re-slugged-after-vendoring split: the manifest key
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
	afterAll(() =>
		Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "divergent")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
		}),
	);

	it.effect("unlock frees the divergently-named module dir; lock leaves it alone", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			// The gitdir-pointer resolution still has to be right, but now it is
			// the UNLOCK side that depends on it: a divergently-named gitdir
			// locked by an older version can only be freed if the pointer is
			// followed rather than the manifest key assumed.
			chmodSync(join(root, ".git/modules/.repos/divergent-old/config"), 0o444);

			yield* lockdown.lock(root, "divergent");
			expect(mode(join(root, ".repos/divergent/src/a.ts"))).toBe(0o444);
			expect(mode(join(root, ".git/modules/.repos/divergent-old/config"))).toBe(0o444);

			yield* lockdown.unlock(root, "divergent");
			expect(mode(join(root, ".repos/divergent/src/a.ts"))).toBe(0o644);
			expect(mode(join(root, ".git/modules/.repos/divergent-old/config"))).toBe(0o644);
		}).pipe(Effect.provide(layer)),
	);
});

describe("ReposLockdown — gitdir pointer containment", () => {
	// A hand-edited (or otherwise malicious) `gitdir:` pointer can escape the
	// repository root entirely. `resolveModuleDir` must fall back to the
	// name-based path rather than chmod whatever the pointer resolves to.
	let root: string;
	let outside: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-escape-"));
		outside = mkdtempSync(join(tmpdir(), "lockdown-escape-outside-"));
		mkdirSync(join(root, ".repos/escaped/src"), { recursive: true });
		writeFileSync(join(root, ".repos/escaped/src/a.ts"), "export {}\n");
		writeFileSync(join(outside, "sentinel.txt"), "do not touch\n");
		// An absolute pointer that resolves outside `root` entirely.
		writeFileSync(join(root, ".repos/escaped/.git"), `gitdir: ${outside}\n`);
	});
	afterAll(() =>
		Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "escaped")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
			rmSync(outside, { recursive: true, force: true });
		}),
	);

	it.effect("lock succeeds and never chmods the target outside the repo root", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			const before = mode(outside);
			yield* lockdown.lock(root, "escaped");
			expect(mode(join(root, ".repos/escaped/src/a.ts"))).toBe(0o444);
			// The outside dir (and the sentinel file it holds) must be untouched —
			// the pointer fell back to the name-based module dir instead.
			expect(mode(outside)).toBe(before);
			expect(mode(join(outside, "sentinel.txt"))).toBe(0o644);
		}).pipe(Effect.provide(layer)),
	);
});

describe("ReposLockdown — symlink-aware walk", () => {
	// `fs.stat` follows symlinks; a symlink inside a vendored tree must never
	// cause the walk to chmod (or descend into) something outside the locked
	// root, and must never be chmod'd itself (no `lchmod` on Linux).
	let root: string;
	let outsideFile: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-symlink-"));
		outsideFile = join(tmpdir(), `lockdown-symlink-outside-${Date.now()}.txt`);
		writeFileSync(outsideFile, "do not touch\n");
		mkdirSync(join(root, ".repos/linked/src"), { recursive: true });
		writeFileSync(join(root, ".repos/linked/src/a.ts"), "export {}\n");
		symlinkSync(outsideFile, join(root, ".repos/linked/src/link.ts"));
	});
	afterAll(() =>
		Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "linked")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
			rmSync(outsideFile, { force: true });
		}),
	);

	it.effect("lock skips the symlink and never touches its target", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			const before = mode(outsideFile);
			yield* lockdown.lock(root, "linked");
			expect(mode(join(root, ".repos/linked/src/a.ts"))).toBe(0o444);
			expect(mode(outsideFile)).toBe(before);
		}).pipe(Effect.provide(layer)),
	);
});

describe("ReposLockdown — executable bit preservation", () => {
	let root: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-exec-"));
		mkdirSync(join(root, ".repos/exec/bin"), { recursive: true });
		writeFileSync(join(root, ".repos/exec/bin/run.sh"), "#!/bin/sh\necho hi\n", { mode: 0o755 });
		writeFileSync(join(root, ".repos/exec/bin/README.md"), "# readme\n", { mode: 0o644 });
	});
	afterAll(() =>
		Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "exec")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
		}),
	);

	it.effect("lock preserves 0o111 as 555, unlock restores it as 755; non-executables stay 444/644", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "exec");
			expect(mode(join(root, ".repos/exec/bin/run.sh"))).toBe(0o555);
			expect(mode(join(root, ".repos/exec/bin/README.md"))).toBe(0o444);

			yield* lockdown.unlock(root, "exec");
			expect(mode(join(root, ".repos/exec/bin/run.sh"))).toBe(0o755);
			expect(mode(join(root, ".repos/exec/bin/README.md"))).toBe(0o644);
		}).pipe(Effect.provide(layer)),
	);
});

describe.skipIf(isRoot)("ReposLockdown — withUnlocked when unlock fails part-way", () => {
	// Blocks path resolution into the module dir's ANCESTOR (not itself part of
	// the walked subtree, so the walk never gets a chance to reopen it) while
	// leaving the worktree side of the walk fully accessible. This reproduces
	// a real partial-unlock: the worktree unlocks completely before the module
	// dir side of the same `withUnlocked` call fails.
	let root: string;
	let blockedAncestor: string;
	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), "lockdown-partial-"));
		mkdirSync(join(root, ".repos/blocked/src"), { recursive: true });
		writeFileSync(join(root, ".repos/blocked/src/a.ts"), "export {}\n");
		blockedAncestor = join(root, ".git/modules/.repos");
		mkdirSync(join(blockedAncestor, "blocked"), { recursive: true });
		writeFileSync(join(blockedAncestor, "blocked/config"), "[core]\n");
	});
	afterAll(() => {
		// Restore search permission on the blocked ancestor before any cleanup
		// (including this suite's own runs) needs to traverse it again.
		chmodSync(blockedAncestor, 0o755);
		return Effect.runPromise(
			ReposLockdown.pipe(
				Effect.flatMap((l) => l.unlock(root, "blocked")),
				Effect.provide(layer),
				Effect.ignore,
			),
		).then(() => {
			rmSync(root, { recursive: true, force: true });
		});
	});

	it.effect("fails AND re-locks the reachable part of the tree afterward", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			yield* lockdown.lock(root, "blocked");
			expect(mode(join(root, ".repos/blocked/src/a.ts"))).toBe(0o444);

			// Block path resolution THROUGH `.git/modules/.repos` — the module
			// dir's PARENT, not part of the walked subtree itself — so
			// `withUnlocked`'s unlock walk reaches the worktree side fine and
			// only fails resolving into the module dir side.
			chmodSync(blockedAncestor, 0o000);

			const failure = yield* Effect.flip(lockdown.withUnlocked(root, "blocked", Effect.void));
			expect(failure._tag).toBe("ReposLockdownError");

			// The worktree side (fully reachable) unlocked and then got
			// re-locked back to 444/555 by the finalizer.
			expect(mode(join(root, ".repos/blocked/src/a.ts"))).toBe(0o444);
			expect(mode(join(root, ".repos/blocked/src"))).toBe(0o555);

			// Restore so this test's own afterAll cleanup can traverse it.
			chmodSync(blockedAncestor, 0o755);
		}).pipe(Effect.provide(layer)),
	);
});

describe("ReposLockdown — withUnlocked relock-failure propagation", () => {
	// A `FileSystem` stub whose `chmod` succeeds for the unlock pass (dir mode
	// 0o755) but fails for the lock/relock pass (dir mode 0o555), isolating
	// the case where the inner effect succeeds but the relock finalizer does
	// not — the relock failure must be the one that surfaces.
	const relockFailure = PlatformError.systemError({
		_tag: "PermissionDenied",
		module: "FileSystem",
		method: "chmod",
	});

	// A REAL volume with one injected fault, rather than a `layerNoop` stub.
	//
	// The stub this replaces was deny-by-default, so isolating a single failing
	// `chmod` meant hand-building every other method the walk touches — and the
	// price was `readDirectory: () => Effect.succeed([])`. The walk then had
	// nothing to recurse into, so these two tests proved the finalizer contract
	// over an EMPTY tree and could never reach the lock-recursion-order
	// invariant (lock chmods a directory after recursing, unlock before).
	//
	// Here the volume is real and recursive; only `chmod` is intercepted, keyed
	// on the target mode so the unlock pass (0o755) delegates to the volume and
	// the lock/relock pass (0o555/0o444) fails. Everything else — readDirectory,
	// stat, readLink — is the genuine filesystem.
	const Volume = MemoryFileSystem.layerWith({
		"/root/.repos/stub-repo/src/a.ts": "export {}\n",
		"/root/.repos/stub-repo/src/nested/b.ts": "export {}\n",
		"/root/.repos/stub-repo/bin.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
	});

	const stubLayer = ReposLockdown.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				MemoryFileSystem.layerFaulty({
					chmod: (_path, targetMode) =>
						targetMode === 0o555 || targetMode === 0o444 ? Effect.fail(relockFailure) : undefined,
				}).pipe(Layer.provide(Volume)),
				Path.layer,
			),
		),
	);

	it.effect("propagates the relock failure when the inner effect succeeds", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			const failure = yield* Effect.flip(lockdown.withUnlocked("/root", "stub-repo", Effect.void));
			expect(failure._tag).toBe("ReposLockdownError");
		}).pipe(Effect.provide(stubLayer)),
	);

	it.effect("prefers the inner effect's failure and swallows a relock failure", () =>
		Effect.gen(function* () {
			const lockdown = yield* ReposLockdown;
			const failure = yield* Effect.flip(
				lockdown.withUnlocked("/root", "stub-repo", Effect.fail("inner-boom" as const)),
			);
			expect(failure).toBe("inner-boom");
		}).pipe(Effect.provide(stubLayer)),
	);
});
