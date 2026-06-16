// packages/bundler/__test__/integration/exe-dev-build.int.test.ts
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIXTURE = join(import.meta.dirname, "fixtures/exe");
// The SEA compiles a native binary for the host; only assert the real build where it can run.
const isHostDarwinArm64 = process.platform === "darwin" && process.arch === "arm64";

describe.skipIf(!isHostDarwinArm64)("exe fixture real dev build", () => {
	it("compiles the SEA and programs the manifest (exports + files)", async () => {
		rmSync(join(FIXTURE, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ exe: { fileName: "exe-fixture" } }), {
			cwd: FIXTURE,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
		const bin = join(FIXTURE, "dist", "dev", "pkg", "bin", "exe-fixture-darwin-arm64");
		expect(existsSync(bin)).toBe(true);
		const manifest = JSON.parse(readFileSync(join(FIXTURE, "dist", "dev", "pkg", "package.json"), "utf-8"));
		expect((manifest.exports as Record<string, unknown>)["."]).toBe("./bin/exe-fixture-darwin-arm64");
		expect(manifest.files).toContain("bin/exe-fixture-darwin-arm64");
		// No JS library output for a pure-binary package.
		expect(existsSync(join(FIXTURE, "dist", "dev", "pkg", "index.js"))).toBe(false);
		rmSync(join(FIXTURE, "dist"), { recursive: true, force: true });
	}, 180_000);
});
