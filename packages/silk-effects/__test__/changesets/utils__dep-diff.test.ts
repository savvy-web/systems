import { CatalogSet, PackageStateSnapshot, WorkspaceStateSnapshot } from "@effected/workspaces";
import { describe, expect, it } from "vitest";
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

// --- importer-scoped resolution ----------------------------------------------
// A catalog injected at install time by a pnpmfile hook is recorded in neither
// pnpm-workspace.yaml nor the lockfile's `catalogs:` block, so it is absent from
// the catalog set and resolution falls through to the ref's own lockfile importer
// entries. The workspace-wide `resolve` abstains whenever two importers disagree
// on a version; `resolveIn` answers per declaring importer, which is the case a
// single-importer repo cannot exercise.
describe("computeWorkspaceDependencyDiffs (importer-scoped resolution)", () => {
	const HOOK_CATALOG = "catalog:effect:peers";

	/** Two importers, each with its own recorded version of `effect`. */
	const multiImporterSnap = (aVersion: string, pkgVersion: string) =>
		new WorkspaceStateSnapshot({
			packages: [
				new PackageStateSnapshot({
					name: "@x/a",
					version: "9.9.9",
					relativePath: "packages/a",
					dependencies: { effect: HOOK_CATALOG },
				}),
				new PackageStateSnapshot({
					name: "@x/pkg",
					version: "1.0.0",
					relativePath: "packages/pkg",
					dependencies: { effect: HOOK_CATALOG },
				}),
			],
			// deliberately empty: a hook-injected catalog is not in the catalog set
			catalogs: CatalogSet.empty(),
			importerVersions: {
				"packages/a": { effect: aVersion },
				"packages/pkg": { effect: pkgVersion },
			},
		});

	it("emits a row for the moving importer when importers disagree on the version", () => {
		// @x/a holds beta.50 on both sides; only @x/pkg moves. The disagreement
		// between the two importers is what makes a workspace-wide resolver abstain.
		const before = multiImporterSnap("4.0.0-beta.50", "4.0.0-beta.99");
		const after = multiImporterSnap("4.0.0-beta.50", "4.0.0-beta.101");

		const diffs = computeWorkspaceDependencyDiffs(before, after);
		const pkg = diffs.find((d) => d.package === "@x/pkg");

		expect(pkg?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "updated", from: "4.0.0-beta.99", to: "4.0.0-beta.101" },
		]);
	});

	it("emits no row for an importer whose own version did not move", () => {
		const before = multiImporterSnap("4.0.0-beta.50", "4.0.0-beta.99");
		const after = multiImporterSnap("4.0.0-beta.50", "4.0.0-beta.101");

		expect(computeWorkspaceDependencyDiffs(before, after).find((d) => d.package === "@x/a")).toBeUndefined();
	});

	it("resolves a hook-injected catalog that is absent from the catalog set", () => {
		// The reported defect: unresolvable on both sides means the raw specifiers
		// compare equal and no row is emitted for a real version movement.
		const before = multiImporterSnap("4.0.0-beta.99", "4.0.0-beta.99");
		const after = multiImporterSnap("4.0.0-beta.101", "4.0.0-beta.101");

		const rows = computeWorkspaceDependencyDiffs(before, after).flatMap((d) => d.rows);
		expect(rows).not.toHaveLength(0);
		for (const row of rows) {
			expect(row.from).not.toBe(HOOK_CATALOG);
			expect(row.to).not.toBe(HOOK_CATALOG);
		}
	});

	it("still falls back to the raw specifier when no importer entry exists", () => {
		const bare = (dep: string) =>
			new WorkspaceStateSnapshot({
				packages: [
					new PackageStateSnapshot({
						name: "@x/pkg",
						version: "1.0.0",
						relativePath: "packages/pkg",
						dependencies: { effect: dep },
					}),
				],
				catalogs: CatalogSet.empty(),
			});
		const [diff] = computeWorkspaceDependencyDiffs(bare("^1.0.0"), bare(HOOK_CATALOG));
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "updated", from: "^1.0.0", to: HOOK_CATALOG },
		]);
	});
});

