// packages/bundler/__test__/run-exe-in-dev.test.ts
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { defineBuild } from "../src/config.js";
import { runBuild } from "../src/run.js";

function scaffold(prefix: string): string {
	const cwd = mkdtempSync(join(tmpdir(), prefix));
	mkdirSync(join(cwd, "src"), { recursive: true });
	writeFileSync(join(cwd, "src/bin.ts"), "console.log('hi')\n");
	writeFileSync(
		join(cwd, "package.json"),
		JSON.stringify({
			name: "p",
			version: "1.0.0",
			type: "module",
			os: ["darwin"],
			cpu: ["arm64"],
			exports: { ".": "./src/bin.ts", "./package.json": "./package.json" },
		}),
	);
	return cwd;
}

const readManifest = (cwd: string): Record<string, unknown> =>
	JSON.parse(readFileSync(join(cwd, "dist", "dev", "pkg", "package.json"), "utf-8"));

describe("runBuild --target dev with exe (exe-only)", () => {
	it("programs exports['.'] + files and compiles the SEA into pkg/bin", async () => {
		const cwd = scaffold("exe-dev-");
		const runExeBuild = vi.fn<(o: { cwd: string; outDir: string; specs: unknown }) => Promise<void>>(async () => {});
		await runBuild(defineBuild({ exe: { fileName: "p" } }), {
			cwd,
			argv: ["--target", "dev"],
			runExeBuild,
			readOsCpu: () => ({ os: ["darwin"], cpu: ["arm64"] }),
			writeOutput: () => {},
		});
		expect(runExeBuild).toHaveBeenCalledTimes(1);
		expect(runExeBuild.mock.calls[0]?.[0]).toMatchObject({ outDir: join(cwd, "dist", "dev", "pkg", "bin") });
		const manifest = readManifest(cwd);
		expect((manifest.exports as Record<string, unknown>)["."]).toBe("./bin/p-darwin-arm64");
		expect(manifest.files).toEqual(["bin/p-darwin-arm64"]);
	});

	it("skips the SEA compile with --no-exe but still programs the manifest", async () => {
		const cwd = scaffold("exe-noexe-");
		const runExeBuild = vi.fn<(o: { cwd: string; outDir: string; specs: unknown }) => Promise<void>>(async () => {});
		await runBuild(defineBuild({ exe: { fileName: "p" } }), {
			cwd,
			argv: ["--target", "dev", "--no-exe"],
			runExeBuild,
			readOsCpu: () => ({ os: ["darwin"], cpu: ["arm64"] }),
			writeOutput: () => {},
		});
		expect(runExeBuild).not.toHaveBeenCalled();
		const manifest = readManifest(cwd);
		expect((manifest.exports as Record<string, unknown>)["."]).toBe("./bin/p-darwin-arm64");
		expect(manifest.files).toEqual(["bin/p-darwin-arm64"]);
	});
});
