import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { CliUiTest } from "@effected/cli/ui/testing";
import { WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import { Effect, Fiber, Layer } from "effect";
import { initialCleanState, reduceClean } from "../src/commands/clean/progress.js";
import { cleanView } from "../src/commands/clean/view.js";
import { collectTargets, removeTargets, runClean } from "../src/commands/clean.js";
import { CommandError } from "../src/internal/command-error.js";
import { Capture } from "./utils/capture.js";
import { Interactive } from "./utils/interactive.js";

describe("collectTargets", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "clean-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it.effect("matches only top-level entries for a bare pattern", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "dist"));
			mkdirSync(join(dir, "sub"));
			mkdirSync(join(dir, "sub", "dist"), { recursive: true });
			const targets = yield* collectTargets(dir, ["dist"]);
			const paths = targets.map((t) => t.path);
			expect(paths).toEqual([join(dir, "dist")]);
			expect(targets[0].kind).toBe("dir");
		}),
	);

	it.effect("classifies files vs directories", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "coverage"));
			writeFileSync(join(dir, "tsconfig.tsbuildinfo"), "x");
			const targets = yield* collectTargets(dir, ["coverage", "tsconfig.tsbuildinfo"]);
			const byPath = Object.fromEntries(targets.map((t) => [t.path, t.kind]));
			expect(byPath[join(dir, "coverage")]).toBe("dir");
			expect(byPath[join(dir, "tsconfig.tsbuildinfo")]).toBe("file");
		}),
	);

	it.effect("recurses with ** but does not descend into node_modules", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "pkg", "dist"), { recursive: true });
			mkdirSync(join(dir, "node_modules", "x", "dist"), { recursive: true });
			const targets = yield* collectTargets(dir, ["**/dist"]);
			const paths = targets.map((t) => t.path);
			expect(paths).toContain(join(dir, "pkg", "dist"));
			expect(paths).not.toContain(join(dir, "node_modules", "x", "dist"));
		}),
	);

	it.effect("still matches a top-level node_modules directly", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "node_modules"));
			const targets = yield* collectTargets(dir, ["node_modules"]);
			expect(targets.map((t) => t.path)).toEqual([join(dir, "node_modules")]);
		}),
	);

	it.effect("never returns the workspace root or its package.json", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "package.json"), "{}");
			const targets = yield* collectTargets(dir, ["**/*", "."]);
			expect(targets.map((t) => t.path)).not.toContain(dir);
			expect(targets.map((t) => t.path)).not.toContain(join(dir, "package.json"));
		}),
	);

	it.effect("rejects matches that escape the workspace root via symlink", () =>
		Effect.gen(function* () {
			const outside = mkdtempSync(join(tmpdir(), "outside-"));
			mkdirSync(join(outside, "secret"));
			symlinkSync(join(outside, "secret"), join(dir, "dist"), "dir");
			const targets = yield* collectTargets(dir, ["dist"]);
			expect(targets).toEqual([]);
			rmSync(outside, { recursive: true, force: true });
		}),
	);

	it.effect("returns an empty list when no patterns match", () =>
		Effect.gen(function* () {
			const targets = yield* collectTargets(dir, ["dist", "coverage"]);
			expect(targets).toEqual([]);
		}),
	);

	it.effect("never returns package.json when the workspace root path is a symlink or non-normalized", () =>
		Effect.gen(function* () {
			const realRoot = mkdtempSync(join(tmpdir(), "real-root-"));
			writeFileSync(join(realRoot, "package.json"), "{}");
			mkdirSync(join(realRoot, "dist"));
			const linkRoot = join(dir, "linked-root");
			symlinkSync(realRoot, linkRoot, "dir");
			// Trailing separator: glob normalizes entry.parentPath without it, so a
			// raw `parentPath === pkgPath` guard fails to match — only a realpath-based
			// guard against `<rootReal>/package.json` survives this.
			const pkgPath = linkRoot + sep;
			const targets = yield* collectTargets(pkgPath, ["package.json", "dist"]);
			const names = targets.map((t) => t.path);
			expect(names).not.toContain(join(linkRoot, "package.json"));
			expect(names).toContain(join(linkRoot, "dist"));
			rmSync(realRoot, { recursive: true, force: true });
		}),
	);
});

