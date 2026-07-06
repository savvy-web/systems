import { Changesets } from "@savvy-web/silk-effects";
import { describe, expect, it } from "vitest";
import changelogFunctions from "../src/index.js";

describe("@savvy-web/changelog", () => {
	it("default-exports the silk-effects changelog functions", () => {
		expect(changelogFunctions).toBe(Changesets.changelogFunctions);
		expect(typeof changelogFunctions.getReleaseLine).toBe("function");
		expect(typeof changelogFunctions.getDependencyReleaseLine).toBe("function");
	});
});
