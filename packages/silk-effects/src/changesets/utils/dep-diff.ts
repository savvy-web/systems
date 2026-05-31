/**
 * Compute per-workspace-package dependency-table rows from two
 * {@link WorkspaceSnapshot}s.
 *
 * @remarks
 * Operates on declared dependencies only (the `dependencies` /
 * `devDependencies` / `peerDependencies` / `optionalDependencies` fields
 * of each workspace's `package.json`). Lockfile-only movements
 * (resolved versions changing while declared ranges stay put) are
 * intentionally excluded — those happen on every `pnpm install` and
 * would generate constant noise.
 *
 * Protocol-prefixed values (`workspace:`, `catalog:`, `npm:`, etc.) are
 * passed through verbatim. The CSH005 dependency table format accepts
 * arbitrary version-like strings; if either side of a change is a
 * protocol reference, the row is still emitted so consumers can see
 * the movement.
 *
 * @see {@link DependencyTableRow} for the row schema
 * @see {@link WorkspaceSnapshot} for the input shape
 *
 * @packageDocumentation
 */

import type { DependencyTableRow, DependencyTableType } from "../schemas/dependency-table.js";
import type { WorkspaceSnapshot } from "../services/workspace-snapshot.js";
import { sortDependencyRows } from "./dependency-table.js";

const EM_DASH = "—";

const DEP_TYPE_MAP: ReadonlyArray<readonly [keyof WorkspaceSnapshot & string, DependencyTableType]> = [
	["dependencies", "dependency"],
	["devDependencies", "devDependency"],
	["peerDependencies", "peerDependency"],
	["optionalDependencies", "optionalDependency"],
] as const;

/**
 * A workspace package's worth of dependency-table rows.
 *
 * @public
 */
export interface WorkspaceDependencyDiff {
	/** The workspace package whose `package.json` changed. */
	readonly package: string;
	/** Repo-relative path of the package directory (taken from the `after` snapshot when available). */
	readonly relativePath: string;
	/** One row per dependency change, sorted by the existing `sortDependencyRows` convention. */
	readonly rows: ReadonlyArray<DependencyTableRow>;
}

function diffOneRecord(
	before: Readonly<Record<string, string>>,
	after: Readonly<Record<string, string>>,
	type: DependencyTableType,
): DependencyTableRow[] {
	const rows: DependencyTableRow[] = [];
	const seen = new Set<string>();

	for (const [name, beforeVersion] of Object.entries(before)) {
		seen.add(name);
		const afterVersion = after[name];
		if (afterVersion === undefined) {
			rows.push({
				dependency: name,
				type,
				action: "removed",
				from: beforeVersion,
				to: EM_DASH,
			});
		} else if (afterVersion !== beforeVersion) {
			rows.push({
				dependency: name,
				type,
				action: "updated",
				from: beforeVersion,
				to: afterVersion,
			});
		}
		// else: no change, no row.
	}

	for (const [name, afterVersion] of Object.entries(after)) {
		if (seen.has(name)) continue;
		rows.push({
			dependency: name,
			type,
			action: "added",
			from: EM_DASH,
			to: afterVersion,
		});
	}

	return rows;
}

/**
 * Diff two workspace snapshots and return per-package dependency-table rows.
 *
 * @param before - Snapshot at the older ref (typically the merge base). Pass
 *   `null` for workspace packages that did not exist at the older ref — every
 *   declared dep is then reported as `"added"`.
 * @param after - Snapshot at the newer ref (typically the working tree).
 * @returns One {@link WorkspaceDependencyDiff} entry per workspace package
 *   that has at least one row. Packages with no changes are omitted.
 *
 * @public
 */
export function computeWorkspaceDependencyDiffs(
	beforeSnapshots: ReadonlyArray<WorkspaceSnapshot>,
	afterSnapshots: ReadonlyArray<WorkspaceSnapshot>,
): ReadonlyArray<WorkspaceDependencyDiff> {
	const beforeByName = new Map(beforeSnapshots.map((s) => [s.name, s] as const));
	const result: WorkspaceDependencyDiff[] = [];

	for (const after of afterSnapshots) {
		const before = beforeByName.get(after.name);
		const rows: DependencyTableRow[] = [];

		for (const [field, type] of DEP_TYPE_MAP) {
			const beforeRecord = (before?.[field] ?? {}) as Readonly<Record<string, string>>;
			const afterRecord = after[field] as Readonly<Record<string, string>>;
			rows.push(...diffOneRecord(beforeRecord, afterRecord, type));
		}

		if (rows.length > 0) {
			result.push({
				package: after.name,
				relativePath: after.relativePath,
				rows: sortDependencyRows(rows),
			});
		}
	}

	return result;
}