describe("removeTargets", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "clean-rm-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it.effect("dry-run deletes nothing but reports every target", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "dist"));
			const targets = [{ path: join(dir, "dist"), kind: "dir" as const }];
			const report = yield* removeTargets(targets, true);
			expect(existsSync(join(dir, "dist"))).toBe(true);
			expect(report.removed).toHaveLength(1);
			expect(report.failed).toHaveLength(0);
		}),
	);

	it.effect("live run removes directories recursively and files", () =>
		Effect.gen(function* () {
			mkdirSync(join(dir, "dist", "nested"), { recursive: true });
			writeFileSync(join(dir, "dist", "nested", "a.js"), "x");
			writeFileSync(join(dir, "f.tsbuildinfo"), "x");
			const targets = [
				{ path: join(dir, "dist"), kind: "dir" as const },
				{ path: join(dir, "f.tsbuildinfo"), kind: "file" as const },
			];
			const report = yield* removeTargets(targets, false);
			expect(existsSync(join(dir, "dist"))).toBe(false);
			expect(existsSync(join(dir, "f.tsbuildinfo"))).toBe(false);
			expect(report.removed).toHaveLength(2);
			expect(report.failed).toHaveLength(0);
		}),
	);

	it.effect("treats an already-missing target as removed (force)", () =>
		Effect.gen(function* () {
			const report = yield* removeTargets([{ path: join(dir, "gone"), kind: "dir" as const }], false);
			expect(report.removed).toHaveLength(1);
			expect(report.failed).toHaveLength(0);
		}),
	);

	it.effect("collects a non-removable target as a failure without aborting the rest", () =>
		Effect.gen(function* () {
			// Root bypasses filesystem permissions, so the EACCES we rely on never
			// fires — skip rather than produce a false pass.
			if (process.getuid?.() === 0) return;
			mkdirSync(join(dir, "keep"));
			const locked = join(dir, "locked");
			mkdirSync(join(locked, "child"), { recursive: true });
			chmodSync(locked, 0o555); // read+execute, no write: rm of child fails
			try {
				const report = yield* removeTargets(
					[
						{ path: join(dir, "keep"), kind: "dir" as const },
						{ path: join(locked, "child"), kind: "dir" as const },
					],
					false,
				);
				expect(existsSync(join(dir, "keep"))).toBe(false);
				expect(report.removed).toHaveLength(1);
				expect(report.removed[0].path).toBe(join(dir, "keep"));
				expect(report.failed).toHaveLength(1);
				expect(report.failed[0].target.path).toBe(join(locked, "child"));
			} finally {
				chmodSync(locked, 0o755); // restore so afterEach cleanup can remove it
			}
		}),
	);
});

const makePkg = (path: string, isRoot: boolean): WorkspacePackage =>
	WorkspacePackage.make({
		name: isRoot ? "root" : `p-${path.length}`,
		version: "0.0.0",
		path,
		packageJsonPath: join(path, "package.json"),
		relativePath: isRoot ? "." : "pkg",
		workspaceRoot: isRoot ? path : join(path, ".."),
	});

const discoveryLayer = (pkgs: ReadonlyArray<WorkspacePackage>) =>
	Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed(pkgs),
		getPackage: () => Effect.die("unused"),
		importerMap: () => Effect.die("unused"),
		info: () => Effect.die("unused"),
		resolveFile: () => Effect.die("unused"),
		resolveFiles: () => Effect.die("unused"),
		refresh: () => Effect.void,
	} as never);

