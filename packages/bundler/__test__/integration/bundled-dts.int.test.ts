import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures/bundled-dts");
const OUT = join(FIX, "dist/dev/pkg");

describe("bundled dts + per-module JS", () => {
	beforeAll(async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ devManifest: "preserve" }), {
			cwd: FIX,
			argv: ["--target", "dev"],
			writeOutput: () => {},
		});
	}, 60_000);

	it("entry index.d.ts is BUNDLED: DeepWidget declared inline, not re-exported from ./types", () => {
		expect(existsSync(join(OUT, "index.d.ts"))).toBe(true);
		const dts = readFileSync(join(OUT, "index.d.ts"), "utf-8");
		// The deep type's declaration is rolled up into the entry .d.ts.
		expect(dts).toMatch(/interface DeepWidget/);
		// It is NOT merely re-exported from the deep sub-module path.
		expect(dts).not.toMatch(/from ["']\.\/types/);
		// The per-module dts for the deep sub-module must NOT be emitted.
		expect(existsSync(join(OUT, "types.d.ts"))).toBe(false);
	});

	it("JS stays PER-MODULE: widget.js sits alongside index.js", () => {
		expect(existsSync(join(OUT, "index.js"))).toBe(true);
		expect(existsSync(join(OUT, "widget.js"))).toBe(true);
		// The runtime sub-module's declaration is rolled into the entry, NOT emitted per-module.
		expect(existsSync(join(OUT, "widget.d.ts"))).toBe(false);
		// types.ts is type-only, so it has no JS output — fine. The point is widget.js
		// (a real runtime sub-module) survived per-module rather than being inlined.
	});

	it("the entry loads at runtime and the sub-module helper works", async () => {
		const mod = (await import(join(OUT, "index.js"))) as { makeWidget: (n: number) => { kind: string; size: number } };
		expect(mod.makeWidget(3)).toEqual({ kind: "deep-widget", size: 3 });
	});
});
