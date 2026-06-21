import { describe, expect, it } from "vitest";
import { BuildCollector } from "../../src/report/collector.js";
import { createTsdownLogger } from "../../src/report/tsdown-logger.js";

describe("createTsdownLogger", () => {
	it("routes warn/error into the collector and ignores info/success", () => {
		const c = new BuildCollector();
		c.registerGroup("npm", []);
		const log = createTsdownLogger(c, "npm");
		log.info("entry:", "\x1b[34msrc/index.ts\x1b[39m");
		log.success("Build complete");
		log.warn("circular dependency");
		log.error("oops");
		const [report] = c.snapshot("@x/p");
		const g = report?.targetGroups[0];
		expect(g?.warnings).toHaveLength(1);
		expect(g?.warnings[0]?.text).toBe("circular dependency");
		expect(g?.warnings[0]?.source).toBe("tsdown");
		expect(g?.errors[0]?.text).toBe("oops");
	});

	it("strips ANSI escape codes from captured text", () => {
		const c = new BuildCollector();
		const log = createTsdownLogger(c, "npm");
		log.warn("\x1b[33mheads up\x1b[39m");
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.warnings[0]?.text).toBe("heads up");
	});

	it("dedupes warnOnce by text", () => {
		const c = new BuildCollector();
		const log = createTsdownLogger(c, "npm");
		log.warnOnce("same");
		log.warnOnce("same");
		const [report] = c.snapshot("@x/p");
		expect(report?.targetGroups[0]?.warnings).toHaveLength(1);
	});
});
