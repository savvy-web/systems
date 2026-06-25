import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceDiscovery, WorkspacePackage } from "workspaces-effect";
import { collectTargets, removeTargets, runClean } from "../src/commands/clean.js";

const run = <A, E>(eff: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(eff);

/** Suppresses the command's INFO logging so test output stays clean. */
const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

describe("collectTargets", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "clean-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("matches only top-level entries for a bare pattern", async () => {
		mkdirSync(join(dir, "dist"));
		mkdirSync(join(dir, "sub"));
		mkdirSync(join(dir, "sub", "dist"), { recursive: true });
		const targets = await run(collectTargets(dir, ["dist"]));
		const paths = targets.map((t) => t.path);
		expect(paths).toEqual([join(dir, "dist")]);
		expect(targets[0].kind).toBe("dir");
	});

	it("classifies files vs directories", async () => {
		mkdirSync(join(dir, "coverage"));
		writeFileSync(join(dir, "tsconfig.tsbuildinfo"), "x");
		const targets = await run(collectTargets(dir, ["coverage", "tsconfig.tsbuildinfo"]));
		const byPath = Object.fromEntries(targets.map((t) => [t.path, t.kind]));
		expect(byPath[join(dir, "coverage")]).toBe("dir");
		expect(byPath[join(dir, "tsconfig.tsbuildinfo")]).toBe("file");
	});

	it("recurses with ** but does not descend into node_modules", async () => {
		mkdirSync(join(dir, "pkg", "dist"), { recursive: true });
		mkdirSync(join(dir, "node_modules", "x", "dist"), { recursive: true });
		const targets = await run(collectTargets(dir, ["**/dist"]));
		const paths = targets.map((t) => t.path);
		expect(paths).toContain(join(dir, "pkg", "dist"));
		expect(paths).not.toContain(join(dir, "node_modules", "x", "dist"));
	});

	it("still matches a top-level node_modules directly", async () => {
		mkdirSync(join(dir, "node_modules"));
		const targets = await run(collectTargets(dir, ["node_modules"]));
		expect(targets.map((t) => t.path)).toEqual([join(dir, "node_modules")]);
	});

	it("never returns the workspace root or its package.json", async () => {
		writeFileSync(join(dir, "package.json"), "{}");
		const targets = await run(collectTargets(dir, ["**/*", "."]));
		expect(targets.map((t) => t.path)).not.toContain(dir);
		expect(targets.map((t) => t.path)).not.toContain(join(dir, "package.json"));
	});

	it("rejects matches that escape the workspace root via symlink", async () => {
		const outside = mkdtempSync(join(tmpdir(), "outside-"));
		mkdirSync(join(outside, "secret"));
		symlinkSync(join(outside, "secret"), join(dir, "dist"), "dir");
		const targets = await run(collectTargets(dir, ["dist"]));
		expect(targets).toEqual([]);
		rmSync(outside, { recursive: true, force: true });
	});

	it("returns an empty list when no patterns match", async () => {
		const targets = await run(collectTargets(dir, ["dist", "coverage"]));
		expect(targets).toEqual([]);
	});

	it("never returns package.json when the workspace root path is a symlink or non-normalized", async () => {
		const realRoot = mkdtempSync(join(tmpdir(), "real-root-"));
		writeFileSync(join(realRoot, "package.json"), "{}");
		mkdirSync(join(realRoot, "dist"));
		const linkRoot = join(dir, "linked-root");
		symlinkSync(realRoot, linkRoot, "dir");
		// Trailing separator: glob normalizes entry.parentPath without it, so a
		// raw `parentPath === pkgPath` guard fails to match — only a realpath-based
		// guard against `<rootReal>/package.json` survives this.
		const pkgPath = linkRoot + sep;
		const targets = await run(collectTargets(pkgPath, ["package.json", "dist"]));
		const names = targets.map((t) => t.path);
		expect(names).not.toContain(join(linkRoot, "package.json"));
		expect(names).toContain(join(linkRoot, "dist"));
		rmSync(realRoot, { recursive: true, force: true });
	});
});

