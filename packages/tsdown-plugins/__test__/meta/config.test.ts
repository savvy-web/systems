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

describe("normalizeMetaOptions optimistic", () => {
	it('defaults to "auto" -> true outside CI', () => {
		expect(normalizeMetaOptions({}, {}).optimistic).toBe(true);
	});

	it('"auto" -> false when CI is set', () => {
		expect(normalizeMetaOptions({ optimistic: "auto" }, { CI: "true" }).optimistic).toBe(false);
	});

	it('"auto" -> false when GITHUB_ACTIONS is set', () => {
		expect(normalizeMetaOptions({}, { GITHUB_ACTIONS: "true" }).optimistic).toBe(false);
	});

	it("explicit true/false override the env entirely", () => {
		expect(normalizeMetaOptions({ optimistic: true }, { CI: "true" }).optimistic).toBe(true);
		expect(normalizeMetaOptions({ optimistic: false }, {}).optimistic).toBe(false);
	});
});
