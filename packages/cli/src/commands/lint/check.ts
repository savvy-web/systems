/**
 * Check command - validate current lint-staged setup.
 *
 * @internal
 */
import { isDeepStrictEqual } from "node:util";
import type { Block } from "@effected/cli";
import { CliExit } from "@effected/cli";
import { Tool, ToolDiscovery } from "@effected/commands";
import type { JsoncParseError } from "@effected/jsonc";
import { Jsonc } from "@effected/jsonc";
import type { Section, SectionFileError, SectionParseError } from "@effected/templates";
import { CheckOutcome, ManagedSection } from "@effected/templates";
import type { ConfigDiscoveryShape } from "@savvy-web/silk-effects";
import {
	ConfigDiscovery,
	Lint,
	SavvyBaseSection,
	SavvyHooksSection,
	SavvyToolchainSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyInstallBlock,
	savvyOkfBlock,
	savvyToolchainCheck,
} from "@savvy-web/silk-effects";
import { Effect, FileSystem, Option } from "effect";
import type { PlatformError } from "effect/PlatformError";
import type { ReportEnv } from "../../internal/report.js";
import { Report } from "../../internal/report.js";
import type { CheckSection, SectionState } from "../check-section.js";
import { hookTable } from "../check-section.js";
import { BIOME_VERSION } from "./biome-version.js";

/** Unicode warning symbol, for the quiet-mode warning lines. */
const WARNING = "⚠";

/** Possible lint-staged configuration file names, in priority order. */
const CONFIG_FILES = [
	"lint-staged.config.ts",
	"lint-staged.config.js",
	"lint-staged.config.mjs",
	"lint-staged.config.cjs",
	".lintstagedrc",
	".lintstagedrc.json",
	".lintstagedrc.yaml",
	".lintstagedrc.yml",
	".lintstagedrc.js",
	".lintstagedrc.cjs",
	".lintstagedrc.mjs",
] as const;

/** Paths to search for config files. */
const CONFIG_SEARCH_PATHS = ["lib/configs/lint-staged.config.ts", "lib/configs/lint-staged.config.js", ...CONFIG_FILES];

/**
 * Find the first existing config file.
 *
 * @param fs - FileSystem service
 * @returns Effect yielding the config file name or null
 */
function findConfigFile(fs: FileSystem.FileSystem) {
	return Effect.gen(function* () {
		for (const file of CONFIG_SEARCH_PATHS) {
			if (yield* fs.exists(file)) {
				return file;
			}
		}
		return null;
	});
}

/**
 * Find the first existing config file from a list of candidates using ConfigDiscovery.
 *
 * The engine takes no ambient cwd; this CLI front end owns the process, so the
 * discovery root is the process cwd the rest of `lint check` already resolves
 * its relative paths against.
 *
 * @param discovery - ConfigDiscovery service
 * @param names - Config file names to search for (in priority order)
 * @returns The config file path or null
 */
function findConfig(discovery: ConfigDiscoveryShape, names: readonly string[]) {
	return Effect.gen(function* () {
		for (const name of names) {
			const result = yield* discovery.find(name, { cwd: process.cwd() });
			if (result) return result.path;
		}
		return null;
	});
}

/**
 * Extract the config path from the managed section.
 *
 * @param managedContent - The content between managed section markers
 * @returns The config path found, or null if not found
 */
function extractConfigPathFromManaged(managedContent: string): string | null {
	// Look for: lint-staged --config "$ROOT/{path}"
	const match = managedContent.match(/lint-staged --config "\$ROOT\/([^"]+)"/);
	return match ? match[1] : null;
}

/**
 * Check the markdownlint-cli2 config against the template.
 *
 * @param content - The existing file content
 * @returns Status object with match details
 */
function checkMarkdownlintConfig(content: string) {
	return Effect.gen(function* () {
		const parsed = (yield* Jsonc.parse(content)) as Record<string, unknown>;
		const schemaMatches = parsed.$schema === Lint.MARKDOWNLINT_SCHEMA;
		const existingConfig = parsed.config as Record<string, unknown> | undefined;
		const configMatches = existingConfig !== undefined && isDeepStrictEqual(existingConfig, Lint.MARKDOWNLINT_CONFIG);
		return { exists: true as const, schemaMatches, configMatches, isUpToDate: schemaMatches && configMatches };
	});
}

