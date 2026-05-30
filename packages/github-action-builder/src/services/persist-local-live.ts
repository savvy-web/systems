/**
 * PersistLocalService Layer implementation.
 *
 */
import { createHash } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Effect, Layer } from "effect";
import { parse as parseYaml } from "yaml-effect";

import { ActionYmlPathError, PersistLocalError } from "../errors.js";
import type { Config } from "../schemas/config.js";
import type { PersistLocalResult, PersistLocalRunnerOptions } from "./persist-local.js";
import { PersistLocalService } from "./persist-local.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Compute SHA-256 hash of a file's contents.
 */
function fileHash(filePath: string): string {
	const content = readFileSync(filePath);
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Sync result for tracking copy statistics.
 */
interface SyncStats {
	copied: number;
	skipped: number;
}

/**
 * Sync a single file from src to dest using hash comparison.
 * Returns true if the file was copied, false if skipped.
 */
function syncFile(src: string, dest: string): boolean {
	if (existsSync(dest)) {
		const srcHash = fileHash(src);
		const destHash = fileHash(dest);
		if (srcHash === destHash) {
			return false;
		}
	}
	mkdirSync(dirname(dest), { recursive: true });
	copyFileSync(src, dest);
	return true;
}

/**
 * Recursively collect all file paths relative to a base directory.
 */
function walkDirectory(dir: string, base: string = dir): string[] {
	const files: string[] = [];
	if (!existsSync(dir)) return files;

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkDirectory(fullPath, base));
		} else {
			files.push(relative(base, fullPath));
		}
	}
	return files;
}

/**
 * Smart-sync a directory: copy changed files, remove stale dest files.
 */
function syncDirectory(srcDir: string, destDir: string): SyncStats {
	const stats: SyncStats = { copied: 0, skipped: 0 };

	// Sync source files to dest
	const srcFiles = walkDirectory(srcDir);
	for (const relPath of srcFiles) {
		const copied = syncFile(join(srcDir, relPath), join(destDir, relPath));
		if (copied) {
			stats.copied++;
		} else {
			stats.skipped++;
		}
	}

	// Remove stale files in dest that don't exist in source
	const srcFileSet = new Set(srcFiles);
	const destFiles = walkDirectory(destDir);
	for (const relPath of destFiles) {
		if (!srcFileSet.has(relPath)) {
			rmSync(join(destDir, relPath), { force: true });
			// Clean up empty parent directories
			let parent = dirname(join(destDir, relPath));
			while (parent !== destDir && existsSync(parent)) {
				const entries = readdirSync(parent);
				if (entries.length === 0) {
					rmSync(parent, { recursive: true });
					parent = dirname(parent);
				} else {
					break;
				}
			}
		}
	}

	return stats;
}

/**
 * Validate that action.yml runs paths resolve correctly relative to the destination.
 */
function validateActionYmlPaths(actionYmlPath: string, destDir: string): Effect.Effect<void, ActionYmlPathError> {
	return Effect.gen(function* () {
		if (!existsSync(actionYmlPath)) return;

		const content = readFileSync(actionYmlPath, "utf8");
		const parsed = (yield* parseYaml(content).pipe(Effect.catchAll(() => Effect.succeed(null)))) as {
			runs?: { main?: string; pre?: string; post?: string };
		} | null;

		if (!parsed?.runs) return;

		for (const entryType of ["main", "pre", "post"] as const) {
			const specifiedPath = parsed.runs[entryType];
			if (!specifiedPath) continue;

			const expectedPath = resolve(destDir, specifiedPath);
			if (!existsSync(expectedPath)) {
				return yield* Effect.fail(
					new ActionYmlPathError({
						entryType,
						specifiedPath,
						expectedPath,
					}),
				);
			}
		}
	});
}

// =============================================================================
// Act Template Content
// =============================================================================

const ACTRC_CONTENT = `--container-architecture linux/amd64
-W .github/workflows/act-test.yml
`;

const ACT_WORKFLOW_CONTENT = `name: Local Test
on:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: ./.github/actions/local
`;

// =============================================================================
// Formatting
// =============================================================================

