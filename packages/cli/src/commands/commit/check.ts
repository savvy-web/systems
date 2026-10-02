/**
 * Check command - validate current commitlint setup.
 *
 * @internal
 */

import type { Block } from "@effected/cli";
import { CliExit } from "@effected/cli";
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
import { Effect, FileSystem, Option } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ReportEnv } from "../../internal/report.js";
import { Report } from "../../internal/report.js";
import type { CheckSection, SectionState } from "../check-section.js";
import { hookTable } from "../check-section.js";
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

/** What {@link commitCheckSection} needs from the environment. */
type CommitCheckRequirements =
	| ManagedSection
	| FileSystem.FileSystem
	| ChangesetConfigReader
	| PublishabilityDetector
	| WorkspaceDiscovery;

/**
 * Check the commitlint setup and return it as a {@link CheckSection}.
 *
 * @remarks
 * Severity rule: anything `savvy init` would write or rewrite — a missing
 * config file or `commit-msg` hook, a hook file or managed section that is
 * absent or drifted — is a finding (`✗`, verdict `failure`). A missing DCO
 * file is advisory (`↷`): signoff is simply not required.
 *
 * @internal
 */
export function commitCheckSection(): Effect.Effect<
	CheckSection,
	SectionParseError | SectionFileError | PlatformError,
	CommitCheckRequirements
> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const ms = yield* ManagedSection;
		const blocks: Array<Block> = [];
		const rows: Array<readonly [string, string, SectionState]> = [];
		const stateOf = (outcome: CheckOutcome): SectionState =>
			CheckOutcome.$is("UpToDate")(outcome)
				? "up-to-date"
				: CheckOutcome.$is("Drifted")(outcome)
					? "outdated"
					: "missing";

		const foundConfig = yield* findConfigFile(fs);
		blocks.push(
			foundConfig ? Report.ok(`Config file: ${foundConfig}`) : Report.fail("No commitlint config file found"),
		);

		const hasHuskyHook = yield* fs.exists(HUSKY_HOOK_PATH);
		blocks.push(
			hasHuskyHook ? Report.ok(`Husky hook: ${HUSKY_HOOK_PATH}`) : Report.fail("No husky commit-msg hook found"),
		);

		if (hasHuskyHook) {
			rows.push([
				HUSKY_HOOK_PATH,
				"savvy-base",
				stateOf(yield* ms.check(HUSKY_HOOK_PATH, SavvyBaseSection.section(savvyBasePreamble()))),
			]);

			const block = yield* ms.read(HUSKY_HOOK_PATH, SECTION_DEF);
			if (Option.isSome(block)) {
				const configPath = extractConfigPathFromManaged(block.value.content);
				const state: SectionState = configPath
					? CheckOutcome.$is("UpToDate")(yield* ms.check(HUSKY_HOOK_PATH, savvyCommitBlock(configPath)))
						? "up-to-date"
						: "outdated"
					: "outdated";
				rows.push([HUSKY_HOOK_PATH, "savvy-commit", state]);
			} else {
				rows.push([HUSKY_HOOK_PATH, "savvy-commit", "missing"]);
			}
		}

		// Hygiene hooks: the co-owned savvy-hooks section; post-checkout and
		// post-merge also carry savvy-install (which differs per hook, so the
		// variant checked follows the path) and savvy-toolchain.
		for (const hookPath of [POST_CHECKOUT_HOOK_PATH, POST_MERGE_HOOK_PATH, POST_COMMIT_HOOK_PATH]) {
			if (!(yield* fs.exists(hookPath))) {
				rows.push([hookPath, "(hook file)", "missing"]);
				continue;
			}
			rows.push([
				hookPath,
				"savvy-hooks",
				stateOf(yield* ms.check(hookPath, SavvyHooksSection.section(savvyHooksHygiene()))),
			]);
			if (hookPath === POST_COMMIT_HOOK_PATH) continue;
			const installHook = hookPath === POST_CHECKOUT_HOOK_PATH ? "post-checkout" : "post-merge";
			rows.push([hookPath, "savvy-install", stateOf(yield* ms.check(hookPath, savvyInstallBlock(installHook)))]);
			rows.push([
				hookPath,
				"savvy-toolchain",
				stateOf(yield* ms.check(hookPath, SavvyToolchainSection.section(savvyToolchainCheck()))),
			]);
		}
		if (rows.length > 0) blocks.push(hookTable(rows));

		const hasDCOFile = yield* fs.exists(DCO_FILE_PATH);
		blocks.push(
			hasDCOFile ? Report.ok(`DCO file: ${DCO_FILE_PATH}`) : Report.skip("No DCO file (signoff not required)"),
		);

		const releaseFormat = yield* detectReleaseFormat;
		const scopes = yield* Effect.catch(Commitlint.detectScopes, () => Effect.succeed([] as string[]));
		const scopeDisplay = scopes.length > 0 ? scopes.join(", ") : "(none - not a monorepo or no packages found)";
		blocks.push(
			Report.line("Detected settings"),
			Report.detail(`DCO required: ${Commitlint.detectDCO()}`),
			Report.detail(`Release format: ${releaseFormat}`),
			Report.detail(`Detected scopes: ${scopeDisplay}`),
		);

		const sectionsHealthy = rows.every(([, , state]) => state === "up-to-date");
		const hasIssues = !foundConfig || !hasHuskyHook || !sectionsHealthy;
		blocks.push(
			hasIssues ? Report.fail("Commitlint needs configuration") : Report.ok("Commitlint is configured correctly"),
		);
		return { title: "commitlint", blocks, verdict: hasIssues ? "failure" : "success", fixedByInit: hasIssues };
	});
}

/**
 * Check the commitlint setup, print its report on stdout, and set exit code 1
 * when it found a misconfiguration (see {@link commitCheckSection}).
 *
 * @returns An Effect that performs validation and prints its report
 *
 * @internal
 */
export function runCommitCheck(): Effect.Effect<
	void,
	SectionParseError | SectionFileError | PlatformError,
	CommitCheckRequirements | ReportEnv | CliExit
> {
	return Effect.gen(function* () {
		const section = yield* commitCheckSection();
		yield* Report.print([Report.heading(section.title), ...section.blocks]);
		if (section.verdict === "failure") yield* CliExit.set(1);
	});
}
