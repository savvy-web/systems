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
