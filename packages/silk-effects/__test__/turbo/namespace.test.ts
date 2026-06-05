import { describe, expect, it } from "vitest";
import { Turbo } from "../../src/index.js";

describe("Turbo namespace export", () => {
	it("exposes the service tag, live layer, errors, digest, and schemas", () => {
		expect(Turbo.TurboInspector).toBeDefined();
		expect(Turbo.TurboInspectorLive).toBeDefined();
		expect(Turbo.TurboDigest).toBeDefined();
		expect(Turbo.TurboNotInstalledError).toBeDefined();
		expect(Turbo.TurboExecError).toBeDefined();
		expect(Turbo.CacheDiagnosis).toBeDefined();
		expect(Turbo.TurboDryRun).toBeDefined();
	});
});
