import { describe, expect, it } from "vitest";
import { normalizeMetaOptions } from "../../src/meta/config.js";

describe("normalizeMetaOptions", () => {
	it("defaults localPaths and tsdoc to empty", () => {
		const n = normalizeMetaOptions({});
		expect(n.localPaths).toEqual([]);
		expect(n.tsdoc.suppressWarnings).toEqual([]);
		expect(n.tsdoc.tagDefinitions).toEqual([]);
	});

	it("preserves provided values", () => {
		const n = normalizeMetaOptions({
			localPaths: ["../../website/lib/models/sdk"],
			tsdoc: {
				suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_base" }],
				tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }],
			},
		});
		expect(n.localPaths).toEqual(["../../website/lib/models/sdk"]);
		expect(n.tsdoc.suppressWarnings[0]?.messageId).toBe("ae-forgotten-export");
		expect(n.tsdoc.tagDefinitions[0]?.tagName).toBe("@since");
	});
});
