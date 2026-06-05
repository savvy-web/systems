import { describe, expect, it } from "vitest";
import { normalizeExeOptions } from "../../src/exe/config.js";

describe("normalizeExeOptions", () => {
	it("infers the target from the package os/cpu and fills seaConfig/nodeVersion defaults", () => {
		const out = normalizeExeOptions({ fileName: "tool", entry: "./src/bin.ts" }, { os: ["darwin"], cpu: ["arm64"] });
		expect(out).toHaveLength(1);
		expect(out[0]?.fileName).toBe("tool");
		expect(out[0]?.entry).toBe("./src/bin.ts");
		expect(out[0]?.targets).toEqual([{ platform: "darwin", arch: "arm64", nodeVersion: "25.9.0" }]);
		expect(out[0]?.seaConfig).toEqual({ disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false });
	});

	it("maps win32 os to the win platform token", () => {
		const out = normalizeExeOptions({ fileName: "tool" }, { os: ["win32"], cpu: ["x64"] });
		expect(out[0]?.targets).toEqual([{ platform: "win", arch: "x64", nodeVersion: "25.9.0" }]);
	});

	it("honors explicit targets and nodeVersion over os/cpu inference", () => {
		const out = normalizeExeOptions(
			{ fileName: "tool", nodeVersion: "24.0.0", targets: [{ platform: "linux", arch: "arm64" }] },
			{ os: ["darwin"], cpu: ["arm64"] },
		);
		expect(out[0]?.targets).toEqual([{ platform: "linux", arch: "arm64", nodeVersion: "24.0.0" }]);
	});

	it("defaults entry to ./src/bin.ts when unset", () => {
		const out = normalizeExeOptions({ fileName: "tool" }, { os: ["linux"], cpu: ["x64"] });
		expect(out[0]?.entry).toBe("./src/bin.ts");
	});

	it("normalizes an array of exe configs into one normalized entry each", () => {
		const out = normalizeExeOptions(
			[
				{ fileName: "a", targets: [{ platform: "darwin", arch: "arm64" }] },
				{ fileName: "b", targets: [{ platform: "linux", arch: "x64" }] },
			],
			{ os: [], cpu: [] },
		);
		expect(out.map((e) => e.fileName)).toEqual(["a", "b"]);
		expect(out[0]?.targets[0]?.nodeVersion).toBe("25.9.0");
		expect(out[1]?.targets[0]?.nodeVersion).toBe("25.9.0");
	});

	it("produces empty targets when the package os is unrecognized (validation deferred to config layer)", () => {
		const out = normalizeExeOptions({ fileName: "tool" }, { os: ["freebsd"], cpu: ["x64"] });
		expect(out[0]?.targets).toEqual([]);
	});

	it("merges an explicit seaConfig over the defaults", () => {
		const out = normalizeExeOptions(
			{ fileName: "tool", targets: [{ platform: "linux", arch: "x64" }], seaConfig: { useSnapshot: true } },
			{ os: [], cpu: [] },
		);
		expect(out[0]?.seaConfig.useSnapshot).toBe(true);
		expect(out[0]?.seaConfig.useCodeCache).toBe(false);
		expect(out[0]?.seaConfig.disableExperimentalSEAWarning).toBe(true);
	});
});
