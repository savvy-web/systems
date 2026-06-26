import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
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

	// Regression (issue #170): JSX is applied via the generated tsconfig, so the bundler must NOT also
	// forward the resolved JsxConfig into tsdown's inputOptions — rolldown rejects a top-level `jsx` key
	// ("Invalid input options ... Expected never but received \"jsx\"") and warns once per build pass.
	it("emits no rolldown 'Invalid input options' warning on a JSX build", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		// rolldown's option-validation warning lands on console.warn (which writes to stderr).
		let warned = "";
		const spy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
			warned += `${args.join(" ")}\n`;
		});
		try {
			await runBuild(defineBuild({}), { cwd: FIX, argv: ["--target", "dev"], writeOutput: () => {} });
		} finally {
			spy.mockRestore();
		}
		expect(warned).not.toMatch(/Invalid input options/);
		expect(warned).not.toMatch(/received "jsx"/);
	}, 60_000);
});
