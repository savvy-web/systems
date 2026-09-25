/**
 * Check command - validate current commitlint setup.
 *
 * @internal
 */

import type { SectionFileError, SectionParseError } from "@effected/templates";
import { CheckOutcome, ManagedSection } from "@effected/templates";
import type { PublishabilityDetector, WorkspaceDiscovery } from "@effected/workspaces";
import { VersioningStrategy } from "@effected/workspaces";
import {
	ChangesetConfigReader,
	Commitlint,
	SavvyBaseSection,
	SavvyHooksSection,
	SavvyToolchainSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyInstallBlock,
	savvyToolchainCheck,
} from "@savvy-web/silk-effects";
import type { Stdio } from "effect";
import { Effect, FileSystem, Option } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { Output } from "../../internal/output.js";
import { HUSKY_HOOK_PATH, POST_CHECKOUT_HOOK_PATH, POST_COMMIT_HOOK_PATH, POST_MERGE_HOOK_PATH } from "./constants.js";
import { SECTION_DEF, savvyCommitBlock } from "./init.js";

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
 * Detect the release format from the workspace's versioning strategy.
 *
 * @remarks
 * `VersioningStrategy.detect` (from `@effected/workspaces`) enumerates the
 * workspace and asks the ambient `PublishabilityDetector` which packages
 * publish — the CLI provides silk's own detector, so the "private plus
 * publishConfig.access is publishable" convention is applied by that layer
 * rather than by a filter written here. Fixed groups are a changesets concept,
 * so they are read from the changeset config and handed in as a plain argument.
 *
 * @returns Effect yielding the release format string
 */
