// packages/tsdown-plugins/__test__/manifest/build-emitted-manifest-exe.test.ts
import { describe, expect, it } from "vitest";
import { buildEmittedManifest } from "../../src/manifest/emit-manifest.js";

describe("buildEmittedManifest exeRewrite", () => {
	it("forwards exeRewrite into transformManifest", async () => {
		const out = await buildEmittedManifest({
			pkg: { name: "p", version: "1.0.0", exports: { ".": "./src/bin.ts", "./package.json": "./package.json" } },
			targetGroup: { id: "dev", name: "p", isProd: false },
			devManifest: "preserve",
			exeRewrite: { source: "./src/bin.ts", fileName: "p-darwin-arm64", dir: "bin" },
		});
		expect((out.exports as Record<string, unknown>)["."]).toBe("./bin/p-darwin-arm64");
		expect(out.files).toEqual(["bin/p-darwin-arm64"]);
	});
});
