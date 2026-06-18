import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveNextVersions } from "../../src/changesets/next-versions.js";

let root: string;

function pkg(dir: string, name: string, version: string, extra: Record<string, unknown> = {}): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, ...extra }));
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "nextver-"));
	// pnpm workspace so @manypkg detects it.
	writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
	pkg(root, "root", "0.0.0", { private: true });
	pkg(join(root, "packages", "a"), "@scope/a", "1.0.0");
	pkg(join(root, "packages", "b"), "@scope/b", "2.0.0");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

function writeChangesetConfig(): void {
	const dir = join(root, ".changeset");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "config.json"),
		JSON.stringify({ changelog: false, commit: false, access: "public", baseBranch: "main" }),
	);
}

function addChangeset(id: string, body: string): void {
	writeChangesetConfig();
	writeFileSync(join(root, ".changeset", `${id}.md`), body);
}

describe("resolveNextVersions", () => {
	it("returns current versions for every package when config exists but no changesets are pending", async () => {
		writeChangesetConfig(); // config only, zero changeset .md files
		const result = await resolveNextVersions(join(root, "packages", "a"));
		expect(result.versions.get("@scope/a")).toBe("1.0.0");
		expect(result.versions.get("@scope/b")).toBe("2.0.0");
	});

	it("bumps a package that has a pending changeset", async () => {
		addChangeset("bump", '---\n"@scope/a": major\n---\n\nbreaking');
		const result = await resolveNextVersions(join(root, "packages", "a"));
		expect(result.versions.get("@scope/a")).toBe("2.0.0");
		expect(result.versions.get("@scope/b")).toBe("2.0.0");
	});

	it("degrades to current versions when there is no .changeset directory", async () => {
		const result = await resolveNextVersions(join(root, "packages", "a"));
		expect(result.versions.get("@scope/a")).toBe("1.0.0");
	});

	it("returns an empty map when cwd is not a workspace", async () => {
		const lonely = mkdtempSync(join(tmpdir(), "lonely-"));
		writeFileSync(join(lonely, "package.json"), JSON.stringify({ name: "x", version: "1.0.0" }));
		const result = await resolveNextVersions(lonely);
		expect(result.versions.size).toBe(0);
		expect(result.root).toBe(lonely);
		rmSync(lonely, { recursive: true, force: true });
	});
});