const detectReleaseFormat = Effect.gen(function* () {
	const configReader = yield* ChangesetConfigReader;

	const config = yield* Effect.catch(configReader.read(process.cwd()), () => Effect.succeed(null));
	const fixedGroups = config?.fixed ?? [];

	const strategy = yield* Effect.catch(VersioningStrategy.detect({ fixedGroups }), () =>
		Effect.succeed(VersioningStrategy.classify({ packages: [] })),
	);

	return STRATEGY_TO_FORMAT[strategy.type] ?? ("semver" as Commitlint.ReleaseFormat);
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
	SectionParseError | SectionFileError | PlatformError,
	| ManagedSection
	| FileSystem.FileSystem
	| ChangesetConfigReader
	| PublishabilityDetector
	| WorkspaceDiscovery
	| Stdio.Stdio
> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const ms = yield* ManagedSection;

		yield* Output.heading("commitlint configuration");

		const foundConfig = yield* findConfigFile(fs);
		if (foundConfig) {
			yield* Output.ok(`Config file: ${foundConfig}`);
		} else {
			yield* Output.fail(`No commitlint config file found`);
		}

		const hasHuskyHook = yield* fs.exists(HUSKY_HOOK_PATH);
		if (hasHuskyHook) {
			yield* Output.ok(`Husky hook: ${HUSKY_HOOK_PATH}`);
		} else {
			yield* Output.fail(`No husky commit-msg hook found`);
		}

		// Managed section status
		let sectionsHealthy = true;
		if (hasHuskyHook) {
			const baseStatus = yield* ms.check(HUSKY_HOOK_PATH, SavvyBaseSection.section(savvyBasePreamble()));
			if (CheckOutcome.$is("UpToDate")(baseStatus)) {
				yield* Output.ok(`Base section: up-to-date`);
			} else if (CheckOutcome.$is("Drifted")(baseStatus)) {
				sectionsHealthy = false;
				yield* Output.warn(`Base section: outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Output.skip(`Base section: not found (run 'savvy init' to add)`);
			}

			const block = yield* ms.read(HUSKY_HOOK_PATH, SECTION_DEF);
			if (Option.isSome(block)) {
				const configPath = extractConfigPathFromManaged(block.value.content);
				if (configPath) {
					const status = yield* ms.check(HUSKY_HOOK_PATH, savvyCommitBlock(configPath));
					if (CheckOutcome.$is("UpToDate")(status)) {
						yield* Output.ok(`Commit section: up-to-date`);
					} else {
						sectionsHealthy = false;
						yield* Output.warn(`Commit section: outdated (run 'savvy init' to update)`);
					}
				} else {
					sectionsHealthy = false;
					yield* Output.warn(`Commit section: outdated (run 'savvy init' to update)`);
				}
			} else {
				sectionsHealthy = false;
				yield* Output.skip(`Commit section: not found (run 'savvy init' to add)`);
			}
		}

		// Hygiene hooks status (co-owned savvy-hooks section)
		for (const hookPath of [POST_CHECKOUT_HOOK_PATH, POST_MERGE_HOOK_PATH, POST_COMMIT_HOOK_PATH]) {
			const hygieneExists = yield* fs.exists(hookPath);
			if (!hygieneExists) {
				sectionsHealthy = false;
				yield* Output.skip(`Hygiene hook: ${hookPath} not found (run 'savvy init' to add)`);
				continue;
			}
			const hygieneStatus = yield* ms.check(hookPath, SavvyHooksSection.section(savvyHooksHygiene()));
			if (CheckOutcome.$is("UpToDate")(hygieneStatus)) {
				yield* Output.ok(`Hygiene hook: ${hookPath}`);
			} else if (CheckOutcome.$is("Drifted")(hygieneStatus)) {
				sectionsHealthy = false;
				yield* Output.warn(`Hygiene hook: ${hookPath} outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Output.skip(`Hygiene hook: ${hookPath} section not found (run 'savvy init' to add)`);
			}

			// post-commit carries hygiene only; the other two also carry savvy-toolchain
			// and savvy-install. The install block differs per hook, so which one is
			// checked has to follow the path.
			if (hookPath === POST_COMMIT_HOOK_PATH) continue;
			const installHook = hookPath === POST_CHECKOUT_HOOK_PATH ? "post-checkout" : "post-merge";
			const installStatus = yield* ms.check(hookPath, savvyInstallBlock(installHook));
			if (CheckOutcome.$is("UpToDate")(installStatus)) {
				yield* Output.ok(`Dependency install: ${hookPath}`);
			} else if (CheckOutcome.$is("Drifted")(installStatus)) {
				sectionsHealthy = false;
				yield* Output.warn(`Dependency install: ${hookPath} outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Output.skip(`Dependency install: ${hookPath} section not found (run 'savvy init' to add)`);
			}

			const toolchainStatus = yield* ms.check(hookPath, SavvyToolchainSection.section(savvyToolchainCheck()));
			if (CheckOutcome.$is("UpToDate")(toolchainStatus)) {
				yield* Output.ok(`Toolchain check: ${hookPath}`);
			} else if (CheckOutcome.$is("Drifted")(toolchainStatus)) {
				sectionsHealthy = false;
				yield* Output.warn(`Toolchain check: ${hookPath} outdated (run 'savvy init' to update)`);
			} else {
				sectionsHealthy = false;
				yield* Output.skip(`Toolchain check: ${hookPath} section not found (run 'savvy init' to add)`);
			}
		}

		const hasDCOFile = yield* fs.exists(DCO_FILE_PATH);
		if (hasDCOFile) {
			yield* Output.ok(`DCO file: ${DCO_FILE_PATH}`);
		} else {
			yield* Output.skip(`No DCO file (signoff not required)`);
		}

		yield* Output.line("");
		yield* Output.heading("Detected settings");
		yield* Output.detail(`DCO required: ${Commitlint.detectDCO()}`);

		const releaseFormat = yield* detectReleaseFormat;
		yield* Output.detail(`Release format: ${releaseFormat}`);

		const scopes = yield* Effect.catch(Commitlint.detectScopes, () => Effect.succeed([] as string[]));
		const scopeDisplay = scopes.length > 0 ? scopes.join(", ") : "(none - not a monorepo or no packages found)";
		yield* Output.detail(`Detected scopes: ${scopeDisplay}`);

		yield* Output.line("");
		const hasIssues = !foundConfig || !hasHuskyHook || !sectionsHealthy;
		if (hasIssues) {
			yield* Output.fail(`Commitlint needs configuration. Run: savvy init`);
		} else {
			yield* Output.ok(`Commitlint is configured correctly.`);
		}
	});
}
