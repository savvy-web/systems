/**
 * Package manager detection for the commit-time hooks.
 *
 * Mirrors the husky hook detection: prefer `package.json#packageManager`,
 * fall back to lockfile presence in priority order pnpm \> yarn \> bun \> npm.
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

export function parsePackageManagerField(packageJsonContent: string): PackageManager | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(packageJsonContent);
	} catch {
		return null;
	}
	const field =
		typeof parsed === "object" && parsed !== null && "packageManager" in parsed
			? (parsed as { packageManager?: unknown }).packageManager
			: undefined;
	if (typeof field !== "string" || field.length === 0) return null;
	const name = field.split("@")[0];
	return VALID_PMS.has(name) ? (name as PackageManager) : null;
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
