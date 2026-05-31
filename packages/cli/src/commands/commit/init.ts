/**
 * Init command - bootstrap commitlint configuration.
 *
 * @internal
 */
import { chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { Command, Options } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import type { PlatformError } from "@effect/platform/Error";
import type { SectionBlock, SectionWriteError } from "@savvy-web/silk-effects";
import {
	ManagedSection,
	SavvyBaseSection,
	SavvyHooksSection,
	SectionDefinition,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyToolSection,
} from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { CHECK_MARK, HUSKY_HOOK_PATH, POST_CHECKOUT_HOOK_PATH, POST_MERGE_HOOK_PATH, WARNING } from "./constants.js";

/** Executable file permission mode. */
const EXECUTABLE_MODE = 0o755;

/** Default path for the commitlint config file. */
const DEFAULT_CONFIG_PATH = "lib/configs/commitlint.config.ts";

/** Section definition for the savvy-commit tool section (identity for read/check/remove). */
export const SECTION_DEF = SectionDefinition.make({ toolName: "savvy-commit" });

/** Header written when creating a fresh commit-msg hook. */
const COMMIT_MSG_HEADER =
	"#!/usr/bin/env sh\n# Commit-msg hook with savvy managed sections\n# Custom hooks can go above, below, or between the managed sections\n\n";

/** Header written when creating a fresh hygiene hook (post-checkout / post-merge). */
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
export function savvyCommitBlock(configPath: string): SectionBlock {
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

/* v8 ignore start -- CLI option definitions; handler tested individually */
const forceOption = Options.boolean("force").pipe(
	Options.withAlias("f"),
	Options.withDescription(
		"Overwrite the commit-msg hook and config file entirely (managed sections in post-checkout/post-merge are never force-reset)",
	),
	Options.withDefault(false),
);

const configOption = Options.text("config").pipe(
	Options.withAlias("c"),
	Options.withDescription("Relative path for the commitlint config file (from repo root)"),
	Options.withDefault(DEFAULT_CONFIG_PATH),
);
/* v8 ignore stop */

/** Content for the commitlint config file. */
const CONFIG_CONTENT = `import { CommitlintConfig, type CommitlintUserConfig } from "@savvy-web/silk/commitlint";

const config: CommitlintUserConfig = CommitlintConfig.silk();

export default config;
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
}): Effect.Effect<void, Error | SectionWriteError | PlatformError, ManagedSection | FileSystem.FileSystem> {
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
		const commitResults = yield* ms.syncMany(HUSKY_HOOK_PATH, [
			SavvyBaseSection.block(savvyBasePreamble()),
			savvyCommitBlock(config),
		]);
		yield* makeExecutable(HUSKY_HOOK_PATH);
		yield* Effect.log(
			`${CHECK_MARK} ${force ? "Replaced" : "Synced"} ${HUSKY_HOOK_PATH} (${commitResults.map((r) => r._tag).join(", ")})`,
		);

		// post-checkout / post-merge: co-owned savvy-hooks hygiene.
		for (const hookPath of [POST_CHECKOUT_HOOK_PATH, POST_MERGE_HOOK_PATH]) {
			yield* ensureHookFile(hookPath, HYGIENE_HEADER);
			yield* ms.sync(hookPath, SavvyHooksSection.block(savvyHooksHygiene()));
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

/**
 * Init command implementation.
 *
 * @remarks
 * Writes:
 * - `.husky/commit-msg` — savvy-base preamble + savvy-commit tool section.
 * - `.husky/post-checkout` and `.husky/post-merge` — savvy-hooks hygiene
 *   (co-owned with `@savvy-web/lint-staged`; idempotent).
 * - The commitlint config file.
 *
 * Users may add custom commands above, below, or between the managed sections.
 */
/* v8 ignore next 3 -- CLI registration; handler tested via runCommitInit */
export const initCommand = Command.make("init", { force: forceOption, config: configOption }, (opts) =>
	runCommitInit(opts),
).pipe(Command.withDescription("Initialize commitlint configuration and husky hooks"));
