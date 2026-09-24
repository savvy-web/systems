/**
 * Package manager detection for the commit-time hooks.
 *
 * Mirrors the husky hook detection: prefer `package.json#devEngines.packageManager`
 * (the first entry when it is an array), then the legacy `packageManager` field,
 * then lockfile presence in priority order pnpm \> yarn \> bun \> npm.
 *
 * @internal
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

const VALID_PMS: ReadonlySet<string> = new Set(["pnpm", "yarn", "bun", "npm"]);

export interface LockfilePresence {
	pnpm: boolean;
	yarn: boolean;
	bun: boolean;
}

const toPackageManager = (name: unknown): PackageManager | null =>
	typeof name === "string" && VALID_PMS.has(name) ? (name as PackageManager) : null;

const devEnginesName = (manifest: Record<string, unknown>): unknown => {
	const devEngines = manifest.devEngines;
	if (typeof devEngines !== "object" || devEngines === null) return undefined;
	const declared = (devEngines as { packageManager?: unknown }).packageManager;
	const first: unknown = Array.isArray(declared) ? declared[0] : declared;
	return typeof first === "object" && first !== null ? (first as { name?: unknown }).name : undefined;
};

export function parsePackageManagerField(packageJsonContent: string): PackageManager | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(packageJsonContent);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const manifest = parsed as Record<string, unknown>;
	const fromDevEngines = toPackageManager(devEnginesName(manifest));
	if (fromDevEngines !== null) return fromDevEngines;
	const field = manifest.packageManager;
	if (typeof field !== "string" || field.length === 0) return null;
	return toPackageManager(field.split("@")[0]);
}

export function detectFromLockfiles(presence: LockfilePresence): PackageManager {
	if (presence.pnpm) return "pnpm";
	if (presence.yarn) return "yarn";
	if (presence.bun) return "bun";
	return "npm";
}

export async function detectPackageManager(root: string): Promise<PackageManager> {
	try {
		const content = await readFile(join(root, "package.json"), "utf8");
		const fromField = parsePackageManagerField(content);
		if (fromField !== null) return fromField;
	} catch {
		// fall through to lockfile detection
	}
	return detectFromLockfiles({
		pnpm: existsSync(join(root, "pnpm-lock.yaml")),
		yarn: existsSync(join(root, "yarn.lock")),
		bun: existsSync(join(root, "bun.lock")),
	});
}