describe("runClean", () => {
	let root: string;
	let leaf: string;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "ws-"));
		leaf = join(root, "packages", "a");
		mkdirSync(join(leaf, "dist"), { recursive: true });
		mkdirSync(join(root, ".turbo"), { recursive: true });
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it.effect("dry-run reports targets across leaf and root without deleting", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			const { stdout } = yield* Capture.run(
				runClean({ globs: "dist,.turbo", dryRun: true }).pipe(Effect.provide(discoveryLayer([leafPkg, rootPkg]))),
			);
			// One entry per printed document (each workspace group, then the summary).
			expect(stdout.join("\n")).toEqual(
				[
					"",
					"pkg",
					`  would remove [dir] ${join(leaf, "dist")}`,
					"",
					"<root>",
					`  would remove [dir] ${join(root, ".turbo")}`,
					"",
					"✓ Would remove 2 item(s)",
				].join("\n"),
			);
			expect(existsSync(join(leaf, "dist"))).toBe(true);
			expect(existsSync(join(root, ".turbo"))).toBe(true);
		}),
	);

	it.effect("live run removes leaf targets and the root target", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			const { stdout } = yield* Capture.run(
				runClean({ globs: "dist,.turbo", dryRun: false }).pipe(Effect.provide(discoveryLayer([leafPkg, rootPkg]))),
			);
			expect(stdout.join("\n").split("\n").at(-1)).toBe("✓ Removed 2 item(s)");
			expect(existsSync(join(leaf, "dist"))).toBe(false);
			expect(existsSync(join(root, ".turbo"))).toBe(false);
		}),
	);

	it.effect("a later workspace's failure leaves the earlier workspace's lines on stdout", () =>
		Effect.gen(function* () {
			// root can remove anything regardless of mode bits
			if (process.getuid?.() === 0) return;
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			const turbo = join(root, ".turbo");
			writeFileSync(join(turbo, "cache"), "x");
			chmodSync(turbo, 0o555); // no write: rm of its child fails, so the root's removal fails
			try {
				const { value: error, stdout } = yield* Capture.run(
					Effect.flip(
						runClean({ globs: "dist,.turbo", dryRun: false }).pipe(Effect.provide(discoveryLayer([leafPkg, rootPkg]))),
					),
				);
				expect(error).toBeInstanceOf(CommandError);
				expect(error.message).toBe("1 target(s) could not be removed");
				expect(error.detail?.[0]?.startsWith(`${turbo}: `)).toBe(true);
				// The leaf printed as its own document before the root was attempted.
				expect(stdout[0]).toBe(["", "pkg", `  removed [dir] ${join(leaf, "dist")}`].join("\n"));
				const lines = stdout.join("\n").split("\n");
				expect(lines.slice(3, 5)).toEqual(["", "<root>"]);
				expect(lines[5]?.startsWith(`⚠ failed [dir] ${turbo}: `)).toBe(true);
				expect(lines.slice(6)).toEqual(["", "✓ Removed 1 item(s)"]);
				expect(existsSync(join(leaf, "dist"))).toBe(false);
			} finally {
				chmodSync(turbo, 0o755); // restore so afterEach cleanup can remove it
			}
		}),
	);

	it.effect("applies DEFAULT globs when the string is empty/whitespace", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			yield* Capture.run(runClean({ globs: "  ", dryRun: false }).pipe(Effect.provide(discoveryLayer([rootPkg]))));
			expect(existsSync(join(root, ".turbo"))).toBe(false); // .turbo is a default
		}),
	);

	it.effect("targets that cannot be removed draw a CommandError with a hint on stderr and exit 1", () =>
		Effect.gen(function* () {
			if (process.getuid?.() === 0) return;
			const rootPkg = makePkg(root, true);
			const turbo = join(root, ".turbo");
			writeFileSync(join(turbo, "cache"), "x");
			chmodSync(turbo, 0o555);
			try {
				const result = yield* Capture.main(
					runClean({ globs: ".turbo", dryRun: false }).pipe(Effect.provide(discoveryLayer([rootPkg]))),
				);
				expect(result.exitCode).toBe(1);
				const stderr = result.stderr.join("\n");
				expect(stderr).toContain("✗ 1 target(s) could not be removed");
				expect(stderr).toContain(`${turbo}: `);
				expect(stderr).toContain("re-run savvy clean");
			} finally {
				chmodSync(turbo, 0o755);
			}
		}),
	);

	it.effect("a person at a terminal gets the live view, not the plain documents", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			const { session, fiber } = yield* Interactive.run(
				runClean({ globs: "dist,.turbo", dryRun: false }).pipe(Effect.provide(discoveryLayer([leafPkg, rootPkg]))),
			);
			const result = yield* Fiber.join(fiber);
			// Every line went to the view's console (above the frame), none to the
			// program's own stdout, and no plain total was printed.
			expect(result.stdout).toEqual([]);
			// The live run mounted once on the session's terminal; its committed frame is the summary.
			expect(yield* session.mounts).toBe(1);
			const frame = yield* (yield* session.next()).plainFrame;
			expect(frame).toContain("2 removed");
			expect(frame).not.toContain("failed");
			expect(existsSync(join(leaf, "dist"))).toBe(false);
			expect(existsSync(join(root, ".turbo"))).toBe(false);
		}).pipe(Effect.scoped),
	);

	it.effect("a run that cannot prompt prints exactly the plain documents", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			const { session, fiber } = yield* Interactive.run(
				runClean({ globs: "dist,.turbo", dryRun: true }).pipe(Effect.provide(discoveryLayer([leafPkg, rootPkg]))),
				{ interactive: false },
			);
			const result = yield* Fiber.join(fiber);
			expect(result.stdout.join("\n")).toEqual(
				[
					"",
					"pkg",
					`  would remove [dir] ${join(leaf, "dist")}`,
					"",
					"<root>",
					`  would remove [dir] ${join(root, ".turbo")}`,
					"",
					"✓ Would remove 2 item(s)",
				].join("\n"),
			);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);
});

