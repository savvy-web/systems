import { describe, expect, it } from "vitest";
import { partitionHits } from "../../../../src/commitlint/hook/rules/types.js";

describe("partitionHits", () => {
	it("partitions by severity", () => {
		const hits = [
			{ ruleId: "a", severity: "advise" as const, message: "ma" },
			{ ruleId: "b", severity: "deny" as const, message: "mb" },
			{ ruleId: "c", severity: "advise" as const, message: "mc" },
		];
		expect(partitionHits(hits)).toEqual({
			deny: [{ ruleId: "b", severity: "deny", message: "mb" }],
			advise: [
				{ ruleId: "a", severity: "advise", message: "ma" },
				{ ruleId: "c", severity: "advise", message: "mc" },
			],
		});
	});

	it("returns empty arrays for empty input", () => {
		expect(partitionHits([])).toEqual({ deny: [], advise: [] });
	});
});