describe("removeTargets", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "clean-rm-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	it("dry-run deletes nothing but reports every target", async () => {
		mkdirSync(join(dir, "dist"));
		const targets = [{ path: join(dir, "dist"), kind: "dir" as const }];
		const report = await run(removeTargets(targets, true));
		expect(existsSync(join(dir, "dist"))).toBe(true);
		expect(report.removed).toHaveLength(1);
		expect(report.failed).toHaveLength(0);
	});

	it("live run removes directories recursively and files", async () => {
		mkdirSync(join(dir, "dist", "nested"), { recursive: true });
		writeFileSync(join(dir, "dist", "nested", "a.js"), "x");
		writeFileSync(join(dir, "f.tsbuildinfo"), "x");
		const targets = [
			{ path: join(dir, "dist"), kind: "dir" as const },
			{ path: join(dir, "f.tsbuildinfo"), kind: "file" as const },
		];
		const report = await run(removeTargets(targets, false));
		expect(existsSync(join(dir, "dist"))).toBe(false);
		expect(existsSync(join(dir, "f.tsbuildinfo"))).toBe(false);
		expect(report.removed).toHaveLength(2);
		expect(report.failed).toHaveLength(0);
	});

	it("treats an already-missing target as removed (force)", async () => {
		const report = await run(removeTargets([{ path: join(dir, "gone"), kind: "dir" as const }], false));
		expect(report.removed).toHaveLength(1);
		expect(report.failed).toHaveLength(0);
	});

	it("collects a non-removable target as a failure without aborting the rest", async () => {
		// Root bypasses filesystem permissions, so the EACCES we rely on never
		// fires — skip rather than produce a false pass.
		if (process.getuid?.() === 0) return;
		mkdirSync(join(dir, "keep"));
		const locked = join(dir, "locked");
		mkdirSync(join(locked, "child"), { recursive: true });
		chmodSync(locked, 0o555); // read+execute, no write: rm of child fails
		try {
			const report = await run(
				removeTargets(
					[
						{ path: join(dir, "keep"), kind: "dir" as const },
						{ path: join(locked, "child"), kind: "dir" as const },
					],
					false,
				),
			);
			expect(existsSync(join(dir, "keep"))).toBe(false);
			expect(report.removed).toHaveLength(1);
			expect(report.removed[0].path).toBe(join(dir, "keep"));
			expect(report.failed).toHaveLength(1);
			expect(report.failed[0].target.path).toBe(join(locked, "child"));
		} finally {
			chmodSync(locked, 0o755); // restore so afterEach cleanup can remove it
		}
	});
});

const makePkg = (path: string, isRoot: boolean): WorkspacePackage =>
	WorkspacePackage.make({
		name: isRoot ? "root" : `p-${path.length}`,
		version: "0.0.0",
		path,
		packageJsonPath: join(path, "package.json"),
		relativePath: isRoot ? "." : "pkg",
	});

const discoveryLayer = (pkgs: ReadonlyArray<WorkspacePackage>) =>
	Layer.succeed(WorkspaceDiscovery, {
		listPackages: () => Effect.succeed(pkgs),
		getPackage: () => Effect.die("unused"),
		importerMap: () => Effect.die("unused"),
		refresh: () => Effect.void,
	});

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

	it("dry-run reports targets across leaf and root without deleting", async () => {
		const rootPkg = makePkg(root, true);
		const leafPkg = makePkg(leaf, false);
		await run(
			runClean({ globs: "dist,.turbo", dryRun: true }).pipe(
				Effect.provide(discoveryLayer([leafPkg, rootPkg])),
				Effect.provide(silentLogger),
			),
		);
		expect(existsSync(join(leaf, "dist"))).toBe(true);
		expect(existsSync(join(root, ".turbo"))).toBe(true);
	});

	it("live run removes leaf targets and the root target", async () => {
		const rootPkg = makePkg(root, true);
		const leafPkg = makePkg(leaf, false);
		await run(
			runClean({ globs: "dist,.turbo", dryRun: false }).pipe(
				Effect.provide(discoveryLayer([leafPkg, rootPkg])),
				Effect.provide(silentLogger),
			),
		);
		expect(existsSync(join(leaf, "dist"))).toBe(false);
		expect(existsSync(join(root, ".turbo"))).toBe(false);
	});

	it("applies DEFAULT globs when the string is empty/whitespace", async () => {
		const rootPkg = makePkg(root, true);
		await run(
			runClean({ globs: "  ", dryRun: false }).pipe(
				Effect.provide(discoveryLayer([rootPkg])),
				Effect.provide(silentLogger),
			),
		);
		expect(existsSync(join(root, ".turbo"))).toBe(false); // .turbo is a default
	});
});
