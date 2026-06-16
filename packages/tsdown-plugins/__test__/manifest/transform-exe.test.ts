// packages/tsdown-plugins/__test__/manifest/transform-exe.test.ts
import { describe, expect, it } from "vitest";
import { transformManifest } from "../../src/manifest/transform.js";

describe("transformManifest exeRewrite", () => {
	const rewrite = { source: "./src/bin.ts", fileName: "vitest-agent-sidecar-darwin-arm64", dir: "bin" };

	it("rewrites the matching '.' export to the SEA path and adds it to files", () => {
		const out = transformManifest(
			{ exports: { ".": "./src/bin.ts", "./package.json": "./package.json" }, version: "1.0.0" },
			{ exeRewrite: rewrite },
		);
		expect(out.exports).toEqual({
			".": "./bin/vitest-agent-sidecar-darwin-arm64",
			"./package.json": "./package.json",
		});
		expect(out.files).toEqual(["bin/vitest-agent-sidecar-darwin-arm64"]);
	});

	it("rewrites a matching bin command value to the SEA path", () => {
		const out = transformManifest(
			{ exports: { ".": "./src/index.ts" }, bin: { mycli: "./src/bin.ts" }, version: "1.0.0" },
			{ exeRewrite: rewrite },
		);
		expect((out.bin as Record<string, string>).mycli).toBe("bin/vitest-agent-sidecar-darwin-arm64");
	});

	it("leaves a non-matching export as the normal TS-conditions rewrite", () => {
		const out = transformManifest(
			{ exports: { ".": "./src/index.ts", "./bin/cli": "./src/bin.ts" }, version: "1.0.0" },
			{ exeRewrite: rewrite },
		);
		const exports = out.exports as Record<string, unknown>;
		expect(exports["./bin/cli"]).toBe("./bin/vitest-agent-sidecar-darwin-arm64");
		expect(exports["."]).toEqual({ types: "./index.d.ts", import: "./index.js" });
	});

	it("does not duplicate an already-present files entry", () => {
		const out = transformManifest(
			{ exports: { ".": "./src/bin.ts" }, files: ["bin/vitest-agent-sidecar-darwin-arm64"], version: "1.0.0" },
			{ exeRewrite: rewrite },
		);
		expect(out.files).toEqual(["bin/vitest-agent-sidecar-darwin-arm64"]);
	});
});