// The updated path reads both importer keys, so it cannot catch a swapped
// argument. Removed rows resolve `from` through the BEFORE importer and added
// rows resolve `to` through the AFTER importer; each is exercised alone here.
describe("computeWorkspaceDependencyDiffs (importer-scoped add/remove)", () => {
	const HOOK_CATALOG = "catalog:effect:peers";

	/** One package at `packages/pkg`, optionally declaring `effect`. */
	const oneSided = (declares: boolean, recorded: string) =>
		new WorkspaceStateSnapshot({
			packages: [
				new PackageStateSnapshot({
					name: "@x/pkg",
					version: "1.0.0",
					relativePath: "packages/pkg",
					dependencies: declares ? { effect: HOOK_CATALOG } : {},
				}),
			],
			catalogs: CatalogSet.empty(),
			importerVersions: { "packages/pkg": { effect: recorded } },
		});

	it("resolves a removed row's from value through the declaring importer", () => {
		const [diff] = computeWorkspaceDependencyDiffs(oneSided(true, "4.0.0-beta.99"), oneSided(false, "4.0.0-beta.101"));
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "removed", from: "4.0.0-beta.99", to: "—" },
		]);
	});

	it("resolves an added row's to value through the declaring importer", () => {
		const [diff] = computeWorkspaceDependencyDiffs(oneSided(false, "4.0.0-beta.99"), oneSided(true, "4.0.0-beta.101"));
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "added", from: "—", to: "4.0.0-beta.101" },
		]);
	});

	it("never leaks the raw catalog specifier into an added or removed row", () => {
		const rows = [
			...computeWorkspaceDependencyDiffs(oneSided(true, "4.0.0-beta.99"), oneSided(false, "4.0.0-beta.101")),
			...computeWorkspaceDependencyDiffs(oneSided(false, "4.0.0-beta.99"), oneSided(true, "4.0.0-beta.101")),
		].flatMap((d) => d.rows);
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect(row.from).not.toBe(HOOK_CATALOG);
			expect(row.to).not.toBe(HOOK_CATALOG);
		}
	});
});

// The importer key is the package's path AT THAT REF, so a package that moved
// directories keys differently on each side. This is the only shape in which
// `beforeImporter` and `afterImporter` differ, and therefore the only one that
// can catch them being swapped.
describe("computeWorkspaceDependencyDiffs (package moved between refs)", () => {
	const HOOK_CATALOG = "catalog:effect:peers";

	const atPath = (relativePath: string, recorded: string) =>
		new WorkspaceStateSnapshot({
			packages: [
				new PackageStateSnapshot({
					name: "@x/pkg",
					version: "1.0.0",
					relativePath,
					dependencies: { effect: HOOK_CATALOG },
				}),
			],
			catalogs: CatalogSet.empty(),
			importerVersions: { [relativePath]: { effect: recorded } },
		});

	it("resolves each side through the path that side recorded", () => {
		const before = atPath("packages/old-home", "4.0.0-beta.99");
		const after = atPath("packages/new-home", "4.0.0-beta.101");
		const [diff] = computeWorkspaceDependencyDiffs(before, after);
		expect(diff?.rows).toEqual([
			{ dependency: "effect", type: "dependency", action: "updated", from: "4.0.0-beta.99", to: "4.0.0-beta.101" },
		]);
	});

	it("does not fall back to the raw specifier when only the path changed", () => {
		const [diff] = computeWorkspaceDependencyDiffs(
			atPath("packages/old-home", "4.0.0-beta.99"),
			atPath("packages/new-home", "4.0.0-beta.99"),
		);
		// same resolved version on both sides -> no row, not a raw-vs-raw comparison
		expect(diff).toBeUndefined();
	});
});
