/**
 * Tests for {@link DepsRegenDefault} — the batteries-included default
 * composition of {@link DepsRegenLive}.
 *
 * Kept in its own file (rather than folded into
 * `services__deps-regen.test.ts`) because it exercises a real git fixture
 * end-to-end through the whole default graph (real `PointInTimeWorkspace`,
 * `WorkspaceDiscovery`, `ConfigInspector`, `ChangesetConfig`, and the
 * adaptive `PublishabilityDetector`) rather than the mock-layer unit style
 * used by the rest of that file — a distinct enough test shape to warrant
 * its own home.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { DepsRegen, DepsRegenDefault } from "../../src/changesets/services/deps-regen.js";

function git(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "Test",
			GIT_AUTHOR_EMAIL: "t@example.com",
			GIT_COMMITTER_NAME: "Test",
			GIT_COMMITTER_EMAIL: "t@example.com",
		},
	});
}

const live = DepsRegenDefault.pipe(Layer.provide(NodeContext.layer));

describe("DepsRegenDefault", () => {
	it("resolves with only NodeContext.layer", async () => {
		const svc = await Effect.runPromise(DepsRegen.pipe(Effect.provide(live)));
		expect(typeof svc.plan).toBe("function");
		expect(typeof svc.execute).toBe("function");
	});
});

describe("DepsRegenDefault — silk gating end-to-end (#209 semantics through the default graph)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with two private, non-publishable
	 * packages — `@fix/priv-versioned` and `@fix/priv-ignored` — a
	 * `.changeset/config.json` with `privatePackages.version: true` and
	 * `ignore: ["@fix/priv-ignored"]`, a base commit, and a working-tree-only
	 * dependency bump in both packages' `package.json`.
	 */
	function makeFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		for (const name of ["priv-versioned", "priv-ignored"]) {
			const pkgDir = join(dir, "packages", name);
			mkdirSync(pkgDir, { recursive: true });
			writeFileSync(
				join(pkgDir, "package.json"),
				`${JSON.stringify(
					{
						name: `@fix/${name}`,
						version: "1.0.0",
						private: true,
						dependencies: { "left-pad": "^1.0.0" },
					},
					null,
					2,
				)}\n`,
			);
		}

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: ["@fix/priv-ignored"],
					privatePackages: { version: true, tag: false },
				},
				null,
				2,
			)}\n`,
		);
		// Pre-existing pure-dependency changesets for BOTH packages, so the
		// toDelete assertions can distinguish "deleted (in scope)" from
		// "left alone (ignored)".
		writeFileSync(
			join(dir, ".changeset", "stale-priv-versioned.md"),
			["---", '"@fix/priv-versioned": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);
		writeFileSync(
			join(dir, ".changeset", "stale-priv-ignored.md"),
			["---", '"@fix/priv-ignored": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		// Working-tree-only dependency bump in BOTH packages — left uncommitted
		// so `PointInTimeWorkspace.worktree()` picks it up as the "after" side.
		for (const name of ["priv-versioned", "priv-ignored"]) {
			const pkgJsonPath = join(dir, "packages", name, "package.json");
			const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
			raw.dependencies["left-pad"] = "^1.1.0";
			writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);
		}

		return dir;
	}

	it("versions the non-ignored private package and leaves the ignored one alone, through the default graph", async () => {
		const dir = makeFixture();
		dirs.push(dir);

		const plan = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.plan({ cwd: dir });
			}).pipe(Effect.provide(live)),
		);

		expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/priv-versioned"]);
		expect(plan.toDelete.map((d) => d.package)).toEqual(["@fix/priv-versioned"]);
		expect(plan.toDelete.map((d) => d.file)).toEqual([join(dir, ".changeset", "stale-priv-versioned.md")]);
	});
});

describe("DepsRegenDefault — genuinely publishable package (regression: publishable set must not be silently empty)", () => {
	const dirs: string[] = [];

	afterEach(() => {
		while (dirs.length > 0) {
			const d = dirs.pop();
			if (d) rmSync(d, { recursive: true, force: true });
		}
	});

	/**
	 * Real pnpm-workspace git fixture with ONE publishable package —
	 * `@fix/pub` (`publishConfig.access: "public"`, NOT private) — and NO
	 * `privatePackages.version` / `ignore` gating in play. This isolates the
	 * `publishable` half of the "versionable minus ignored" gate: if
	 * `listPublishablePackageNames` is ever passed the wrong `root` again
	 * (e.g. a package's own directory instead of the project root), the
	 * adaptive detector's `.changeset/config.json` lookup silently misses,
	 * `mode` resolves to `"none"`, and this package would wrongly disappear
	 * from the plan even though it is the primary use case `DepsRegenDefault`
	 * exists for.
	 */
	function makePublishableFixture(): string {
		const dir = mkdtempSync(join(tmpdir(), "depsregen-default-pub-"));

		writeFileSync(
			join(dir, "package.json"),
			`${JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2)}\n`,
		);
		writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
		writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

		const pkgDir = join(dir, "packages", "pub");
		mkdirSync(pkgDir, { recursive: true });
		writeFileSync(
			join(pkgDir, "package.json"),
			`${JSON.stringify(
				{
					name: "@fix/pub",
					version: "1.0.0",
					publishConfig: { access: "public" },
					dependencies: { "left-pad": "^1.0.0" },
				},
				null,
				2,
			)}\n`,
		);

		mkdirSync(join(dir, ".changeset"), { recursive: true });
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			`${JSON.stringify(
				{
					$schema: "https://unpkg.com/@changesets/config@3.1.1/schema.json",
					changelog: ["@savvy-web/changesets/changelog", {}],
					commit: false,
					access: "restricted",
					baseBranch: "main",
					updateInternalDependencies: "patch",
					ignore: [],
				},
				null,
				2,
			)}\n`,
		);
		writeFileSync(
			join(dir, ".changeset", "stale-pub.md"),
			["---", '"@fix/pub": patch', "---", "", "## Dependencies", "", "(old table)", ""].join("\n"),
		);

		git(dir, "init", "--quiet", "-b", "main");
		git(dir, "config", "commit.gpgsign", "false");
		git(dir, "add", "-A");
		git(dir, "commit", "--quiet", "-m", "base commit");

		const pkgJsonPath = join(pkgDir, "package.json");
		const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { dependencies: Record<string, string> };
		raw.dependencies["left-pad"] = "^1.1.0";
		writeFileSync(pkgJsonPath, `${JSON.stringify(raw, null, 2)}\n`);

		return dir;
	}

	it("plans a fresh changeset AND deletes the stale one for a publishConfig.access:public package", async () => {
		const dir = makePublishableFixture();
		dirs.push(dir);

		const plan = await Effect.runPromise(
			Effect.gen(function* () {
				const svc = yield* DepsRegen;
				return yield* svc.plan({ cwd: dir });
			}).pipe(Effect.provide(live)),
		);

		expect(plan.toWrite.map((w) => w.package)).toEqual(["@fix/pub"]);
		expect(plan.toDelete.map((d) => d.package)).toEqual(["@fix/pub"]);
		expect(plan.toDelete.map((d) => d.file)).toEqual([join(dir, ".changeset", "stale-pub.md")]);
	});
});
