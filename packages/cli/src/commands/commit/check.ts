/**
 * Check command - validate current commitlint setup.
 *
 * @internal
 */
import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import type { SectionParseError } from "@savvy-web/silk-effects";
import {
	CheckResult,
	Commitlint,
	ManagedSection,
	SavvyBaseSection,
	SavvyHooksSection,
	VersioningStrategy,
	savvyBasePreamble,
	savvyHooksHygiene,
} from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { WorkspaceDiscovery } from "workspaces-effect";
import {
	CHECK_MARK,
	HUSKY_HOOK_PATH,
	POST_CHECKOUT_HOOK_PATH,
	POST_COMMIT_HOOK_PATH,
	POST_MERGE_HOOK_PATH,
	WARNING,
} from "./constants.js";
import { SECTION_DEF, savvyCommitBlock } from "./init.js";

/** Unicode cross symbol. */
const CROSS_MARK = "✗";

/** Unicode bullet symbol. */
const BULLET = "•";

/** Possible commitlint configuration file names, in priority order. */
const CONFIG_FILES = [
	"commitlint.config.ts",
	"commitlint.config.mts",
	"commitlint.config.cts",
	"commitlint.config.js",
	"commitlint.config.mjs",
	"commitlint.config.cjs",
	"lib/configs/commitlint.config.ts",
	"lib/configs/commitlint.config.mts",
	"lib/configs/commitlint.config.cts",
	"lib/configs/commitlint.config.js",
	"lib/configs/commitlint.config.mjs",
	"lib/configs/commitlint.config.cjs",
	".commitlintrc",
	".commitlintrc.json",
	".commitlintrc.yaml",
	".commitlintrc.yml",
	".commitlintrc.js",
	".commitlintrc.cjs",
	".commitlintrc.mjs",
	".commitlintrc.ts",
	".commitlintrc.cts",
	".commitlintrc.mts",
] as const;

/** DCO file path. */
const DCO_FILE_PATH = "DCO";

/** Maps versioning strategy types to release formats. */
const STRATEGY_TO_FORMAT: Record<string, Commitlint.ReleaseFormat> = {
	single: "semver",
	"fixed-group": "semver",
	independent: "packages",
};

/**
 * Find the first existing config file.
 *
 * @param fs - FileSystem service
 * @returns Effect yielding the config file name or null
 */
function findConfigFile(fs: FileSystem.FileSystem) {
	return Effect.gen(function* () {
		for (const file of CONFIG_FILES) {
			if (yield* fs.exists(file)) {
				return file;
			}
		}
		return null;
	});
}

/**
 * Extract the config path from managed section content.
 *
 * @param managedContent - The content between managed section markers
 * @returns The config path found, or null if not found
 */
function extractConfigPathFromManaged(managedContent: string): string | null {
	const match = managedContent.match(/commitlint --config "\$ROOT\/([^"]+)"/);
	return match ? match[1] : null;
}

/**
 * Detect the release format using silk-effects versioning service.
 *
 * @returns Effect yielding the release format string
 */
const detectReleaseFormat = Effect.gen(function* () {
	const versioning = yield* VersioningStrategy;
	const discovery = yield* WorkspaceDiscovery;

	const packages = yield* Effect.catchAll(discovery.listPackages(), () => Effect.succeed([]));

	const publishableNames = packages
		.filter((pkg) => !pkg.private || pkg.publishConfig?.access !== undefined)
		.map((pkg) => pkg.name);

	const result = yield* Effect.catchAll(versioning.detect(publishableNames, process.cwd()), () =>
		Effect.succeed({ type: "single" as const }),
	);

	return STRATEGY_TO_FORMAT[result.type] ?? ("semver" as Commitlint.ReleaseFormat);
});

/**
 * Run the check validation pipeline.
 *
 * Exported so Task B6's unified `savvy check` orchestrator can invoke the
 * commitlint check step directly without going through the CLI command layer.
 *
 * @returns An Effect that performs validation and logs results
 *
 * @internal
 */
export function runCommitCheck(): Effect.Effect<
	void,
	SectionParseError | PlatformError,
	ManagedSection | FileSystem.FileSystem | VersioningStrategy | WorkspaceDiscovery
> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const ms = yield* ManagedSection;

		yield* Effect.log("Checking commitlint configuration...\n");

		const foundConfig = yield* findConfigFile(fs);
		if (foundConfig) {
			yield* Effect.log(`${CHECK_MARK} Config file: ${foundConfig}`);
		} else {
			yield* Effect.log(`${CROSS_MARK} No commitlint config file found`);
		}

		const hasHuskyHook = yield* fs.exists(HUSKY_HOOK_PATH);
		if (hasHuskyHook) {
			yield* Effect.log(`${CHECK_MARK} Husky hook: ${HUSKY_HOOK_PATH}`);
		} else {
			yield* Effect.log(`${CROSS_MARK} No husky commit-msg hook found`);
		}

		// Managed section status
		let sectionsHealthy = true;
		if (hasHuskyHook) {
			const baseStatus = yield* ms.check(HUSKY_HOOK_PATH, SavvyBaseSection.block(savvyBasePreamble()));
			if (CheckResult.$is("Found")(baseStatus) && baseStatus.isUpToDate) {
				yield* Effect.log(`${CHECK_MARK} Base section: up-to-date`);
			} else if (CheckResult.$is("Found")(baseStatus)) {
				sectionsHealthy = false;
				yield* Effect.log(`${WARNING} Base section: outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Effect.log(`${BULLET} Base section: not found (run 'savvy init' to add)`);
			}

			const block = yield* ms.read(HUSKY_HOOK_PATH, SECTION_DEF);
			if (block) {
				const configPath = extractConfigPathFromManaged(block.content);
				if (configPath) {
					const status = yield* ms.check(HUSKY_HOOK_PATH, savvyCommitBlock(configPath));
					if (CheckResult.$is("Found")(status) && status.isUpToDate) {
						yield* Effect.log(`${CHECK_MARK} Commit section: up-to-date`);
					} else {
						sectionsHealthy = false;
						yield* Effect.log(`${WARNING} Commit section: outdated (run 'savvy init' to update)`);
					}
				} else {
					sectionsHealthy = false;
					yield* Effect.log(`${WARNING} Commit section: outdated (run 'savvy init' to update)`);
				}
			} else {
				sectionsHealthy = false;
				yield* Effect.log(`${BULLET} Commit section: not found (run 'savvy init' to add)`);
			}
		}

		// Hygiene hooks status (co-owned savvy-hooks section)
		for (const hookPath of [POST_CHECKOUT_HOOK_PATH, POST_MERGE_HOOK_PATH, POST_COMMIT_HOOK_PATH]) {
			const hygieneExists = yield* fs.exists(hookPath);
			if (!hygieneExists) {
				sectionsHealthy = false;
				yield* Effect.log(`${BULLET} Hygiene hook: ${hookPath} not found (run 'savvy init' to add)`);
				continue;
			}
			const hygieneStatus = yield* ms.check(hookPath, SavvyHooksSection.block(savvyHooksHygiene()));
			if (CheckResult.$is("Found")(hygieneStatus) && hygieneStatus.isUpToDate) {
				yield* Effect.log(`${CHECK_MARK} Hygiene hook: ${hookPath}`);
			} else if (CheckResult.$is("Found")(hygieneStatus)) {
				sectionsHealthy = false;
				yield* Effect.log(`${WARNING} Hygiene hook: ${hookPath} outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Effect.log(`${BULLET} Hygiene hook: ${hookPath} section not found (run 'savvy init' to add)`);
			}
		}

		const hasDCOFile = yield* fs.exists(DCO_FILE_PATH);
		if (hasDCOFile) {
			yield* Effect.log(`${CHECK_MARK} DCO file: ${DCO_FILE_PATH}`);
		} else {
			yield* Effect.log(`${BULLET} No DCO file (signoff not required)`);
		}

		yield* Effect.log("\nDetected settings:");
		yield* Effect.log(`  DCO required: ${Commitlint.detectDCO()}`);

		const releaseFormat = yield* detectReleaseFormat;
		yield* Effect.log(`  Release format: ${releaseFormat}`);

		const scopes = yield* Effect.catchAll(Commitlint.detectScopes, () => Effect.succeed([] as string[]));
		const scopeDisplay = scopes.length > 0 ? scopes.join(", ") : "(none - not a monorepo or no packages found)";
		yield* Effect.log(`  Detected scopes: ${scopeDisplay}`);

		yield* Effect.log("");
		const hasIssues = !foundConfig || !hasHuskyHook || !sectionsHealthy;
		if (hasIssues) {
			yield* Effect.log(`${CROSS_MARK} Commitlint needs configuration. Run: savvy init`);
		} else {
			yield* Effect.log(`${CHECK_MARK} Commitlint is configured correctly.`);
		}
	});
}
