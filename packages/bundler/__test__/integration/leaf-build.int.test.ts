import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const LEAF = join(import.meta.dirname, "fixtures/leaf");

describe("leaf package end-to-end", () => {
	beforeAll(() => {
		rmSync(join(LEAF, "dist"), { recursive: true, force: true });
	});

	it("dev build emits dist/dev/pkg with index.js + index.d.ts + package.json", async () => {
		await runBuild(defineBuild({ formats: ["esm"] }), { cwd: LEAF, argv: ["--target", "dev"], writeOutput: () => {} });
		expect(existsSync(join(LEAF, "dist/dev/pkg/index.js"))).toBe(true);
		expect(existsSync(join(LEAF, "dist/dev/pkg/index.d.ts"))).toBe(true);
		const manifest = JSON.parse(readFileSync(join(LEAF, "dist/dev/pkg/package.json"), "utf-8"));
		expect(manifest.exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js" });
		expect(manifest.exports["./package.json"]).toBe("./package.json");
	});

	it("npm build emits dist/prod/npm/pkg and injects process.env.__PACKAGE_VERSION__", async () => {
		await runBuild(defineBuild({ formats: ["esm"], meta: false }), {
			cwd: LEAF,
			argv: ["--target", "prod"],
			writeOutput: () => {},
		});
		expect(existsSync(join(LEAF, "dist/prod/npm/pkg/index.js"))).toBe(true);
		const code = readFileSync(join(LEAF, "dist/prod/npm/pkg/index.js"), "utf-8");
		expect(code).toContain("1.2.3"); // define replaced process.env.__PACKAGE_VERSION__
	});
});
