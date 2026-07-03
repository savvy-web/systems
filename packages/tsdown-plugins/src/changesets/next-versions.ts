import { getReleasePlan } from "@changesets/get-release-plan";
import { getPackages } from "@manypkg/get-packages";

/**
 * Result of resolving next release versions for a workspace.
 *
 * @public
 */
export interface NextVersions {
	/** Monorepo root containing `.changeset/` (or `cwd` when no workspace was found). */
	readonly root: string;
	/** Canonical package name `->` next release version (current version when unbumped). */
	readonly versions: ReadonlyMap<string, string>;
}

/**
 * Resolve the next release version of every workspace package from pending changesets.
 *
 * Walks up from `cwd` to the monorepo root via `@manypkg/get-packages`, seeds the map with
 * each package's CURRENT version, then overlays `newVersion` for changeset-affected packages
 * via `@changesets/get-release-plan`. Never rejects: any failure (not a workspace, missing
 * `.changeset/config.json`, parse error) degrades to current versions (or an empty map).
 * @public
 */
export async function resolveNextVersions(cwd: string): Promise<NextVersions> {
	try {
		const packages = await getPackages(cwd);
		// tool type "root" means getPackages found no workspace manager (pnpm/yarn/lerna/etc.),
		// treating the cwd as a standalone root with itself as the only "package". That is not
		// a multi-package workspace, so return an empty map rather than exposing the root pkg.
		if (packages.tool.type === "root") {
			return { root: packages.rootDir, versions: new Map() };
		}
		const versions = new Map<string, string>();
		for (const p of packages.packages) {
			const { name, version } = p.packageJson;
			if (name && version) versions.set(name, version);
		}
		try {
			const plan = await getReleasePlan(packages.rootDir);
			// plan.releases includes type:"none" entries (unbumped dependents) whose newVersion equals
			// the current version, so overlaying every release is safe.
			for (const r of plan.releases) versions.set(r.name, r.newVersion);
		} catch {
			// No `.changeset/config.json` (or unreadable): keep current versions.
		}
		return { root: packages.rootDir, versions };
	} catch {
		// Not a workspace / cannot enumerate packages: optimistic becomes a full no-op.
		return { root: cwd, versions: new Map() };
	}
}
