import { describe, expect, it } from "@effect/vitest";
import { findUnresolvedSpecifiers } from "../../src/utils/publishable-manifest.js";

describe("findUnresolvedSpecifiers", () => {
	it("finds a catalog: specifier", () => {
		const found = findUnresolvedSpecifiers({ dependencies: { effect: "catalog:effect" } });

		expect(found).toHaveLength(1);
		expect(found[0]).toEqual({ block: "dependencies", name: "effect", specifier: "catalog:effect" });
	});

	it("finds a workspace: specifier", () => {
		const found = findUnresolvedSpecifiers({ dependencies: { "@scope/lib": "workspace:*" } });

		expect(found).toHaveLength(1);
		expect(found[0]?.specifier).toBe("workspace:*");
	});

	it("scans every dependency block", () => {
		const found = findUnresolvedSpecifiers({
			dependencies: { a: "catalog:" },
			devDependencies: { b: "workspace:^" },
			peerDependencies: { c: "catalog:default" },
			optionalDependencies: { d: "workspace:*" },
		});

		expect(found.map((f) => f.block)).toEqual([
			"dependencies",
			"devDependencies",
			"peerDependencies",
			"optionalDependencies",
		]);
	});

	it("returns nothing for a manifest with only registry specifiers", () => {
		const found = findUnresolvedSpecifiers({
			dependencies: { effect: "^3.0.0", semver: "7.6.0" },
			devDependencies: { vitest: "^4.1.9" },
		});

		expect(found).toEqual([]);
	});

	it("does not flag a version range that merely contains the word catalog", () => {
		expect(findUnresolvedSpecifiers({ dependencies: { "my-catalog": "^1.0.0" } })).toEqual([]);
	});

	it("tolerates a manifest with no dependency blocks", () => {
		expect(findUnresolvedSpecifiers({ name: "pkg", version: "1.0.0" })).toEqual([]);
	});

	it("tolerates a non-object manifest", () => {
		expect(findUnresolvedSpecifiers(null)).toEqual([]);
	});
});
