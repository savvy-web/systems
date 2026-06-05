import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures", "jsx");

describe("jsx build (real, automatic runtime inherited from tsconfig)", () => {
	it("builds a .tsx entry to ESM without leaving bare JSX or a React global reference", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({}), { cwd: FIX, argv: ["--target", "dev"], writeOutput: () => {} });
		const out = readFileSync(join(FIX, "dist/dev/pkg/index.js"), "utf-8");
		// automatic runtime imports from react/jsx-runtime; classic React.createElement must NOT appear
		expect(out).toMatch(/react\/jsx-runtime/);
		expect(out).not.toMatch(/React\.createElement/);
	}, 60_000);
});
