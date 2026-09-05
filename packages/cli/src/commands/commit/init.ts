/**
 * Init command - bootstrap commitlint configuration.
 *
 * @internal
 */
import { chmod } from "node:fs/promises";
import { dirname } from "node:path";
import type { Section, SectionFileError, SectionParseError, SectionRenderError } from "@effected/templates";
import { CommentStyle, ManagedSection, SectionId } from "@effected/templates";
import type { SavvyInstallHook } from "@savvy-web/silk-effects";
import {
	SavvyBaseSection,
	SavvyHooksSection,
	SavvyToolchainSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyInstallBlock,
	savvyToolSection,
	savvyToolchainCheck,
} from "@savvy-web/silk-effects";
import { Effect, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";
import {
	CHECK_MARK,
	HUSKY_HOOK_PATH,
	POST_CHECKOUT_HOOK_PATH,
	POST_COMMIT_HOOK_PATH,
	POST_MERGE_HOOK_PATH,
	WARNING,
} from "./constants.js";

/** Executable file permission mode. */
const EXECUTABLE_MODE = 0o755;

/** Section definition for the savvy-commit tool section (identity for read/check/remove). */
// Key spelled uppercase: the kit renders it verbatim into the markers already
// present in consumer hook files. See schemas/SavvySections.ts.
export const SECTION_DEF: SectionId = SectionId.make({ key: "SAVVY-COMMIT", commentStyle: CommentStyle.hash });

/** Header written when creating a fresh commit-msg hook. */
const COMMIT_MSG_HEADER =
	"#!/usr/bin/env sh\n# Commit-msg hook with savvy managed sections\n# Custom hooks can go above, below, or between the managed sections\n\n";

/**
 * The hygiene hooks, each paired with the install variant it should carry.
 *
 * `undefined` means the hook gets hygiene only — post-commit fires on every
 * commit, where neither a drift warning nor an install is worth the noise.
 */
const HYGIENE_HOOKS = [
	[POST_CHECKOUT_HOOK_PATH, "post-checkout"],
	[POST_MERGE_HOOK_PATH, "post-merge"],
	[POST_COMMIT_HOOK_PATH, undefined],
] as const satisfies ReadonlyArray<readonly [string, SavvyInstallHook | undefined]>;

/** Header written when creating a fresh hygiene hook (post-checkout / post-merge / post-commit). */
const HYGIENE_HEADER =
	"#!/usr/bin/env sh\n# Managed by savvy-hooks\n# Custom hooks can go above or below the managed section\n\n";

/**
 * Build the commitlint command run inside the savvy-commit tool section.
 *
 * @param configPath - Path to the commitlint config file (relative to repo root)
 */
function commitlintCommand(configPath: string): string {
	return `commitlint --config "$ROOT/${configPath}" --edit "$1"`;
}

/**
 * Build the savvy-commit tool section block for the given config path.
 *
 * @remarks
 * Depends on the savvy-base preamble (`in_ci`, `pm_exec`) preceding it in the hook.
 *
 * @remarks
 * Exported for reuse by the check command, which rebuilds this block to compare against the on-disk section.
 */
export function savvyCommitBlock(configPath: string): Section {
	return savvyToolSection("savvy-commit", commitlintCommand(configPath));
}

/**
 * Rendered content of the savvy-commit tool section.
 *
 * @remarks
 * Named export retained for the check command and tests; equals
 * `savvyCommitBlock(configPath).content`.
 *
 * @param configPath - Path to the commitlint config file
 */
export function generateManagedContent(configPath: string): string {
	return savvyCommitBlock(configPath).content;
}

/** Ensure a hook file exists, writing `header` if it does not. */
function ensureHookFile(path: string, header: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(path);
		if (!exists) {
			yield* fs.writeFileString(path, header);
		}
	});
}

/** Content for the commitlint config file. */
const CONFIG_CONTENT = `import { CommitlintConfig } from "@savvy-web/silk/commitlint";

export default CommitlintConfig.silk();
`;

/** Make a file executable. */
function makeExecutable(path: string) {
	return Effect.tryPromise({
		try: () => chmod(path, EXECUTABLE_MODE),
		catch: (e) => new Error(String(e)),
	});
}

/**
 * Run the full init pipeline.
 *
 * Exported so Task B5's unified `savvy init` orchestrator can invoke the
 * commitlint init step directly without going through the CLI command layer.
 *
 * @param opts - The same options the CLI command receives
 * @returns An Effect that performs initialization
 *
 * @internal
 */
export function runCommitInit(opts: {
	force: boolean;
	config: string;
}): Effect.Effect<
	void,
	Error | SectionParseError | SectionRenderError | SectionFileError | PlatformError,
	ManagedSection | FileSystem.FileSystem
> {
	const { force, config } = opts;
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const ms = yield* ManagedSection;

		if (config.startsWith("/")) {
			yield* Effect.fail(new Error("Config path must be relative to repository root, not absolute"));
		}

		yield* Effect.log("Initializing commitlint configuration...\n");

		yield* fs.makeDirectory(".husky", { recursive: true });

		// commit-msg: savvy-base preamble then savvy-commit tool section, in order.
		if (force) {
			yield* fs.writeFileString(HUSKY_HOOK_PATH, COMMIT_MSG_HEADER);
		} else {
			yield* ensureHookFile(HUSKY_HOOK_PATH, COMMIT_MSG_HEADER);
		}
		const commitResults = yield* ms.syncAll(HUSKY_HOOK_PATH, [
			SavvyBaseSection.section(savvyBasePreamble()),
			savvyCommitBlock(config),
		]);
		yield* makeExecutable(HUSKY_HOOK_PATH);
		yield* Effect.log(
			`${CHECK_MARK} ${force ? "Replaced" : "Synced"} ${HUSKY_HOOK_PATH} (${commitResults.map((r) => r._tag).join(", ")})`,
		);

		// post-checkout / post-merge / post-commit: co-owned savvy-hooks hygiene.
		// post-checkout and post-merge additionally carry the savvy-toolchain drift check
		// and the savvy-install dependency sync — they fire exactly when a pin bump or an
		// incoming lockfile can leave the local tree behind. post-commit carries neither:
		// it fires on every commit, which is noisier than either is worth. The paired
		// SavvyInstallHook is what tells the install block which arguments git will hand
		// it, so it travels with the path rather than being re-derived inside the loop.
		for (const [hookPath, installHook] of HYGIENE_HOOKS) {
			yield* ensureHookFile(hookPath, HYGIENE_HEADER);
			const sections = [SavvyHooksSection.section(savvyHooksHygiene())];
			if (installHook !== undefined) {
				sections.push(SavvyToolchainSection.section(savvyToolchainCheck()));
				sections.push(savvyInstallBlock(installHook));
			}
			yield* ms.syncAll(hookPath, sections);
			yield* makeExecutable(hookPath);
			yield* Effect.log(`${CHECK_MARK} Synced ${hookPath}`);
		}

		// Config file.
		const configExists = yield* fs.exists(config);
		if (configExists && !force) {
			yield* Effect.log(`${WARNING} ${config} already exists (use --force to overwrite)`);
		} else {
			const configDir = dirname(config);
			if (configDir && configDir !== ".") {
				yield* fs.makeDirectory(configDir, { recursive: true });
			}
			yield* fs.writeFileString(config, CONFIG_CONTENT);
			yield* Effect.log(`${CHECK_MARK} Created ${config}`);
		}

		yield* Effect.log("\nDone! Install @commitlint/cli if not already installed.");
	});
}