function formatPersistResult(result: PersistLocalResult): string {
	const lines: string[] = [];

	if (result.success) {
		lines.push("Persist Local Summary:");
		lines.push(`  Output: ${result.outputPath}`);
		lines.push(`  Files copied: ${result.filesCopied}`);
		lines.push(`  Files skipped (unchanged): ${result.filesSkipped}`);
		if (result.actTemplateGenerated) {
			lines.push("  Act template files generated");
		}
	} else {
		lines.push(`Persist Local Failed: ${result.error}`);
	}

	return lines.join("\n");
}

// =============================================================================
// Layer Implementation
// =============================================================================

/**
 * Live implementation of PersistLocalService.
 */
export const PersistLocalServiceLive = Layer.succeed(PersistLocalService, {
	persist: (config: Config, options: PersistLocalRunnerOptions = {}) =>
		Effect.gen(function* () {
			const cwd = options.cwd ?? process.cwd();
			const outputPath = resolve(cwd, config.persistLocal.path);

			// Early return if disabled
			if (!config.persistLocal.enabled) {
				return {
					success: true,
					filesCopied: 0,
					filesSkipped: 0,
					actTemplateGenerated: false,
					outputPath,
				};
			}

			// Ensure output directory exists
			yield* Effect.try({
				try: () => mkdirSync(outputPath, { recursive: true }),
				/* v8 ignore next 5 - error branch requires fs permission failures */
				catch: (error) =>
					new PersistLocalError({
						path: outputPath,
						cause: error,
					}),
			});

			let totalCopied = 0;
			let totalSkipped = 0;

			// Sync action.yml
			const actionYmlSrc = resolve(cwd, "action.yml");
			const actionYmlDest = resolve(outputPath, "action.yml");
			if (existsSync(actionYmlSrc)) {
				const copied = yield* Effect.try({
					try: () => syncFile(actionYmlSrc, actionYmlDest),
					/* v8 ignore next 5 - error branch requires fs permission failures */
					catch: (error) =>
						new PersistLocalError({
							path: actionYmlSrc,
							cause: error,
						}),
				});
				if (copied) {
					totalCopied++;
				} else {
					totalSkipped++;
				}
			} else if (existsSync(actionYmlDest)) {
				// Remove stale destination action.yml if source was deleted
				rmSync(actionYmlDest, { force: true });
			}

			// Sync dist/ directory
			const distSrc = resolve(cwd, "dist");
			if (existsSync(distSrc) && statSync(distSrc).isDirectory()) {
				const distStats = yield* Effect.try({
					try: () => syncDirectory(distSrc, resolve(outputPath, "dist")),
					/* v8 ignore next 5 - error branch requires fs permission failures */
					catch: (error) =>
						new PersistLocalError({
							path: distSrc,
							cause: error,
						}),
				});
				totalCopied += distStats.copied;
				totalSkipped += distStats.skipped;
			}

			// Validate action.yml paths resolve in destination
			const destActionYml = resolve(outputPath, "action.yml");
			yield* validateActionYmlPaths(destActionYml, outputPath);

			// Generate act template files if requested and they don't exist
			let actTemplateGenerated = false;
			if (config.persistLocal.actTemplate) {
				const actrcPath = resolve(cwd, ".actrc");
				const actWorkflowPath = resolve(cwd, ".github/workflows/act-test.yml");

				if (!existsSync(actrcPath)) {
					yield* Effect.try({
						try: () => writeFileSync(actrcPath, ACTRC_CONTENT, "utf8"),
						/* v8 ignore next 5 - error branch requires fs permission failures */
						catch: (error) =>
							new PersistLocalError({
								path: actrcPath,
								cause: error,
							}),
					});
					actTemplateGenerated = true;
				}

				if (!existsSync(actWorkflowPath)) {
					yield* Effect.try({
						try: () => {
							mkdirSync(dirname(actWorkflowPath), { recursive: true });
							writeFileSync(actWorkflowPath, ACT_WORKFLOW_CONTENT, "utf8");
						},
						/* v8 ignore next 5 - error branch requires fs permission failures */
						catch: (error) =>
							new PersistLocalError({
								path: actWorkflowPath,
								cause: error,
							}),
					});
					actTemplateGenerated = true;
				}
			}

			return {
				success: true,
				filesCopied: totalCopied,
				filesSkipped: totalSkipped,
				actTemplateGenerated,
				outputPath,
			};
		}),

	formatResult: formatPersistResult,
});