describe("clean live view", () => {
	const dist = { path: "/repo/packages/a/dist", kind: "dir" as const };
	const turbo = { path: "/repo/.turbo", kind: "dir" as const };

	it("folds workspaces into counts and failures, and a start begins afresh", () => {
		const done = [
			{ _tag: "Started", workspaces: 2, dryRun: false } as const,
			{ _tag: "WorkspaceStarted", name: "packages/a" } as const,
			{ _tag: "WorkspaceDone", name: "packages/a", removed: [dist], failed: [] } as const,
			{ _tag: "WorkspaceDone", name: "<root>", removed: [], failed: [{ target: turbo, reason: "EACCES" }] } as const,
			{ _tag: "Ended" } as const,
		].reduce(reduceClean, initialCleanState);
		expect(done).toMatchObject({ phase: "done", finished: 2, removed: 1, failed: [{ reason: "EACCES" }] });
		expect(reduceClean(done, { _tag: "Started", workspaces: 1, dryRun: true })).toMatchObject({
			phase: "running",
			removed: 0,
			failed: [],
			dryRun: true,
		});
	});

	it.effect("shows progress while running, then commits the counts and a failure table", () =>
		Effect.gen(function* () {
			const view = yield* CliUiTest.live({ ...cleanView, color: "none", columns: 100 });
			yield* view.publish({ _tag: "Started", workspaces: 2, dryRun: false });
			yield* view.publish({ _tag: "WorkspaceStarted", name: "packages/a" });
			expect(yield* view.plainFrame).toContain("Cleaning packages/a (0/2 workspaces)");
			yield* view.publish({ _tag: "WorkspaceDone", name: "packages/a", removed: [dist], failed: [] });
			yield* view.publish({
				_tag: "WorkspaceDone",
				name: "<root>",
				removed: [],
				failed: [{ target: turbo, reason: "EACCES: permission denied" }],
			});
			yield* view.publish({ _tag: "Ended" });
			yield* view.end;
			const transcript = yield* view.transcript;
			expect(transcript).toContain("1 removed");
			expect(transcript).toContain("1 failed");
			expect(transcript).toContain("could not remove");
			expect(transcript).toContain("/repo/.turbo");
			expect(transcript).toContain("EACCES: permission denied");
		}).pipe(Effect.scoped),
	);
});
