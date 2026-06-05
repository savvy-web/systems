import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures", "multi-meta");

describe("meta build (real API Extractor, multi-entry)", () => {
	it("dev build then --target meta produces a merged api-model in localPaths", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		rmSync(join(FIX, "models"), { recursive: true, force: true });
		const config = defineBuild({
			meta: {
				localPaths: ["models"],
				tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }] },
			},
		});
		// 1. dev build emits the dts
		await runBuild(config, { cwd: FIX, argv: ["--target", "dev"], writeOutput: () => {} });
		expect(existsSync(join(FIX, "dist/dev/pkg/index.d.ts"))).toBe(true);
		expect(existsSync(join(FIX, "dist/dev/pkg/sub.d.ts"))).toBe(true);
		// 2. meta target runs the real extractor over the dts
		await runBuild(config, { cwd: FIX, argv: ["--target", "meta"], writeOutput: () => {} });
		const apiJson = join(FIX, "models", "multi-meta.api.json");
		expect(existsSync(apiJson)).toBe(true);
		const model = JSON.parse(readFileSync(apiJson, "utf-8")) as {
			kind: string;
			members: Array<{ kind: string; name: string }>;
		};
		expect(model.kind).toBe("Package");
		// two entry points: "" (main) and "sub"
		const entryNames = model.members.filter((m) => m.kind === "EntryPoint").map((m) => m.name);
		expect(entryNames).toContain("");
		expect(entryNames).toContain("sub");
	}, 60_000);
});
