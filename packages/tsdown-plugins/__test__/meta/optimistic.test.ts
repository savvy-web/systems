import { describe, expect, it } from "vitest";
import { rewriteMetaVersions } from "../../src/meta/optimistic.js";

const versions = new Map<string, string>([
	["@scope/plugin", "1.0.0"],
	["@scope/sdk", "1.0.0"],
]);

describe("rewriteMetaVersions", () => {
	it("bumps the package's own version to its next version", () => {
		const out = rewriteMetaVersions({ name: "@scope/plugin", version: "0.0.0" }, versions, "@scope/plugin");
		expect(out.version).toBe("1.0.0");
	});

	it("bumps workspace-sibling dependency versions, leaving externals untouched", () => {
		const out = rewriteMetaVersions(
			{
				name: "@scope/plugin",
				version: "0.0.0",
				dependencies: { "@scope/sdk": "0.0.0", effect: "^3.21.3" },
				peerDependencies: { "@scope/sdk": "0.0.0", vitest: "^4.1.0" },
			},
			versions,
			"@scope/plugin",
		);
		expect((out.dependencies as Record<string, string>)["@scope/sdk"]).toBe("1.0.0");
		expect((out.dependencies as Record<string, string>).effect).toBe("^3.21.3");
		expect((out.peerDependencies as Record<string, string>)["@scope/sdk"]).toBe("1.0.0");
		expect((out.peerDependencies as Record<string, string>).vitest).toBe("^4.1.0");
	});

	it("leaves unknown deps and missing self untouched, and does not mutate the input", () => {
		const input = { name: "@scope/other", version: "5.0.0", dependencies: { lodash: "^4.0.0" } };
		const out = rewriteMetaVersions(input, versions, "@scope/other");
		expect(out.version).toBe("5.0.0");
		expect((out.dependencies as Record<string, string>).lodash).toBe("^4.0.0");
		expect(input.version).toBe("5.0.0"); // input unmutated
	});
});
