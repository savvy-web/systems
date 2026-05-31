/**
 * Core formatter: getDependencyReleaseLine.
 *
 * Formats dependency update entries as a structured markdown table showing
 * each updated dependency's name, type, action, and version range.
 *
 * @remarks
 * This formatter is the companion to {@link getReleaseLine}. While
 * `getReleaseLine` handles individual changeset entries, this module
 * handles the "Updated dependencies" section that Changesets appends
 * when a package's dependencies are bumped as part of a release.
 *
 * The output is a GFM (GitHub Flavored Markdown) table with columns:
 * `Dependency`, `Type`, `Action`, `From`, `To`. The dependency type
 * is inferred from the consuming package's `package.json` fields
 * (`dependencies`, `devDependencies`, `peerDependencies`,
 * `optionalDependencies`) via the {@link inferDependencyType} helper.
 *
 * ### Dependency type inference
 *
 * The {@link FIELD_MAP} constant defines the precedence order for
 * inferring the dependency type. The first matching field wins:
 *
 * 1. `dependencies` maps to `"dependency"`
 * 2. `devDependencies` maps to `"devDependency"`
 * 3. `peerDependencies` maps to `"peerDependency"`
 * 4. `optionalDependencies` maps to `"optionalDependency"`
 *
 * If the dependency is not found in any field, it defaults to `"dependency"`.
 *
 * @see {@link getReleaseLine} for the companion individual changeset formatter
 * @see {@link serializeDependencyTableToMarkdown} for the table serialization utility
 *
 * @internal
 */

import { Effect } from "effect";

import type { DependencyTableRow, DependencyTableType } from "../schemas/dependency-table.js";
import type { ChangesetOptions } from "../schemas/options.js";
import { GitHubService } from "../services/github.js";
import { serializeDependencyTableToMarkdown } from "../utils/dependency-table.js";
import type { ModCompWithPackage, NewChangesetWithCommit } from "../vendor/types.js";

/**
 * Field-to-type mapping for inferring dependency type from `package.json`.
 *
 * Maps `package.json` dependency fields to their corresponding
 * `DependencyTableType` values. The order defines precedence when a
 * dependency name appears in multiple fields (first match wins).
 *
 * @internal
 */
const FIELD_MAP: readonly [string, DependencyTableType][] = [
	["dependencies", "dependency"],
	["devDependencies", "devDependency"],
	["peerDependencies", "peerDependency"],
	["optionalDependencies", "optionalDependency"],
] as const;

/**
 * Infer the dependency table type from a package's `package.json`.
 *
 * Inspects the consuming package's `package.json` to determine which
 * dependency field contains the given dependency name. Returns the
 * corresponding `DependencyTableType` value, or `"dependency"` as a
 * fallback when the dependency is not found in any standard field.
 *
 * @param dep - The dependency update with its associated `packageJson`
 * @returns The inferred dependency type for display in the table
 *
 * @internal
 */
function inferDependencyType(dep: ModCompWithPackage): DependencyTableType {
	const pkg = dep.packageJson as Record<string, unknown>;
	for (const [field, type] of FIELD_MAP) {
		const section = pkg[field];
		if (typeof section === "object" && section !== null && dep.name in (section as Record<string, unknown>)) {
			return type;
		}
	}
	return "dependency";
}

/**
 * Format dependency release lines as a structured markdown table.
 *
 * This is the core Effect program that implements the `getDependencyReleaseLine`
 * contract from the Changesets API. It requires {@link GitHubService} in its
 * environment (currently unused but kept for API contract stability).
 *
 * @remarks
 * The function maps each `ModCompWithPackage` entry to a `DependencyTableRow`,
 * inferring the dependency type from the consuming package's `package.json`,
 * then delegates to `serializeDependencyTableToMarkdown` for GFM table
 * rendering. Returns an empty string when no dependencies were updated.
 *
 * The `_changesets` and `_options` parameters are part of the Changesets API
 * contract but are not used in the table format. They are retained for
 * interface compatibility.
 *
 * @param _changesets - Changesets that caused the dependency updates (unused in table format)
 * @param dependenciesUpdated - The list of dependencies that were updated, including old/new versions
 * @param _options - Validated configuration options (unused in table format)
 * @returns An `Effect` that resolves to a formatted markdown table string, or empty string if no dependencies were updated
 */
export function getDependencyReleaseLine(
	_changesets: NewChangesetWithCommit[],
	dependenciesUpdated: ModCompWithPackage[],
	_options: ChangesetOptions,
): Effect.Effect<string, never, GitHubService> {
	return Effect.gen(function* () {
		if (dependenciesUpdated.length === 0) return "";

		// GitHubService is acquired but unused. The table format does not render
		// commit links, so no GitHub API calls are needed. However, removing this
		// line would change the function's Effect environment type from
		// Effect<string, never, GitHubService> to Effect<string, never, never>,
		// which is a breaking change for callers that provide GitHubService in
		// their layer composition (e.g., src/changelog/index.ts MainLayer).
		// TODO: Remove in next major version.
		yield* GitHubService;

		const rows: DependencyTableRow[] = dependenciesUpdated.map((dep) => ({
			dependency: dep.name,
			type: inferDependencyType(dep),
			action: "updated" as const,
			from: dep.oldVersion,
			to: dep.newVersion,
		}));

		return serializeDependencyTableToMarkdown(rows);
	});
}
