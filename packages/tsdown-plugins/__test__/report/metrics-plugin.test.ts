import { describe, expect, it } from "vitest";
import { BuildCollector } from "../../src/report/collector.js";
import { buildMetricsPlugin } from "../../src/report/metrics-plugin.js";

// Minimal rolldown OutputBundle stand-in: a chunk and an asset.
const bundle = {
	"index.js": { type: "chunk", code: "export const a = 1;\n" },
	"styles.css": { type: "asset", source: "body{color:red}" },
} as unknown as Record<string, unknown>;

function callWriteBundle(plugin: { writeBundle?: unknown }, b: Record<string, unknown>): void {
	const fn = plugin.writeBundle as (o: unknown, bundle: unknown) => void;
	fn({ dir: "/out" }, b);
}

function callOnLog(plugin: { onLog?: unknown }, level: string, log: unknown): unknown {
	const fn = plugin.onLog as (level: string, log: unknown) => unknown;
	return fn(level, log);
}

describe("buildMetricsPlugin", () => {
	it("onLog records and returns false to suppress the leak", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		const result = callOnLog(plugin, "warn", { message: "boom", code: "X" });
		expect(result).toBe(false);
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.warnings).toHaveLength(1);
		expect(report?.targetGroups[0]?.warnings[0]?.text).toBe("boom");
	});

	it("onLog drops @tsdown/css SOURCEMAP_BROKEN noise without recording it", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", ["index"]);
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		// Both @tsdown/css and its :collect sibling emit this benign, unfixable warning.
		for (const cssPlugin of ["@tsdown/css", "@tsdown/css:collect"]) {
			const result = callOnLog(plugin, "warn", {
				message: "[SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect",
				code: "SOURCEMAP_BROKEN",
				plugin: cssPlugin,
				id: "/src/runtime/components/Foo/index.module.css",
			});
			// Still returns false so the console leak is suppressed, but nothing is recorded.
			expect(result).toBe(false);
		}
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.warnings).toHaveLength(0);
	});

	it("onLog still records SOURCEMAP_BROKEN from non-css plugins", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		const result = callOnLog(plugin, "warn", { message: "real map issue", code: "SOURCEMAP_BROKEN", plugin: "other" });
		expect(result).toBe(false);
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.warnings).toHaveLength(1);
	});

	it("routes MIXED_EXPORTS to the suppressed bucket when the pass carries cjsDefaultInterop", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", false, true);
		const result = callOnLog(plugin, "warn", { message: "mixed", code: "MIXED_EXPORTS", id: "/src/a.ts" });
		expect(result).toBe(false);
		const group = c.snapshot("@x/p")[0]?.targetGroups[0];
		// Suppressed, not warned — and labelled so the build summary can group it by code.
		expect(group?.warnings).toHaveLength(0);
		expect(group?.suppressed).toHaveLength(1);
		expect(group?.suppressed[0]?.code).toBe("MIXED_EXPORTS");
		expect(group?.suppressed[0]?.file).toBe("/src/a.ts");
	});

	it("keeps MIXED_EXPORTS a real warning on a pass without cjsDefaultInterop", () => {
		const c = new BuildCollector();
		// The flag defaults to false: an esm-only pass has no interop footer, so the warning stands.
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		expect(callOnLog(plugin, "warn", { message: "mixed", code: "MIXED_EXPORTS" })).toBe(false);
		const group = c.snapshot("@x/p")[0]?.targetGroups[0];
		expect(group?.warnings).toHaveLength(1);
		expect(group?.suppressed).toHaveLength(0);
	});

	it("onLog records an error and does not suppress it (returns undefined)", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		const result = callOnLog(plugin, "error", { message: "hard-fail", code: "E" });
		// Errors must not be swallowed: rolldown's default error reporting still fires.
		expect(result).toBeUndefined();
		const [report] = c.snapshot("@x/p");
		const group = report?.targetGroups[0];
		expect(group?.errors).toHaveLength(1);
		expect(group?.errors[0]?.text).toBe("hard-fail");
		// Warn is still suppressed (returns false) while error is not.
		expect(callOnLog(plugin, "warn", { message: "soft", code: "W" })).toBe(false);
	});

	it("records emitted files with byte sizes (no gzip when not verbose)", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", false);
		callWriteBundle(plugin, bundle);
		const [report] = c.snapshot("@x/p");
		const js = report?.targetGroups[0]?.passes.find((p) => p.id === "js");
		expect(js?.files.map((f) => f.path).sort()).toEqual(["index.js", "styles.css"]);
		const idx = js?.files.find((f) => f.path === "index.js");
		expect(idx?.bytes).toBe(Buffer.byteLength("export const a = 1;\n"));
		expect(idx?.gzip).toBeUndefined();
	});

	it("computes gzip when verbose", () => {
		const c = new BuildCollector();
		const plugin = buildMetricsPlugin(c, "npm", "js", true);
		callWriteBundle(plugin, bundle);
		const [report] = c.snapshot("@x/p");
		const js = report?.targetGroups[0]?.passes.find((p) => p.id === "js");
		expect(js?.files.find((f) => f.path === "index.js")?.gzip).toBeGreaterThan(0);
	});
});