/**
 * Check biome config `$schema` URLs against the pinned {@link BIOME_VERSION}.
 *
 * @remarks
 * Uses `Lint.Biome.findAllConfigs()` for workspace-aware discovery, then validates
 * each config's `$schema` URL by reading and parsing the file directly with JSONC.
 *
 * @returns Object with warnings and per-config status
 */
function checkBiomeSchemas() {
	return Effect.gen(function* () {
		const statuses: { path: string; matches: boolean }[] = [];
		const fs = yield* FileSystem.FileSystem;
		const warnings: string[] = [];
		const expectedSchema = `https://biomejs.dev/schemas/${BIOME_VERSION}/schema.json`;

		// Use Lint.Biome.findAllConfigs() for workspace-aware discovery
		const configPaths = Lint.Biome.findAllConfigs();

		for (const configPath of configPaths) {
			const content = yield* fs.readFileString(configPath);
			const parsed = (yield* Jsonc.parse(content)) as Record<string, unknown>;
			const currentSchema = parsed.$schema as string | undefined;

			if (currentSchema === expectedSchema) {
				statuses.push({ path: configPath, matches: true });
			} else {
				statuses.push({ path: configPath, matches: false });
				warnings.push(`${WARNING}  ${configPath}: biome $schema is outdated.\n   Run 'savvy init' to update it.`);
			}
		}

		return { statuses, warnings };
	});
}

/** What {@link lintCheckSection} needs from the environment. */
type LintCheckRequirements = ManagedSection | FileSystem.FileSystem | ToolDiscovery | ConfigDiscovery;

/**
 * Check the lint-staged setup and return it as a {@link CheckSection}.
 *
 * @remarks
 * Severity rule: anything `savvy init` would write or rewrite is a finding
 * (`✗`, verdict `failure`) — a missing config file or `pre-commit` hook, a
 * managed section that is absent or drifted in a hook file that exists, a
 * biome `$schema` behind {@link BIOME_VERSION}, a markdownlint `$schema` that
 * differs from the template. Advice is `⚠` (verdict `warning`): markdownlint
 * rules that differ from the template (only `savvy init --force` overwrites
 * them, so they may be deliberate) and biome configs that could not be read.
 * Absent is not a finding where a preset may leave it out: a missing hygiene
 * hook FILE (the minimal preset writes none) or an uninstalled tool is `↷`.
 *
 * Under `quiet` the body is only the collected warning lines (none when
 * there are none); the verdict is the same.
 *
 * @internal
 */
export function lintCheckSection(opts: {
	readonly quiet: boolean;
}): Effect.Effect<
	CheckSection,
	JsoncParseError | SectionParseError | SectionFileError | PlatformError,
	LintCheckRequirements
