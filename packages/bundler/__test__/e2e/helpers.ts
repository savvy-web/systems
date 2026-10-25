import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

export const FIXTURES = join(import.meta.dirname, "fixtures");

/**
 * Make the BUILT `@savvy-web/bundler` resolvable from inside the fixtures by a bare specifier.
 *
 * The fixtures live inside the bundler package, but each has its own `package.json`, so Node's
 * package self-reference does not apply (the nearest scope is the fixture, not the bundler) and
 * nothing above them links the bundler either — a package cannot be its own `workspace:`
 * dependency (turbo rejects the `build:dev` self-edge). A `node_modules/@savvy-web/bundler`
 * symlink directly above the fixtures, pointing at `dist/dev/pkg`, is exactly the link a
 * `workspace:*` dependent would get: the artifact's own imports resolve through its realpath,
 * i.e. the bundler's `node_modules`. Idempotent; the link dir is gitignored.
 */
export function ensureBundlerLink(): void {
	const scope = join(FIXTURES, "node_modules", "@savvy-web");
	const link = join(scope, "bundler");
	if (existsSync(link)) return;
	mkdirSync(scope, { recursive: true });
	symlinkSync(resolve(import.meta.dirname, "..", "..", "dist", "dev", "pkg"), link, "dir");
}
ensureBundlerLink();

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
