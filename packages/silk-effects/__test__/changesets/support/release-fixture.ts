/**
 * Builds a disposable temp workspace that @manypkg/get-packages + the
 * @changesets/* machinery can operate on, for ReleasePlanner tests.
 * Uses the @changesets/cli default changelog (always resolvable) so tests
 * validate the mechanism, not silk's specific formatter (tested elsewhere).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface FixturePackage {
	/** Directory relative to the fixture root, e.g. "packages/a". */
	readonly dir: string;
	readonly name: string;
	readonly version: string;
	/** Extra package.json fields to preserve (e.g. dependencies). */
	readonly extra?: Record<string, unknown>;
}

export interface FixtureChangeset {
	readonly id: string;
	/** Frontmatter releases, e.g. { "@scope/a": "minor" }. */
	readonly releases: Record<string, "major" | "minor" | "patch">;
	readonly summary: string;
}

export interface FixtureSpec {
	readonly packages: ReadonlyArray<FixturePackage>;
	readonly changesets: ReadonlyArray<FixtureChangeset>;
	/** Extra .changeset/config.json fields (e.g. { fixed: [["@scope/a", "@scope/b"]] }). */
	readonly configExtra?: Record<string, unknown>;
}

/** Create a temp workspace; returns its absolute root path. */
export function makeReleaseFixture(spec: FixtureSpec): string {
	const root = mkdtempSync(join(tmpdir(), "silk-relfix-"));
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: "fixture-root", version: "0.0.0", private: true }, null, 2),
	);
	// A pnpm workspace: @manypkg/get-packages v3 detects yarn/npm workspaces only
	// via their lockfiles, but pnpm via pnpm-workspace.yaml alone.
	// verifyDepsBeforeRun MUST be off here: the differential tests run
	// `pnpm exec changeset version` inside the fixture, whose node_modules is a
	// symlink into the host monorepo. Without the opt-out, pnpm's dep
	// verification decides the (foreign) modules dir is out of date and tries
	// to auto-install — aborting under no TTY (and worse, attempting to purge
	// the symlinked monorepo node_modules with one). The host repo carries the
	// same setting in its own pnpm-workspace.yaml for the same reason.
	writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\nverifyDepsBeforeRun: false\n');
	mkdirSync(join(root, ".changeset"), { recursive: true });
	writeFileSync(
		join(root, ".changeset", "config.json"),
		JSON.stringify(
			{
				$schema: "https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json",
				changelog: "@changesets/cli/changelog",
				commit: false,
				access: "restricted",
				baseBranch: "main",
				updateInternalDependencies: "patch",
				ignore: [],
				...(spec.configExtra ?? {}),
			},
			null,
			2,
		),
	);
	for (const p of spec.packages) {
		const abs = join(root, p.dir);
		mkdirSync(abs, { recursive: true });
		writeFileSync(
			join(abs, "package.json"),
			JSON.stringify({ name: p.name, version: p.version, ...(p.extra ?? {}) }, null, 2),
		);
	}
	for (const cs of spec.changesets) {
		const fm = Object.entries(cs.releases)
			.map(([name, type]) => `"${name}": ${type}`)
			.join("\n");
		writeFileSync(join(root, ".changeset", `${cs.id}.md`), `---\n${fm}\n---\n\n${cs.summary}\n`);
	}
	return root;
}

/** Read a fixture package's CHANGELOG.md (relative dir), or null if absent. */
export function readFixtureChangelog(root: string, relDir: string): string | null {
	const p = join(root, relDir, "CHANGELOG.md");
	return existsSync(p) ? readFileSync(p, "utf-8") : null;
}
