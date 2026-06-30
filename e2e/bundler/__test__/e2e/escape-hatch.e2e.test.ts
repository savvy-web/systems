import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureDir } from "./helpers.js";

const LEAF = fixtureDir("leaf-escape");

describe("e2e: escape-hatch parity", () => {
	it("raw tsdown.config.ts produces a pkg/ manifest identical to the front door", () => {
		rmSync(join(LEAF, "dist/prod/npm/pkg"), { recursive: true, force: true });
		execFileSync("node", ["savvy.build.ts", "--target", "prod"], { cwd: LEAF, stdio: "pipe" });
		const frontManifest = readFileSync(join(LEAF, "dist/prod/npm/pkg/package.json"), "utf-8");

		rmSync(join(LEAF, "dist/escape/pkg"), { recursive: true, force: true });
		execFileSync("node", ["escape-build.ts"], { cwd: LEAF, stdio: "pipe" });
		const hatchManifest = readFileSync(join(LEAF, "dist/escape/pkg/package.json"), "utf-8");

		expect(hatchManifest).toBe(frontManifest);
		expect(existsSync(join(LEAF, "dist/escape/pkg/index.js"))).toBe(true);
	}, 60_000);
});
