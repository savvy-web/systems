import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { WorkspaceDiscovery, WorkspacePackage } from "@effected/workspaces";
import { Effect, Layer, Logger } from "effect";
import { collectTargets, removeTargets, runClean } from "../src/commands/clean.js";

/** Suppresses the command's INFO logging so test output stays clean. */
const silentLogger = Logger.layer([]);

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
			yield* runClean({ globs: "dist,.turbo", dryRun: true }).pipe(
				Effect.provide(discoveryLayer([leafPkg, rootPkg])),
				Effect.provide(silentLogger),
			);
			expect(existsSync(join(leaf, "dist"))).toBe(true);
			expect(existsSync(join(root, ".turbo"))).toBe(true);
		}),
	);

	it.effect("live run removes leaf targets and the root target", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			const leafPkg = makePkg(leaf, false);
			yield* runClean({ globs: "dist,.turbo", dryRun: false }).pipe(
				Effect.provide(discoveryLayer([leafPkg, rootPkg])),
				Effect.provide(silentLogger),
			);
			expect(existsSync(join(leaf, "dist"))).toBe(false);
			expect(existsSync(join(root, ".turbo"))).toBe(false);
		}),
	);

	it.effect("applies DEFAULT globs when the string is empty/whitespace", () =>
		Effect.gen(function* () {
			const rootPkg = makePkg(root, true);
			yield* runClean({ globs: "  ", dryRun: false }).pipe(
				Effect.provide(discoveryLayer([rootPkg])),
				Effect.provide(silentLogger),
			);
			expect(existsSync(join(root, ".turbo"))).toBe(false); // .turbo is a default
		}),
	);
});
