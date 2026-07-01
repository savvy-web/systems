/**
 * e2e: `savvy changeset deps regen` against an isolated catalog/workspace
 * monorepo, driving the REAL `CatalogResolver` (never the host workspace).
 *
 * The `regen-catalog` fixture template is copied into a fresh temp dir
 * OUTSIDE the host repo, `git init`-ed, and committed as the base ref.
 * A working-tree edit then adds a `catalog:silk` and a `workspace:*`
 * dependency (plus a `devDependency`) to `@fixture/catalog-consumer`.
 *
 * Because the built `savvy` binary is spawned with `cwd` set to the temp
 * fixture, `workspaces-effect`'s `CatalogResolver` (which roots at
 * `process.cwd()`) resolves against the fixture's own `pnpm-workspace.yaml`
 * and `packages/sibling`, not the host monorepo. This is the missing
 * REAL-resolver coverage for the unit-tested (mocked-resolver) DepsRegen
 * service.
 *
 * Assertions:
 * - the emitted `## Dependencies` table `To` cells are CONCRETE versions
 *   (resolution happened) — `catalog:silk` → `^3.21.4`, `workspace:*` → `3.4.5`
 *   — never the raw protocol strings;
 * - `savvy changeset check` passes on the fixture;
 * - markdownlint (the pre-commit custom-rule path) passes on the emitted file;
 * - no `devDependency` rows are present.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/** Built `savvy` bin, resolved through the linked `@savvy-web/cli` dist/dev artifact. */
const SAVVY_BIN = join(dirname(require.resolve("@savvy-web/cli/package.json")), "bin/savvy.js");

const FIXTURE_TEMPLATE = join(import.meta.dirname, "fixtures", "regen-catalog");

/**
 * `process.env` minus `NODE_V8_COVERAGE` so spawned subprocesses don't write
 * coverage temp files that race vitest's V8 provider (see e2e/CLAUDE.md).
 */
const { NODE_V8_COVERAGE: _omit, ...SPAWN_ENV } = process.env;

/** Deterministic git identity for the fixture's base commit. */
const GIT_ID = ["-c", "user.email=e2e@savvy.test", "-c", "user.name=e2e", "-c", "commit.gpgsign=false"];

function git(cwd: string, args: string[]): void {
	execFileSync("git", [...GIT_ID, ...args], { cwd, stdio: "pipe", env: SPAWN_ENV });
}

let repo: string;

beforeAll(() => {
	// Copy the fixture template into a fresh temp dir OUTSIDE the host repo so
	// the resolver's root-walk can never climb into the host workspace.
	repo = mkdtempSync(join(tmpdir(), "silk-regen-catalog-"));
	cpSync(FIXTURE_TEMPLATE, repo, { recursive: true });

	// Base ref: catalog-consumer with no changing deps yet.
	git(repo, ["init", "-b", "main"]);
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-qm", "base", "--no-gpg-sign"]);

	// Working-tree change: add a catalog: dep, a workspace: dep, and a devDep.
	const pkgPath = join(repo, "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
	pkg.dependencies = { effect: "catalog:silk", "@fixture/sibling": "workspace:*" };
	pkg.devDependencies = { "some-dev-tool": "^1.0.0" };
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
});

afterAll(() => {
	if (repo) rmSync(repo, { recursive: true, force: true });
});

/** Read the single generated changeset (excludes README.md / config.json). */
function readEmittedChangeset(): { path: string; content: string } {
	const dir = join(repo, ".changeset");
	const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
	expect(files).toHaveLength(1);
	const path = join(dir, files[0] as string);
	return { path, content: readFileSync(path, "utf8") };
}

describe("e2e: deps regen resolves catalog/workspace deps to concrete versions", () => {
	it("emits a CSH005-valid Dependencies table with resolved versions, no devDeps", () => {
		// `--package` scopes the diff to the target package (bypassing the
		// publishability filter) and runs the REAL resolver against the fixture.
		execFileSync("node", [SAVVY_BIN, "changeset", "deps", "regen", "--package", "@fixture/catalog-consumer"], {
			cwd: repo,
			stdio: "pipe",
			env: SPAWN_ENV,
		});

		const { content } = readEmittedChangeset();

		// Resolution actually happened: raw protocol specifiers are gone.
		expect(content).not.toContain("catalog:");
		expect(content).not.toContain("workspace:");

		// The `To` cells carry concrete versions, not the raw specifiers.
		const effectRow = content.split("\n").find((l) => /^\|\s*effect\s*\|/.test(l));
		const siblingRow = content.split("\n").find((l) => /^\|\s*@fixture\/sibling\s*\|/.test(l));
		expect(effectRow, "effect dependency row present").toBeDefined();
		expect(siblingRow, "@fixture/sibling dependency row present").toBeDefined();
		// catalog:silk (effect) → ^3.21.4 ; workspace:* (@fixture/sibling) → 3.4.5
		expect(effectRow).toContain("^3.21.4");
		expect(siblingRow).toContain("3.4.5");

		// devDependency rows are dropped by regen.
		expect(content).not.toContain("devDependency");
		expect(content).not.toContain("some-dev-tool");
	}, 120_000);

	it("passes `savvy changeset check`", () => {
		// Re-run inside `it` is unnecessary: the emitted file from the prior
		// test is on disk. Guard by regenerating if missing (test isolation).
		const dir = join(repo, ".changeset");
		if (readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").length === 0) {
			execFileSync("node", [SAVVY_BIN, "changeset", "deps", "regen", "--package", "@fixture/catalog-consumer"], {
				cwd: repo,
				stdio: "pipe",
				env: SPAWN_ENV,
			});
		}
		// `savvy changeset check` exits non-zero on any lint error; a throw fails the test.
		const out = execFileSync("node", [SAVVY_BIN, "changeset", "check", ".changeset"], {
			cwd: repo,
			stdio: "pipe",
			env: SPAWN_ENV,
			encoding: "utf8",
		});
		expect(out).toMatch(/passed validation/i);
	}, 120_000);

	it("passes markdownlint (the pre-commit custom-rule path)", async () => {
		const { path } = readEmittedChangeset();

		// Resolve the markdownlint engine through markdownlint-cli2 (the
		// pre-commit runner) and the silk custom rules exactly as the
		// `.changeset/.markdownlint.json` config wires them.
		const cli2 = require.resolve("markdownlint-cli2");
		const cli2Require = createRequire(cli2);
		const { lint } = (await import(cli2Require.resolve("markdownlint/sync"))) as {
			lint: (opts: unknown) => Record<string, unknown[]>;
		};
		const rulesMod = (await import(require.resolve("@savvy-web/silk/changesets/markdownlint"))) as {
			default: unknown[];
		};

		const results = lint({
			files: [path],
			config: {
				default: false,
				"changeset-heading-hierarchy": true,
				"changeset-required-sections": true,
				"changeset-content-structure": true,
				"changeset-uncategorized-content": true,
				"changeset-dependency-table-format": true,
			},
			customRules: rulesMod.default,
		});

		expect(rulesMod.default).toHaveLength(5);
		expect(results[path]).toEqual([]);
	}, 120_000);
});
