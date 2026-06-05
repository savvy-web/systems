import { describe, expect, it } from "vitest";
import { mergeApiModels } from "../../src/meta/merge-models.js";

function model(entryName: string, pkg: string, memberRef: string): Record<string, unknown> {
	return {
		kind: "Package",
		canonicalReference: `${pkg}!`,
		members: [
			{
				kind: "EntryPoint",
				name: "",
				canonicalReference: `${pkg}!`,
				members: [{ kind: "Variable", name: entryName, canonicalReference: memberRef }],
			},
		],
	};
}

describe("mergeApiModels", () => {
	it("merges entry points and rewrites sub-entry canonical references", () => {
		const perEntryModels = new Map<string, Record<string, unknown>>([
			["index", model("a", "@scope/pkg", "@scope/pkg!a:var")],
			["sub", model("b", "@scope/pkg", "@scope/pkg!b:var")],
		]);
		const merged = mergeApiModels({
			perEntryModels,
			packageName: "@scope/pkg",
			exportPaths: { index: ".", sub: "./sub" },
		});
		const members = merged.members as Array<Record<string, unknown>>;
		expect(members).toHaveLength(2);
		// main entry first, untouched
		expect(members[0]?.canonicalReference).toBe("@scope/pkg!");
		// sub entry rewritten
		const sub = members.find((m) => m.name === "sub") as Record<string, unknown>;
		expect(sub.canonicalReference).toBe("@scope/pkg/sub!");
		const subMember = (sub.members as Array<Record<string, unknown>>)[0];
		expect(subMember?.canonicalReference).toBe("@scope/pkg/sub!b:var");
	});

	it("returns the single model unchanged in shape when only one entry", () => {
		const perEntryModels = new Map([["index", model("a", "@scope/pkg", "@scope/pkg!a:var")]]);
		const merged = mergeApiModels({ perEntryModels, packageName: "@scope/pkg", exportPaths: { index: "." } });
		expect((merged.members as unknown[]).length).toBe(1);
	});
});
