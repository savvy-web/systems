/**
 * Shared helpers for `deps detect` and `deps regen` — both need to read
 * workspace package snapshots from the live working tree (the "after"
 * side of a dep diff that isn't pinned to a git ref) and to resolve the
 * merge-base for the default `--from` ref.
 *
 * @remarks
 * `WorkspaceSnapshotReader` covers the git-ref side via `git show`. This
 * module is the working-tree counterpart — staged and unstaged
 * `package.json` edits show up here, matching `analyze-branch`'s
 * coverage of the working tree.
 *
 * @internal
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";

import { GitError } from "../errors.js";
import type { WorkspaceSnapshot } from "../services/workspace-snapshot.js";

/**
 * Run `git merge-base <base> HEAD`, returning the SHA. Errors propagate
 * as {@link GitError}.
 *
 * @internal
 */
export function gitMergeBase(cwd: string, base: string): Effect.Effect<string, GitError> {
	return Effect.try({
		try: () =>
			execFileSync("git", ["merge-base", base, "HEAD"], {
				cwd,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim(),
		catch: (error) => {
			const stderr = (error as { stderr?: Buffer | string }).stderr;
			const text = typeof stderr === "string" ? stderr : (stderr?.toString() ?? "");
			return new GitError({
				command: `git merge-base ${base} HEAD`,
				cwd,
				reason: text.trim() || ((error as Error).message ?? String(error)),
			});
		},
	});
}

/**
 * Normalize a pnpm-workspace.yaml glob entry for filesystem expansion.
 *
 * `packages/**` collapses to `packages/*` (retains the wildcard so the
 * caller hits the directory-listing path); `packages/*` and a literal
 * `packages/foo` are passed through unchanged.
 *
 * Returning the literal-path form for `packages/**` (i.e., `"packages"`)
 * would route the caller through the "no wildcards" branch and silently
 * skip every child workspace.
 *
 * @internal
 */
export function normalizeWorkspaceGlob(glob: string): string {
	return glob.replace(/\/\*\*$/, "/*");
}

/**
 * Read every workspace package's `package.json` from the live working
 * tree, returning {@link WorkspaceSnapshot} entries matching the shape
 * `WorkspaceSnapshotReader.snapshotAt` produces for git refs.
 *
 * @remarks
 * Falls back to root-only when `pnpm-workspace.yaml` is missing or
 * unparseable. Uses `node:fs.readdirSync` for directory expansion
 * (portable across platforms — `execFileSync("ls")` is not).
 *
 * @internal
 */
export function snapshotFromWorktree(cwd: string): ReadonlyArray<WorkspaceSnapshot> {
	const snapshots: WorkspaceSnapshot[] = [];
	const dirs = new Set<string>([cwd]);

	for (const dir of expandWorkspaceDirs(cwd)) dirs.add(dir);

	for (const dir of dirs) {
		try {
			const pkgJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
				name?: string;
				version?: string;
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
				peerDependencies?: Record<string, string>;
				optionalDependencies?: Record<string, string>;
			};
			if (!pkgJson.name) continue;
			const rel = dir === cwd ? "." : dir.slice(cwd.length + 1);
			snapshots.push({
				name: pkgJson.name,
				relativePath: rel,
				version: pkgJson.version ?? "0.0.0",
				dependencies: pkgJson.dependencies ?? {},
				devDependencies: pkgJson.devDependencies ?? {},
				peerDependencies: pkgJson.peerDependencies ?? {},
				optionalDependencies: pkgJson.optionalDependencies ?? {},
			});
		} catch {
			// Missing package.json or parse error — skip.
		}
	}

	return snapshots;
}

function expandWorkspaceDirs(cwd: string): ReadonlyArray<string> {
	let yaml: string;
	try {
		yaml = readFileSync(join(cwd, "pnpm-workspace.yaml"), "utf8");
	} catch {
		return [];
	}

	const dirs: string[] = [];
	const lines = yaml.split(/\r?\n/);
	let inPackagesBlock = false;
	for (const line of lines) {
		if (/^\s*#/.test(line)) continue;
		if (/^\s*packages\s*:\s*$/.test(line)) {
			inPackagesBlock = true;
			continue;
		}
		if (!inPackagesBlock) continue;

		const m = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
		if (m) {
			const glob = normalizeWorkspaceGlob(m[1] as string);
			if (glob.includes("*") || glob.includes("?")) {
				const prefix = glob.includes("/") ? glob.slice(0, glob.lastIndexOf("/") + 1) : "";
				let entries: string[] = [];
				try {
					entries = readdirSync(join(cwd, prefix || "."));
				} catch {
					continue;
				}
				const regex = new RegExp(
					`^${glob
						.replace(/[.+^${}()|[\]\\]/g, "\\$&")
						.replace(/\*/g, "[^/]*")
						.replace(/\?/g, "[^/]")}$`,
				);
				for (const entry of entries) {
					const candidate = prefix ? `${prefix}${entry}` : entry;
					if (regex.test(candidate)) dirs.push(join(cwd, candidate));
				}
			} else {
				dirs.push(join(cwd, glob));
			}
		} else if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
			inPackagesBlock = false;
		}
	}
	return dirs;
}
