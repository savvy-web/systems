/**
 * Compute per-workspace-package dependency-table rows from two
 * {@link WorkspaceStateSnapshot}s, resolving `catalog:` / `workspace:`
 * specifiers against each side's own catalogs and package versions BEFORE
 * comparing.
 *
 * @remarks
 * Operates on declared dependencies only (the `dependencies` /
 * `devDependencies` / `peerDependencies` / `optionalDependencies` fields
 * of each workspace's `package.json`). Lockfile-only movements
 * (resolved versions changing while declared ranges stay put) are
 * intentionally excluded — those happen on every `pnpm install` and
 * would generate constant noise.
 *
 * Each side carries its own catalogs and package versions, so a specifier
 * is resolved against the snapshot it belongs to: `catalog:silk` resolves
 * to that ref's `silk` catalog entry, `workspace:*` to that ref's target
 * package version. A row is emitted iff the two RESOLVED values differ (or
 * the dependency was added/removed) — a package that merely adopted a
 * `catalog:` specifier without changing the concrete version produces NO
 * row. When a side cannot resolve a specifier (no matching catalog entry,
 * plain range, etc.) it falls back to the raw specifier string.
 *
 * @see {@link DependencyTableRow} for the row schema
 * @see {@link WorkspaceStateSnapshot} for the input shape
 *
 */

import { Option } from "effect";
import type { WorkspaceStateSnapshot } from "workspaces-effect";
import type { DependencyTableRow, DependencyTableType } from "../schemas/dependency-table.js";
import { sortDependencyRows } from "./dependency-table.js";

/** The em-dash sentinel (U+2014) used for added ("from") / removed ("to") cells. */
const EM_DASH = "—";

const DEP_TYPE_MAP = [
	["dependencies", "dependency"],
	["devDependencies", "devDependency"],
	["peerDependencies", "peerDependency"],
	["optionalDependencies", "optionalDependency"],
] as const satisfies ReadonlyArray<readonly [string, DependencyTableType]>;

/**
 * A workspace package's worth of dependency-table rows.
 *
 * @public
 */
export interface WorkspaceDependencyDiff {
	/** The workspace package whose `package.json` changed. */
	readonly package: string;
	/** Repo-relative path of the package directory (taken from the `after` snapshot). */
	readonly relativePath: string;
	/** One row per dependency change, sorted by the existing `sortDependencyRows` convention. */
	readonly rows: ReadonlyArray<DependencyTableRow>;
}

/**
 * Resolve a specifier against the snapshot it belongs to, falling back to
 * the raw specifier string when the snapshot cannot resolve it.
 */
const resolveOrRaw = (snapshot: WorkspaceStateSnapshot, dep: string, spec: string): string =>
	Option.getOrElse(snapshot.resolve(dep, spec), () => spec);

/**
 * Diff two workspace snapshots and return per-package dependency-table rows,
 * comparing already-resolved specifier values per side.
 *
 * @param before - Snapshot at the older ref (typically the merge base). A
 *   workspace package absent here reports every declared dep as `"added"`.
 * @param after - Snapshot at the newer ref (typically the working tree).
 * @returns One {@link WorkspaceDependencyDiff} entry per workspace package
 *   that has at least one row. Packages with no resolved-value changes are
 *   omitted.
 *
 * @public
 */
export function computeWorkspaceDependencyDiffs(
	before: WorkspaceStateSnapshot,
	after: WorkspaceStateSnapshot,
): ReadonlyArray<WorkspaceDependencyDiff> {
	const result: WorkspaceDependencyDiff[] = [];

	for (const afterPkg of after.packages) {
		const beforePkg = Option.getOrNull(before.package(afterPkg.name));
		const rows: DependencyTableRow[] = [];

		for (const [field, type] of DEP_TYPE_MAP) {
			const beforeRecord = (beforePkg?.[field] ?? {}) as Readonly<Record<string, string>>;
			const afterRecord = afterPkg[field] as Readonly<Record<string, string>>;
			const seen = new Set<string>();

			for (const [name, beforeSpec] of Object.entries(beforeRecord)) {
				seen.add(name);
				const from = resolveOrRaw(before, name, beforeSpec);
				const afterSpec = afterRecord[name];
				if (afterSpec === undefined) {
					rows.push({ dependency: name, type, action: "removed", from, to: EM_DASH });
					continue;
				}
				const to = resolveOrRaw(after, name, afterSpec);
				if (from !== to) rows.push({ dependency: name, type, action: "updated", from, to });
			}

			for (const [name, afterSpec] of Object.entries(afterRecord)) {
				if (seen.has(name)) continue;
				rows.push({
					dependency: name,
					type,
					action: "added",
					from: EM_DASH,
					to: resolveOrRaw(after, name, afterSpec),
				});
			}
		}

		if (rows.length > 0) {
			result.push({ package: afterPkg.name, relativePath: afterPkg.relativePath, rows: sortDependencyRows(rows) });
		}
	}

	return result;
}
