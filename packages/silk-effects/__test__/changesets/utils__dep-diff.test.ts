import { describe, expect, it } from "vitest";
import { CatalogSet, PackageStateSnapshot, WorkspaceStateSnapshot } from "workspaces-effect";
import { computeWorkspaceDependencyDiffs } from "../../src/changesets/utils/dep-diff.js";

const snap = (catalogs: Record<string, Record<string, string>>, deps: Record<string, string>, version = "1.0.0") =>
	new WorkspaceStateSnapshot({
		packages: [
			new PackageStateSnapshot({ name: "@x/a", version: "9.9.9", relativePath: "packages/a" }),
			new PackageStateSnapshot({ name: "@x/pkg", version, relativePath: "packages/pkg", dependencies: deps }),
		],
		catalogs: CatalogSet.fromCatalogs(catalogs),
	});

describe("computeWorkspaceDependencyDiffs (catalog-aware)", () => {
	it("emits an updated row for a catalog bump under a stable specifier", () => {
		const before = snap({ silk: { effect: "^3.20.0" } }, { effect: "catalog:silk" });
		const after = snap({ silk: { effect: "^3.21.0" } }, { effect: "catalog:silk" });
		const [diff] = computeWorkspaceDependencyDiffs(before, after);
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "updated", from: "^3.20.0", to: "^3.21.0" },
		]);
	});

	it("suppresses rows when resolved values are equal despite raw change (catalog adoption)", () => {
		const before = snap({ silk: { effect: "^3.21.0" } }, { effect: "^3.21.0" });
		const after = snap({ silk: { effect: "^3.21.0" } }, { effect: "catalog:silk" });
		expect(computeWorkspaceDependencyDiffs(before, after)).toEqual([]);
	});

	it("emits workspace: movement when the target package version moved", () => {
		const beforeAdj = new WorkspaceStateSnapshot({
			packages: [
				new PackageStateSnapshot({ name: "@x/a", version: "1.0.0", relativePath: "packages/a" }),
				new PackageStateSnapshot({
					name: "@x/pkg",
					version: "1.0.0",
					relativePath: "packages/pkg",
					dependencies: { "@x/a": "workspace:*" },
				}),
			],
			catalogs: CatalogSet.empty(),
		});
		const after = snap({}, { "@x/a": "workspace:*" }); // @x/a is 9.9.9 here
		const [diff] = computeWorkspaceDependencyDiffs(beforeAdj, after);
		expect(diff?.rows).toEqual([
			{ dependency: "@x/a", type: "dependency", action: "updated", from: "1.0.0", to: "9.9.9" },
		]);
	});

	it("falls back to the raw specifier when a side cannot resolve", () => {
		const before = snap({}, {});
		const after = snap({}, { effect: "catalog:silk" }); // no catalog entry → raw passthrough
		const [diff] = computeWorkspaceDependencyDiffs(before, after);
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "added", from: "—", to: "catalog:silk" },
		]);
	});

	it("keeps plain range bumps and added/removed sentinels exactly as before", () => {
		const before = snap({}, { react: "^18.0.0", gone: "^1.0.0" });
		const after = snap({}, { react: "^19.0.0", fresh: "^2.0.0" });
		const [diff] = computeWorkspaceDependencyDiffs(before, after);
		expect(diff?.rows).toEqual([
			{ dependency: "gone", type: "dependency", action: "removed", from: "^1.0.0", to: "—" },
			{ dependency: "react", type: "dependency", action: "updated", from: "^18.0.0", to: "^19.0.0" },
			{ dependency: "fresh", type: "dependency", action: "added", from: "—", to: "^2.0.0" },
		]);
	});

	it("collapses a no-version-change field move (dev -> runtime) into no rows", () => {
		const fields = (deps: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) =>
			new WorkspaceStateSnapshot({
				packages: [
					new PackageStateSnapshot({ name: "@x/pkg", version: "1.0.0", relativePath: "packages/pkg", ...deps }),
				],
				catalogs: CatalogSet.empty(),
			});
		const before = fields({ devDependencies: { effect: "^3.21.0" } });
		const after = fields({ dependencies: { effect: "^3.21.0" } });
		expect(computeWorkspaceDependencyDiffs(before, after)).toEqual([]);
	});

	it("collapses a field move when resolved values match across catalog adoption", () => {
		const mk = (deps: { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }) =>
			new WorkspaceStateSnapshot({
				packages: [
					new PackageStateSnapshot({ name: "@x/pkg", version: "1.0.0", relativePath: "packages/pkg", ...deps }),
				],
				catalogs: CatalogSet.fromCatalogs({ silk: { effect: "^3.21.0" } }),
			});
		const before = mk({ peerDependencies: { effect: "^3.21.0" } });
		const after = mk({ dependencies: { effect: "catalog:silk" } });
		expect(computeWorkspaceDependencyDiffs(before, after)).toEqual([]);
	});

	it("keeps both rows when a field move also changes the resolved version", () => {
		const mk = (deps: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }) =>
			new WorkspaceStateSnapshot({
				packages: [
					new PackageStateSnapshot({ name: "@x/pkg", version: "1.0.0", relativePath: "packages/pkg", ...deps }),
				],
				catalogs: CatalogSet.empty(),
			});
		const before = mk({ devDependencies: { effect: "^3.20.0" } });
		const after = mk({ dependencies: { effect: "^3.21.0" } });
		const [diff] = computeWorkspaceDependencyDiffs(before, after);
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "devDependency", action: "removed", from: "^3.20.0", to: "—" },
			{ dependency: "effect", type: "dependency", action: "added", from: "—", to: "^3.21.0" },
		]);
	});

	it("reports a package absent at the before ref as all-added", () => {
		const before = new WorkspaceStateSnapshot({ packages: [], catalogs: CatalogSet.empty() });
		const after = snap({ silk: { effect: "^3.21.0" } }, { effect: "catalog:silk" });
		const diffs = computeWorkspaceDependencyDiffs(before, after);
		const pkg = diffs.find((d) => d.package === "@x/pkg");
		expect(pkg?.rows).toContainEqual({
			dependency: "effect",
			type: "dependency",
			action: "added",
			from: "—",
			to: "^3.21.0",
		});
	});
});