> {
	const { quiet } = opts;
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const ms = yield* ManagedSection;
		const td = yield* ToolDiscovery;
		const discovery = yield* ConfigDiscovery;

		const warnings: string[] = [];
		const rows: Array<readonly [string, string, SectionState]> = [];
		const stateOf = (outcome: CheckOutcome): SectionState =>
			CheckOutcome.$is("UpToDate")(outcome)
				? "up-to-date"
				: CheckOutcome.$is("Drifted")(outcome)
					? "outdated"
					: "missing";

		const foundConfig = yield* findConfigFile(fs);
		const hasHuskyHook = yield* fs.exists(Lint.HUSKY_HOOK_PATH);
		let detectedConfigPath: string | null = null;

		if (hasHuskyHook) {
			rows.push([
				Lint.HUSKY_HOOK_PATH,
				"savvy-base",
				stateOf(yield* ms.check(Lint.HUSKY_HOOK_PATH, SavvyBaseSection.section(savvyBasePreamble()))),
			]);

			const existing = yield* ms.read(Lint.HUSKY_HOOK_PATH, Lint.SavvyLintSectionDef);
			if (Option.isSome(existing)) {
				detectedConfigPath = extractConfigPathFromManaged(existing.value.content);
				const state: SectionState = detectedConfigPath
					? CheckOutcome.$is("UpToDate")(yield* ms.check(Lint.HUSKY_HOOK_PATH, Lint.savvyLintBlock(detectedConfigPath)))
						? "up-to-date"
						: "outdated"
					: "outdated";
				rows.push([Lint.HUSKY_HOOK_PATH, "savvy-lint", state]);
			} else {
				rows.push([Lint.HUSKY_HOOK_PATH, "savvy-lint", "missing"]);
			}

			rows.push([Lint.HUSKY_HOOK_PATH, "savvy-okf", stateOf(yield* ms.check(Lint.HUSKY_HOOK_PATH, savvyOkfBlock()))]);

			if (rows.some(([, , state]) => state !== "up-to-date")) {
				warnings.push(
					`${WARNING}  Your ${Lint.HUSKY_HOOK_PATH} managed sections are out of date.\n   Run 'savvy init' to update (preserves your custom hooks).`,
				);
			}
		} else {
			warnings.push(`${WARNING}  No husky pre-commit hook found.\n   Run 'savvy init' to create it.`);
		}

		if (!foundConfig) {
			warnings.push(`${WARNING}  No lint-staged config file found.\n   Run 'savvy init' to create one.`);
		}

		// Hygiene hooks: the co-owned savvy-hooks section; post-checkout and
		// post-merge also carry savvy-install (which differs per hook — git hands
		// the two different arguments — so the variant checked follows the path)
		// and savvy-toolchain.
		for (const hookPath of [Lint.POST_CHECKOUT_HOOK_PATH, Lint.POST_MERGE_HOOK_PATH, Lint.POST_COMMIT_HOOK_PATH]) {
			if (!(yield* fs.exists(hookPath))) {
				rows.push([hookPath, "(hook file)", "not installed"]);
				continue;
			}
			const sections: Array<readonly [string, Section]> = [
				["savvy-hooks", SavvyHooksSection.section(savvyHooksHygiene())],
			];
			if (hookPath !== Lint.POST_COMMIT_HOOK_PATH) {
				const installHook = hookPath === Lint.POST_CHECKOUT_HOOK_PATH ? "post-checkout" : "post-merge";
				sections.push(
					["savvy-install", savvyInstallBlock(installHook)],
					["savvy-toolchain", SavvyToolchainSection.section(savvyToolchainCheck())],
				);
			}
			for (const [name, section] of sections) {
				const state = stateOf(yield* ms.check(hookPath, section));
				rows.push([hookPath, name, state]);
				if (state === "missing") {
					warnings.push(`${WARNING}  ${hookPath} has no ${name} section.\n   Run 'savvy init' to add it.`);
				} else if (state === "outdated") {
					warnings.push(`${WARNING}  ${hookPath} ${name} section is outdated.\n   Run 'savvy init' to update.`);
				}
			}
		}

		const biomeSchemaStatus = yield* checkBiomeSchemas().pipe(
			Effect.map((status) => ({ ...status, readable: true })),
			Effect.catch(() =>
				Effect.succeed({
					statuses: [] as { path: string; matches: boolean }[],
					warnings: [`${WARNING}  Could not check biome $schema URLs.`],
					readable: false,
				}),
			),
		);
		warnings.push(...biomeSchemaStatus.warnings);

		const hasMarkdownlintConfig = yield* fs.exists(Lint.MARKDOWNLINT_CONFIG_PATH);
		const markdownlintStatus = hasMarkdownlintConfig
			? yield* checkMarkdownlintConfig(yield* fs.readFileString(Lint.MARKDOWNLINT_CONFIG_PATH))
			: { exists: false, schemaMatches: false, configMatches: false, isUpToDate: false };
		if (hasMarkdownlintConfig && !markdownlintStatus.schemaMatches) {
			warnings.push(
				`${WARNING}  ${Lint.MARKDOWNLINT_CONFIG_PATH}: $schema differs from template.\n   Run 'savvy init' to update it.`,
			);
		}
		if (hasMarkdownlintConfig && !markdownlintStatus.configMatches) {
			warnings.push(
				`${WARNING}  ${Lint.MARKDOWNLINT_CONFIG_PATH}: config rules differ from template.\n   Run 'savvy init --force' to overwrite.`,
			);
		}

		// A hook FILE a preset left out is advisory; every other non-current row is a finding.
		const sectionsHealthy = rows.every(([, , state]) => state === "up-to-date" || state === "not installed");
		const findings =
			!foundConfig ||
			!hasHuskyHook ||
			!sectionsHealthy ||
			(hasMarkdownlintConfig && !markdownlintStatus.schemaMatches) ||
			biomeSchemaStatus.statuses.some((status) => !status.matches);
		const advice = (hasMarkdownlintConfig && !markdownlintStatus.configMatches) || !biomeSchemaStatus.readable;
		const verdict = findings ? "failure" : advice ? "warning" : "success";
		const title = "lint-staged";

		if (quiet) {
			return {
				title,
				blocks: warnings.map((warning) => Report.verbatim(warning)),
				verdict,
				fixedByInit: findings,
			};
		}

		const blocks: Array<Block> = [];
		blocks.push(
			foundConfig ? Report.ok(`Config file: ${foundConfig}`) : Report.fail("No lint-staged config file found"),
		);
		blocks.push(
			hasHuskyHook ? Report.ok(`Husky hook: ${Lint.HUSKY_HOOK_PATH}`) : Report.fail("No husky pre-commit hook found"),
		);
		if (detectedConfigPath) blocks.push(Report.detail(`savvy-lint runs: ${detectedConfigPath}`));
		if (rows.length > 0) blocks.push(hookTable(rows));

		if (hasMarkdownlintConfig) {
			if (markdownlintStatus.isUpToDate) {
				blocks.push(Report.ok(`${Lint.MARKDOWNLINT_CONFIG_PATH}: up-to-date`));
			} else {
				if (!markdownlintStatus.schemaMatches) {
					blocks.push(Report.fail(`${Lint.MARKDOWNLINT_CONFIG_PATH}: $schema differs from template`));
				}
				if (!markdownlintStatus.configMatches) {
					blocks.push(
						Report.warn(
							`${Lint.MARKDOWNLINT_CONFIG_PATH}: config rules differ from template (savvy init --force overwrites)`,
						),
					);
				}
			}
		} else {
			blocks.push(Report.skip(`${Lint.MARKDOWNLINT_CONFIG_PATH}: not found`));
		}

		if (!biomeSchemaStatus.readable) blocks.push(Report.warn("Could not check biome $schema URLs"));
		for (const status of biomeSchemaStatus.statuses) {
			blocks.push(
				status.matches
					? Report.ok(`${status.path}: biome $schema up-to-date`)
					: Report.fail(`${status.path}: biome $schema outdated`),
			);
		}

		blocks.push(Report.line("Tool availability"));
		const biomeAvailable = yield* td.isAvailable(Tool.named("biome"));
		const biomeConfig = yield* findConfig(discovery, ["biome.jsonc", "biome.json"]);
		blocks.push(
			biomeAvailable
				? Report.ok(`Biome${biomeConfig ? ` (config: ${biomeConfig})` : ""}`)
				: Report.skip("Biome: not installed"),
		);
		const markdownAvailable = yield* td.isAvailable(Tool.named("markdownlint-cli2"));
		const markdownConfig = yield* findConfig(discovery, [
			".markdownlint-cli2.jsonc",
			".markdownlint-cli2.json",
			".markdownlint-cli2.yaml",
			".markdownlint-cli2.cjs",
			".markdownlint.jsonc",
			".markdownlint.json",
			".markdownlint.yaml",
		]);
		blocks.push(
			markdownAvailable
				? Report.ok(`markdownlint-cli2${markdownConfig ? ` (config: ${markdownConfig})` : ""}`)
				: Report.skip("markdownlint-cli2: not installed"),
		);
		const tscAvailable = yield* td.isAvailable(Tool.named("tsc"));
		const tsgoAvailable = tscAvailable ? false : yield* td.isAvailable(Tool.named("tsgo"));
		blocks.push(
			tscAvailable
				? Report.ok("TypeScript (tsc)")
				: tsgoAvailable
					? Report.ok("TypeScript (tsgo)")
					: Report.skip("TypeScript: not installed"),
		);

		blocks.push(
			verdict === "failure"
				? Report.fail("lint-staged needs configuration")
				: verdict === "warning"
					? Report.warn("lint-staged is configured, with advisories")
					: Report.ok("lint-staged is configured correctly"),
		);
		return { title, blocks, verdict, fixedByInit: findings };
	});
}

/**
 * Check the lint-staged setup, print its report on stdout, and set exit code
 * 1 when it found a misconfiguration (see {@link lintCheckSection} for the
 * severity rule). Under `quiet` only the warnings are printed.
 *
 * @param opts - Options for the check command
 * @returns An Effect that performs validation and prints its report
 *
 * @internal
 */
export function runLintCheck(opts: {
	quiet: boolean;
}): Effect.Effect<
	void,
	JsoncParseError | SectionParseError | SectionFileError | PlatformError,
	LintCheckRequirements | ReportEnv | CliExit
> {
	return Effect.gen(function* () {
		const section = yield* lintCheckSection(opts);
		yield* Report.print(opts.quiet ? section.blocks : [Report.heading(section.title), ...section.blocks]);
		if (section.verdict === "failure") yield* CliExit.set(1);
	});
}
