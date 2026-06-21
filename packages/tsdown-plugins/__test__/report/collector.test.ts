import { describe, expect, it } from "vitest";
import { BuildCollector } from "../../src/report/collector.js";

describe("BuildCollector", () => {
	it("accumulates files and timing per (group, pass) across partitions", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", ["index"]);
		c.recordEmitted("npm", "js", { path: "index.js", bytes: 60 });
		c.recordPassTiming("npm", "js", 100);
		// a second js partition (e.g. rspress runtime) folds into the same js pass
		c.recordEmitted("npm", "js", { path: "runtime/index.js", bytes: 200 });
		c.recordPassTiming("npm", "js", 50);
		c.recordEmitted("npm", "dts", { path: "index.d.ts", bytes: 2400 });
		c.recordPassTiming("npm", "dts", 205);

		const [report] = c.snapshot("@x/p");
		expect(report?.package).toBe("@x/p");
		const group = report?.targetGroups[0];
		expect(group?.id).toBe("npm");
		const js = group?.passes.find((p) => p.id === "js");
		expect(js?.files).toHaveLength(2);
		expect(js?.ms).toBe(150);
		expect(group?.timings.totalMs).toBe(355);
		expect(group?.passes.map((p) => p.id)).toEqual(["js", "dts"]);
	});

	it("routes warnings and errors to the right group", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		c.recordWarning("npm", { source: "tsdown", level: "warn", text: "heads up" });
		c.recordError("npm", { source: "api-extractor", level: "error", text: "boom", file: "a.ts", line: 3, column: 1 });
		const [report] = c.snapshot("@x/p");
		const group = report?.targetGroups[0];
		expect(group?.warnings[0]?.text).toBe("heads up");
		expect(group?.errors[0]?.file).toBe("a.ts");
	});

	it("auto-registers a group on first record if not registered", () => {
		const c = new BuildCollector();
		c.recordEmitted("dev", "js", { path: "index.js", bytes: 1 });
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.id).toBe("dev");
	});

	it("dedupes identical diagnostics within a group", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		// First recording
		c.recordWarning("npm", { source: "rolldown", level: "warn", text: "X", file: "a.ts", line: 1, column: 2 });
		// Duplicate — should be dropped
		c.recordWarning("npm", { source: "rolldown", level: "warn", text: "X", file: "a.ts", line: 1, column: 2 });
		const [report1] = c.snapshot("@x/p");
		expect(report1?.targetGroups[0]?.warnings).toHaveLength(1);
		// Different text — should be recorded
		c.recordWarning("npm", { source: "rolldown", level: "warn", text: "Y", file: "a.ts", line: 1, column: 2 });
		const [report2] = c.snapshot("@x/p");
		expect(report2?.targetGroups[0]?.warnings).toHaveLength(2);
		// Same text as warning but as an error — level differs, so recorded separately
		c.recordError("npm", { source: "rolldown", level: "error", text: "X", file: "a.ts", line: 1, column: 2 });
		const [report3] = c.snapshot("@x/p");
		expect(report3?.targetGroups[0]?.errors).toHaveLength(1);
	});

	it("snapshot does not leak mutable internal state", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", ["index"]);
		c.recordEmitted("npm", "js", { path: "index.js", bytes: 10 });
		c.recordWarning("npm", { source: "tsdown", level: "warn", text: "first" });

		const [first] = c.snapshot("@x/p");
		const group = first?.targetGroups[0];
		// Mutate the returned snapshot's arrays — this must not reach back into collector state. The
		// schema types the arrays readonly, so cast to mutable to attempt the (forbidden) mutation.
		(group?.warnings as Array<{ source: string; level: string; text: string }> | undefined)?.push({
			source: "tsdown",
			level: "warn",
			text: "injected",
		});
		const jsPass = group?.passes.find((p) => p.id === "js");
		(jsPass?.files as Array<{ path: string; bytes: number }> | undefined)?.push({ path: "injected.js", bytes: 999 });

		const [second] = c.snapshot("@x/p");
		const group2 = second?.targetGroups[0];
		expect(group2?.warnings).toHaveLength(1);
		expect(group2?.warnings[0]?.text).toBe("first");
		expect(group2?.passes.find((p) => p.id === "js")?.files.map((f) => f.path)).toEqual(["index.js"]);
	});

	it("records suppressed diagnostics with code, deduped, and surfaces them in snapshot", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		c.recordSuppressed("npm", {
			source: "api-extractor",
			level: "warn",
			text: "Bar needs export",
			code: "ae-forgotten-export",
		});
		// duplicate — dropped
		c.recordSuppressed("npm", {
			source: "api-extractor",
			level: "warn",
			text: "Bar needs export",
			code: "ae-forgotten-export",
		});
		c.recordSuppressed("npm", {
			source: "api-extractor",
			level: "warn",
			text: "Foo undocumented",
			code: "tsdoc-undefined-tag",
		});
		const [report] = c.snapshot("@x/p");
		const group = report?.targetGroups[0];
		expect(group?.suppressed).toHaveLength(2);
		expect(group?.suppressed.map((s) => s.code)).toEqual(["ae-forgotten-export", "tsdoc-undefined-tag"]);
	});

	it("round-trips code and ciFatal on warnings", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		c.recordWarning("npm", {
			source: "api-extractor",
			level: "warn",
			text: "Bar needs export",
			code: "ae-forgotten-export",
			ciFatal: true,
		});
		const [report] = c.snapshot("@x/p");
		const w = report?.targetGroups[0]?.warnings[0];
		expect(w?.code).toBe("ae-forgotten-export");
		expect(w?.ciFatal).toBe(true);
	});

	it("counts a re-emitted output path once (first pass wins)", () => {
		const c = new BuildCollector();
		c.recordEmitted("npm", "js", { path: "index.cjs", bytes: 100 });
		c.recordEmitted("npm", "dts", { path: "index.cjs", bytes: 100 }); // dual-cjs: dts pass re-emits the same .cjs
		c.recordEmitted("npm", "dts", { path: "index.d.ts", bytes: 50 });
		const [report] = c.snapshot("@x/p");
		const group = report?.targetGroups[0];
		const total = group?.passes.reduce((sum, p) => sum + p.files.length, 0);
		expect(total).toBe(2); // index.cjs counted once (under js) + index.d.ts — not 3
		expect(group?.passes.find((p) => p.id === "js")?.files.map((f) => f.path)).toEqual(["index.cjs"]);
		expect(group?.passes.find((p) => p.id === "dts")?.files.map((f) => f.path)).toEqual(["index.d.ts"]);
	});
});
