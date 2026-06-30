import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

export const FIXTURES = join(import.meta.dirname, "fixtures");

/**
 * A copy of `process.env` with `NODE_V8_COVERAGE` removed so that spawned
 * fixture builds do not write coverage temp files that race vitest's V8
 * coverage provider and cause intermittent ENOENT failures.
 */
const { NODE_V8_COVERAGE: _omit, ...SPAWN_ENV_BASE } = process.env;
export const SPAWN_ENV: NodeJS.ProcessEnv = SPAWN_ENV_BASE;

/** Spawn `node savvy.build.ts <args>` inside a fixture; throws on non-zero exit. */
export function runFixtureBuild(fixture: string, args: string[]): void {
	const cwd = join(FIXTURES, fixture);
	rmSync(join(cwd, "dist"), { recursive: true, force: true });
	execFileSync("node", ["savvy.build.ts", ...args], { cwd, stdio: "pipe", env: SPAWN_ENV });
}

export function fixtureDir(fixture: string): string {
	return join(FIXTURES, fixture);
}
