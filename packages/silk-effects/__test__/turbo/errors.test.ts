import { describe, expect, it } from "vitest";
import {
	DryRunParseError,
	NotATurboRepoError,
	TurboExecError,
	TurboNotInstalledError,
} from "../../src/turbo/errors.js";

describe("turbo errors", () => {
	it("TurboNotInstalledError carries a message", () => {
		const e = new TurboNotInstalledError({ reason: "not on PATH" });
		expect(e._tag).toBe("TurboNotInstalledError");
		expect(e.message).toContain("not on PATH");
	});

	it("NotATurboRepoError names the cwd", () => {
		const e = new NotATurboRepoError({ cwd: "/tmp/x" });
		expect(e._tag).toBe("NotATurboRepoError");
		expect(e.message).toContain("/tmp/x");
	});

	it("DryRunParseError carries the underlying reason", () => {
		const e = new DryRunParseError({ task: "build:dev", reason: "bad json" });
		expect(e._tag).toBe("DryRunParseError");
		expect(e.message).toContain("build:dev");
		expect(e.message).toContain("bad json");
	});

	it("TurboExecError names the failed args and reason", () => {
		const e = new TurboExecError({ args: ["run", "typo:task", "--dry=json"], reason: "exit code 1" });
		expect(e._tag).toBe("TurboExecError");
		expect(e.message).toContain("run typo:task --dry=json");
		expect(e.message).toContain("exit code 1");
	});
});
