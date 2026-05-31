/**
 * Workspace scope detection module.
 *
 * @internal
 */
import { Effect } from "effect";
import type { WorkspaceDiscoveryError } from "workspaces-effect";
import { WorkspaceDiscovery } from "workspaces-effect";

/**
 * Extract scope-friendly name from a package name.
 *
 * @param name - Package name (e.g., `@scope/package-name` or `package-name`)
 * @returns Package name without scope prefix
 *
 * @internal
 */
function extractScopeName(name: string): string | undefined {
	if (name.startsWith("@")) {
		return name.split("/")[1];
	}
	return name;
}

/**
 * Detect package scopes from workspace configuration.
 *
 * @remarks
 * Uses workspaces-effect to find all packages in the workspace and extracts
 * their names as potential commit scopes. For scoped packages like
 * `@scope/package-name`, only the package name portion is used as the scope.
 *
 * @returns Effect yielding sorted array of scope names, requires WorkspaceDiscovery
 *
 * @public
 */
export const detectScopes: Effect.Effect<string[], WorkspaceDiscoveryError, WorkspaceDiscovery> = Effect.gen(
	function* () {
		const discovery = yield* WorkspaceDiscovery;
		const packages = yield* discovery.listPackages();

		const scopes: string[] = [];

		for (const pkg of packages) {
			const scopeName = extractScopeName(pkg.name);
			if (scopeName) {
				scopes.push(scopeName);
			}
		}

		return scopes.sort();
	},
);
