/**
 * A minimal pnpm workspace on a real tmpdir — the runtime's kit graph reads
 * the manifest, the lockfile and git state through the real platform, so a
 * memfs volume is not an option here (`workspace_info` runs the whole
 * silk-effects analyzer).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

/** Create the fixture workspace; the caller owns cleanup via {@link removeFixture}. */
export const createFixtureWorkspace = (prefix = "mcp-server-"): string => {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "root", version: "1.0.0", private: true, workspaces: ["packages/foo"] }),
	);
	writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n');
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, "packages/foo"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/package.json"), JSON.stringify({ name: "@scope/foo", version: "1.0.0" }));
	return dir;
};

export const removeFixture = (dir: string): void => {
	rmSync(dir, { recursive: true, force: true });
};

/** The fixture as a scoped resource: created on acquire, removed when the scope closes. */
export const fixtureWorkspace = (prefix?: string) =>
	Effect.acquireRelease(
		Effect.sync(() => createFixtureWorkspace(prefix)),
		(dir) => Effect.sync(() => removeFixture(dir)),
	);
