import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

export const FIXTURES = join(import.meta.dirname, "fixtures");

/** Spawn `node savvy.build.ts <args>` inside a fixture; throws on non-zero exit. */
export function runFixtureBuild(fixture: string, args: string[]): void {
	const cwd = join(FIXTURES, fixture);
	rmSync(join(cwd, "dist"), { recursive: true, force: true });
	execFileSync("node", ["savvy.build.ts", ...args], { cwd, stdio: "pipe" });
}

export function fixtureDir(fixture: string): string {
	return join(FIXTURES, fixture);
}
