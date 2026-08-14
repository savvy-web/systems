/**
 * Init command -- bootstrap a repository for \@savvy-web/changesets.
 *
 * Creates the `.changeset/` directory, writes (or patches) `config.json`,
 * and configures markdownlint rules scoped to changeset files. Also provides
 * a `--check` mode for verifying existing configuration without writing.
 *
 * @remarks
 * The init command performs the following steps:
 * 1. Detect the GitHub `owner/repo` slug from the git remote origin URL via
 *    {@link detectGitHubRepo}.
 * 2. Ensure the `.changeset/` directory exists via {@link ensureChangesetDir}.
 * 3. Write or patch `.changeset/config.json` via {@link handleConfig}.
 * 4. Register custom rules in the base markdownlint config via
 *    {@link handleBaseMarkdownlint} (skipped with `--skip-markdownlint`).
 * 5. Write or patch `.changeset/.markdownlint.json` via
 *    {@link handleChangesetMarkdownlint}.
 *
 * In `--check` mode, no files are written. Instead the command inspects
 * existing configuration via {@link checkChangesetDir},
 * {@link checkConfig}, {@link checkBaseMarkdownlint}, and
 * {@link checkChangesetMarkdownlint}, reporting any issues as warnings.
 *
 * @remarks
 * `runChangesetInit` backs the changeset step of the unified `savvy init`
 * orchestrator; there is no standalone `savvy changeset init` subcommand.
 *
 * @example
 * ```bash
 * savvy init           # runs the changeset, commit, and lint init steps
 * savvy init --force    # overwrite existing config files and hooks
 * ```
 *
 * @internal
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Git } from "@effected/git";
import type { JsoncFormattingOptions } from "@effected/jsonc";
import { Jsonc, JsoncEdit, JsoncModifier } from "@effected/jsonc";
import { WorkspaceRoot } from "@effected/workspaces";
import { Changesets } from "@savvy-web/silk-effects";
import { Data, Effect, Option, Result, Schema } from "effect";

const { LegacyVersionFilesSchema } = Changesets;

/**
 * Canonical changelog formatter written by `init` — the standalone
 * `@savvy-web/changelog` package (hoisted by pnpm-plugin-silk as a silk
 * peer companion; also bundled by silk-release-action's native versioning).
 */
const CHANGELOG_ENTRY = "@savvy-web/changelog";
/** Prior canonical (silk shim subpath) and pre-merge standalone formatter; still accepted by `check`. */
const LEGACY_CHANGELOG_ENTRIES = ["@savvy-web/silk/changesets/changelog", "@savvy-web/changesets/changelog"] as const;
/** Changelog formatters `check` treats as valid (canonical + legacy). */
const ACCEPTED_CHANGELOG_ENTRIES: readonly string[] = [CHANGELOG_ENTRY, ...LEGACY_CHANGELOG_ENTRIES];

/** Canonical markdownlint custom-rule entry written by `init` — the silk shim. */
const CUSTOM_RULES_ENTRY = "@savvy-web/silk/changesets/markdownlint";
/** Pre-merge standalone custom-rule entry; still accepted by `check`. */
const LEGACY_CUSTOM_RULES_ENTRY = "@savvy-web/changesets/markdownlint";
/** Custom-rule entries `check` treats as valid (canonical silk shim + legacy). */
const ACCEPTED_CUSTOM_RULES_ENTRIES: readonly string[] = [CUSTOM_RULES_ENTRY, LEGACY_CUSTOM_RULES_ENTRY];

const MARKDOWNLINT_CONFIG_PATHS = [
	"lib/configs/.markdownlint-cli2.jsonc",
	"lib/configs/.markdownlint-cli2.json",
	".markdownlint-cli2.jsonc",
	".markdownlint-cli2.json",
] as const;

const RULE_NAMES = [
	"changeset-heading-hierarchy",
	"changeset-required-sections",
	"changeset-content-structure",
	"changeset-uncategorized-content",
	"changeset-dependency-table-format",
] as const;

const DEFAULT_CONFIG = {
	$schema: "https://unpkg.com/@changesets/config@4.0.0/schema.json",
	changelog: [CHANGELOG_ENTRY, { repo: "owner/repo" }],
	commit: false,
	access: "restricted",
	baseBranch: "main",
	updateInternalDependencies: "patch",
	ignore: [],
	privatePackages: { tag: true, version: true },
} as const;

/**
 * Base class for {@link InitError}, created via `Data.TaggedError`.
 *
 * @internal
 */
export const InitErrorBase = Data.TaggedError("InitError");

/**
 * Tagged error raised when an init step fails.
 *
 * @remarks
 * Carries the `step` name (e.g., `".changeset directory"`) and a human-readable
 * `reason` string. The `message` getter combines both for logging.
 *
 * @internal
 */
export class InitError extends InitErrorBase<{
	readonly step: string;
	readonly reason: string;
}> {
	get message() {
		return `Init failed at ${this.step}: ${this.reason}`;
	}
}

/**
 * Detect the `owner/repo` slug from the git remote origin URL.
 *
 * Attempts to parse both HTTPS (`github.com/owner/repo`) and SSH
 * (`github.com:owner/repo`) URL formats. Returns `null` when git is
 * unavailable, no remote is configured, or the URL does not match a
 * GitHub repository pattern.
 *
 * @param cwd - Working directory in which to run `git remote get-url origin`
 * @returns The `owner/repo` string, or `null` on failure
 *
 * @internal
 */
export function detectGitHubRepo(cwd: string): Effect.Effect<string | null, never, Git> {
	return Effect.gen(function* () {
		const git = yield* Git;
		// The kit degrades a missing remote to Option.none; any other failure
		// (not a git repo, git unavailable) degrades here — same null contract
		// as the previous execSync form.
		const url = yield* git.remoteUrl(cwd).pipe(Effect.catch(() => Effect.succeed(Option.none<string>())));
		if (Option.isNone(url)) return null;
		const https = url.value.match(/github\.com\/([^/]+)\/([^/.]+)/);
		if (https) return `${https[1]}/${https[2]}`;
		const ssh = url.value.match(/github\.com:([^/]+)\/([^/.]+)/);
		if (ssh) return `${ssh[1]}/${ssh[2]}`;
		return null;
	});
}

/**
 * Formatting options for `jsonc-effect` modify operations.
 *
 * Uses tabs (not spaces) per the Biome / Silk Suite convention.
 *
 * @internal
 */
const JSONC_FORMAT: Partial<JsoncFormattingOptions> = {
	tabSize: 1,
	insertSpaces: false,
};

/**
 * Resolve the monorepo workspace root from `cwd` using `WorkspaceRoot` service.
 *
 * Falls back to `cwd` itself when the service is unavailable or no workspace
 * root can be determined.
 *
 * @param cwd - The current working directory to search from
 * @returns An Effect yielding the resolved workspace root path
 *
 * @internal
 */
export function resolveWorkspaceRoot(cwd: string): Effect.Effect<string, never, WorkspaceRoot> {
	return WorkspaceRoot.pipe(
		Effect.flatMap((wr) => wr.find(cwd)),
		Effect.catch(() => Effect.succeed(cwd)),
	);
}

/**
 * Find the first existing markdownlint config file from candidate paths.
 *
 * Searches for `lib/configs/.markdownlint-cli2.jsonc`,
 * `lib/configs/.markdownlint-cli2.json`, `.markdownlint-cli2.jsonc`, and
 * `.markdownlint-cli2.json` (in that order) relative to `root`.
 *
 * @param root - The workspace root directory to search in
 * @returns The relative config path if found, or `null`
 *
 * @internal
 */
export function findMarkdownlintConfig(root: string): string | null {
	for (const configPath of MARKDOWNLINT_CONFIG_PATHS) {
		if (existsSync(join(root, configPath))) return configPath;
	}
	return null;
}

/**
 * Ensure the `.changeset/` directory exists under `root`.
 *
 * Creates the directory recursively if it does not already exist.
 *
 * @param root - The workspace root directory
 * @returns An Effect yielding the absolute path to `.changeset/`, or an
 *   {@link InitError} on failure
 *
 * @internal
 */
export function ensureChangesetDir(root: string): Effect.Effect<string, InitError> {
	return Effect.try({
		try: () => {
			const dir = join(root, ".changeset");
			mkdirSync(dir, { recursive: true });
			return dir;
		},
		catch: (error) =>
			new InitError({
				step: ".changeset directory",
				reason: error instanceof Error ? error.message : String(error),
			}),
	});
}

/**
 * Write or patch `.changeset/config.json`.
 *
 * When `force` is `true` or the file does not exist, writes a fresh config
 * with the default schema. Otherwise, patches only the `changelog` field to
 * point at `\@savvy-web/changelog` with the detected `repoSlug`.
 *
 * @param changesetDir - Absolute path to the `.changeset/` directory
 * @param repoSlug - The `owner/repo` GitHub slug to embed in the config
 * @param force - When `true`, overwrite existing config entirely
 * @returns An Effect yielding a human-readable status message, or an
 *   {@link InitError} on failure
 *
 * @internal
 */
export function handleConfig(changesetDir: string, repoSlug: string, force: boolean): Effect.Effect<string, InitError> {
	return Effect.try({
		try: () => {
			const configPath = join(changesetDir, "config.json");
			if (force || !existsSync(configPath)) {
				const config = {
					...DEFAULT_CONFIG,
					changelog: [CHANGELOG_ENTRY, { repo: repoSlug }],
				};
				writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
				return force ? "Overwrote .changeset/config.json" : "Created .changeset/config.json";
			}
			const existing = JSON.parse(readFileSync(configPath, "utf-8"));
			const currentOptions =
				Array.isArray(existing.changelog) && typeof existing.changelog[1] === "object" && existing.changelog[1] !== null
					? (existing.changelog[1] as Record<string, unknown>)
					: {};
			existing.changelog = [CHANGELOG_ENTRY, { ...currentOptions, repo: repoSlug }];
			writeFileSync(configPath, `${JSON.stringify(existing, null, "\t")}\n`);
			return "Patched changelog in .changeset/config.json";
		},
		catch: (error) =>
			new InitError({
				step: ".changeset/config.json",
				reason: error instanceof Error ? error.message : String(error),
			}),
	});
}

/**
 * Detect whether a config's changelog options carry the deprecated top-level
 * `versionFiles[]` array (the 0.8.x shape).
 *
 * @remarks
 * The new shape (introduced in 0.9.0) lives under
 * `changelog[1].packages[<name>].versionFiles`. The legacy shape has
 * `versionFiles` as a top-level key of the changelog options object with
 * each entry carrying its own `package` field. Returns `true` only when the
 * legacy shape is present and non-empty.
 *
 * Reads from a pre-parsed config object — `handleConfig` and `checkConfig`
 * already parse the file once; we don't re-parse here.
 *
 * @internal
 */
export function detectLegacyVersionFiles(config: unknown): boolean {
	if (typeof config !== "object" || config === null) return false;
	const cfg = config as { changelog?: unknown };
	const changelog = cfg.changelog;
	if (!Array.isArray(changelog) || changelog.length < 2) return false;
	const options = changelog[1] as { versionFiles?: unknown } | null;
	if (typeof options !== "object" || options === null) return false;
	return Array.isArray(options.versionFiles) && options.versionFiles.length > 0;
}

/**
 * Format the deprecation message emitted when an existing config still
 * uses the legacy top-level `versionFiles[]`.
 *
 * @internal
 */
export function legacyVersionFilesWarning(configPath: string): string {
	return [
		`DEPRECATION: ${configPath} uses the legacy top-level \`versionFiles[]\` array.`,
		"  Migrate each entry to `changelog[1].packages[<entry.package>].versionFiles`",
		"  and remove the top-level field. Run `savvy changeset config show --json`",
		"  to see the normalized form, or check the 0.9.0 release notes for examples.",
		"  Removed in @savvy-web/changesets 1.0.0.",
	].join("\n");
}

/**
 * Read the config at `configPath` and emit an `Effect.logWarning` if it
 * still uses the deprecated top-level `versionFiles[]` shape. Silent
 * when the file doesn't exist (e.g., the caller just created a fresh
 * default config) or when the file uses the new `packages` shape.
 *
 * @remarks
 * Never fails — config-parse errors are swallowed because deeper diagnosis
 * is the job of `config validate`. This helper exists only to surface the
 * migration hint at `init` time.
 *
 * @internal
 */
export function warnIfLegacyVersionFiles(changesetDir: string): Effect.Effect<void, never> {
	return Effect.gen(function* () {
		const configPath = join(changesetDir, "config.json");
		if (!existsSync(configPath)) return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(configPath, "utf-8"));
		} catch {
			return;
		}
		if (detectLegacyVersionFiles(parsed)) {
			yield* Effect.logWarning(legacyVersionFilesWarning(configPath));
		}
	});
}

/**
 * Register custom rules in the base markdownlint config.
 *
 * Locates the project's markdownlint-cli2 config file via
 * {@link findMarkdownlintConfig}, then uses `jsonc-effect` to:
 * 1. Register `\@savvy-web/silk/changesets/markdownlint` in the `customRules`
 *    array, migrating any pre-merge `\@savvy-web/changesets/markdownlint` entry.
 * 2. Add each CSH rule name to the `config` object (set to `false` so they
 *    are recognized but disabled at the project root -- they are enabled in
 *    `.changeset/.markdownlint.json`).
 *
 * @param root - The workspace root directory
 * @returns An Effect yielding a status message, or an {@link InitError}
 *
 * @internal
 */
export function handleBaseMarkdownlint(root: string): Effect.Effect<string, InitError> {
	const foundPath = findMarkdownlintConfig(root);
	if (!foundPath) {
		return Effect.succeed(`Warning: no markdownlint config found (checked ${MARKDOWNLINT_CONFIG_PATHS.join(", ")})`);
	}

	return Effect.gen(function* () {
		const fullPath = join(root, foundPath);
		let text: string;
		try {
			text = readFileSync(fullPath, "utf-8");
		} catch (error) {
			return yield* Effect.fail(
				new InitError({
					step: "markdownlint config",
					reason: error instanceof Error ? error.message : String(error),
				}),
			);
		}

		let parsed = (yield* Jsonc.parse(text)) as Record<string, unknown>;

		// Reconcile customRules: register the canonical silk shim, migrate any
		// pre-merge standalone entry to it, and dedupe. `init` always writes the
		// silk entry; `check` accepts either form.
		const currentRules = Array.isArray(parsed.customRules) ? (parsed.customRules as unknown[]) : null;
		if (currentRules === null) {
			// customRules key doesn't exist yet — set the whole array
			const edits = yield* JsoncModifier.modify(text, ["customRules"], [CUSTOM_RULES_ENTRY], {
				formattingOptions: JSONC_FORMAT,
			});
			text = JsoncEdit.applyAll(text, edits);
		} else {
			// Keep unrelated rules in order; drop any legacy or duplicate silk
			// entry, then append exactly one canonical silk entry.
			const desired = currentRules.filter((r) => r !== LEGACY_CUSTOM_RULES_ENTRY && r !== CUSTOM_RULES_ENTRY);
			desired.push(CUSTOM_RULES_ENTRY);
			const changed = desired.length !== currentRules.length || desired.some((r, i) => r !== currentRules[i]);
			if (changed) {
				const edits = yield* JsoncModifier.modify(text, ["customRules"], desired, {
					formattingOptions: JSONC_FORMAT,
				});
				text = JsoncEdit.applyAll(text, edits);
			}
		}

		// Ensure config is an object (replace null/missing with {})
		parsed = (yield* Jsonc.parse(text)) as Record<string, unknown>;
		const currentConfig = parsed.config;
		if (typeof currentConfig !== "object" || currentConfig === null) {
			const edits = yield* JsoncModifier.modify(text, ["config"], {}, { formattingOptions: JSONC_FORMAT });
			text = JsoncEdit.applyAll(text, edits);
		}

		// Add missing rule entries
		parsed = (yield* Jsonc.parse(text)) as Record<string, unknown>;
		const config = parsed.config as Record<string, unknown>;
		for (const rule of RULE_NAMES) {
			if (!(rule in config)) {
				const edits = yield* JsoncModifier.modify(text, ["config", rule], false, {
					formattingOptions: JSONC_FORMAT,
				});
				text = JsoncEdit.applyAll(text, edits);
			}
		}

		try {
			writeFileSync(fullPath, text);
		} catch (error) {
			return yield* Effect.fail(
				new InitError({
					step: "markdownlint config",
					reason: error instanceof Error ? error.message : String(error),
				}),
			);
		}
		return `Updated ${foundPath}`;
	}).pipe(
		Effect.catch((error) => {
			if (error instanceof InitError) return Effect.fail(error);
			return Effect.fail(
				new InitError({
					step: "markdownlint config",
					reason: error instanceof Error ? error.message : String(error),
				}),
			);
		}),
	);
}

/**
 * Write or patch `.changeset/.markdownlint.json`.
 *
 * Creates a scoped markdownlint config that extends the base config (if found),
 * disables all default rules (`"default": false`), disables MD041 (first-line
 * heading), and enables all five CSH rules. When the file already exists and
 * `force` is `false`, only the CSH rule entries are patched.
 *
 * @param changesetDir - Absolute path to the `.changeset/` directory
 * @param root - The workspace root directory (for resolving the base config)
 * @param force - When `true`, overwrite the existing config entirely
 * @returns An Effect yielding a status message, or an {@link InitError}
 *
 * @internal
 */
export function handleChangesetMarkdownlint(
	changesetDir: string,
	root: string,
	force: boolean,
): Effect.Effect<string, InitError> {
	return Effect.try({
		try: () => {
			const mdlintPath = join(changesetDir, ".markdownlint.json");
			const baseConfig = findMarkdownlintConfig(root);

			if (force || !existsSync(mdlintPath)) {
				const mdlintConfig: Record<string, unknown> = {};
				if (baseConfig) {
					mdlintConfig.extends = `../${baseConfig}`;
				}
				mdlintConfig.default = false;
				mdlintConfig.MD041 = false;
				for (const rule of RULE_NAMES) {
					mdlintConfig[rule] = true;
				}
				writeFileSync(mdlintPath, `${JSON.stringify(mdlintConfig, null, "\t")}\n`);
				return force ? "Overwrote .changeset/.markdownlint.json" : "Created .changeset/.markdownlint.json";
			}

			const existing = JSON.parse(readFileSync(mdlintPath, "utf-8"));
			for (const rule of RULE_NAMES) {
				existing[rule] = true;
			}
			writeFileSync(mdlintPath, `${JSON.stringify(existing, null, "\t")}\n`);
			return "Patched rules in .changeset/.markdownlint.json";
		},
		catch: (error) =>
			new InitError({
				step: ".changeset/.markdownlint.json",
				reason: error instanceof Error ? error.message : String(error),
			}),
	});
}

// ---------------------------------------------------------------------------
// Check functions (--check mode)
// ---------------------------------------------------------------------------

/**
 * Diagnostic from a `--check` run.
 *
 * Each issue identifies the `file` that has a problem and a human-readable
 * `message` describing what is wrong or missing.
 *
 * @internal
 */
export interface CheckIssue {
	readonly file: string;
	readonly message: string;
}

/**
 * Check that the `.changeset/` directory exists under `root`.
 *
 * @param root - The workspace root directory
 * @returns An array of {@link CheckIssue} items (empty when the directory exists)
 *
 * @internal
 */
export function checkChangesetDir(root: string): CheckIssue[] {
	const dir = join(root, ".changeset");
	if (!existsSync(dir)) {
		return [{ file: ".changeset/", message: "directory does not exist" }];
	}
	return [];
}

/**
 * Check that `.changeset/config.json` exists and has the correct changelog entry.
 *
 * Verifies that the `changelog` field points to the standalone
 * `\@savvy-web/changelog` package (the prior silk shim subpath
 * `\@savvy-web/silk/changesets/changelog` and the pre-merge
 * `\@savvy-web/changesets/changelog` are still accepted) and that the embedded
 * `repo` value matches `repoSlug`.
 *
 * @param changesetDir - Absolute path to the `.changeset/` directory
 * @param repoSlug - The expected `owner/repo` GitHub slug
 * @returns An array of {@link CheckIssue} items (empty when config is correct)
 *
 * @internal
 */
export function checkConfig(changesetDir: string, repoSlug: string): CheckIssue[] {
	const configPath = join(changesetDir, "config.json");
	if (!existsSync(configPath)) {
		return [{ file: ".changeset/config.json", message: "file does not exist" }];
	}
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const issues: CheckIssue[] = [];
		const changelog = config.changelog;
		const entry = Array.isArray(changelog) ? changelog[0] : changelog;
		const repo = Array.isArray(changelog) ? changelog[1]?.repo : undefined;

		if (!ACCEPTED_CHANGELOG_ENTRIES.includes(entry)) {
			issues.push({
				file: ".changeset/config.json",
				message: `changelog formatter is "${entry}", expected "${CHANGELOG_ENTRY}"`,
			});
		} else if (repo !== repoSlug) {
			issues.push({
				file: ".changeset/config.json",
				message: `changelog repo is "${repo ?? "(not set)"}", expected "${repoSlug}"`,
			});
		}

		// Validate versionFiles if present
		const options = Array.isArray(changelog) ? changelog[1] : undefined;
		if (options && typeof options === "object" && "versionFiles" in options) {
			const result = Schema.decodeUnknownResult(LegacyVersionFilesSchema)(options.versionFiles);
			if (Result.isFailure(result)) {
				issues.push({
					file: ".changeset/config.json",
					message: "versionFiles config is invalid",
				});
			}
		}

		// Surface deprecation when the config still uses the legacy shape.
		// Reported as a CheckIssue so `init --check` callers (CI gates,
		// postinstall scripts) see it the same way they see other drift.
		if (detectLegacyVersionFiles(config)) {
			issues.push({
				file: ".changeset/config.json",
				message:
					"uses the legacy top-level `versionFiles[]` array (deprecated; removed in 1.0.0). Migrate to `packages[<name>].versionFiles`.",
			});
		}

		return issues;
	} catch {
		return [{ file: ".changeset/config.json", message: "could not parse file" }];
	}
}

/**
 * Check that the base markdownlint config has the `customRules` entry and
 * all CSH rule names registered in its `config` section.
 *
 * @param root - The workspace root directory
 * @returns An array of {@link CheckIssue} items (empty when config is correct)
 *
 * @internal
 */
export function checkBaseMarkdownlint(root: string): CheckIssue[] {
	const foundPath = findMarkdownlintConfig(root);
	if (!foundPath) {
		return [{ file: "markdownlint config", message: `not found (checked ${MARKDOWNLINT_CONFIG_PATHS.join(", ")})` }];
	}

	try {
		const raw = readFileSync(join(root, foundPath), "utf-8");
		const parsed = Effect.runSync(Jsonc.parse(raw)) as Record<string, unknown>;
		const issues: CheckIssue[] = [];

		if (
			!Array.isArray(parsed.customRules) ||
			!(parsed.customRules as string[]).some((r) => ACCEPTED_CUSTOM_RULES_ENTRIES.includes(r))
		) {
			issues.push({
				file: foundPath,
				message: `customRules does not include ${CUSTOM_RULES_ENTRY}`,
			});
		}

		const config = parsed.config as Record<string, unknown> | null;
		if (typeof config !== "object" || config === null) {
			issues.push({
				file: foundPath,
				message: "config section is missing",
			});
		} else {
			for (const rule of RULE_NAMES) {
				if (!(rule in config)) {
					issues.push({
						file: foundPath,
						message: `rule "${rule}" is not configured`,
					});
				}
			}
		}

		return issues;
	} catch {
		return [{ file: foundPath, message: "could not parse file" }];
	}
}

/**
 * Check that `.changeset/.markdownlint.json` exists and has all five CSH
 * rules enabled (`true`).
 *
 * @param changesetDir - Absolute path to the `.changeset/` directory
 * @returns An array of {@link CheckIssue} items (empty when config is correct)
 *
 * @internal
 */
export function checkChangesetMarkdownlint(changesetDir: string): CheckIssue[] {
	const mdlintPath = join(changesetDir, ".markdownlint.json");
	if (!existsSync(mdlintPath)) {
		return [{ file: ".changeset/.markdownlint.json", message: "file does not exist" }];
	}
	try {
		const existing = JSON.parse(readFileSync(mdlintPath, "utf-8"));
		const issues: CheckIssue[] = [];
		for (const rule of RULE_NAMES) {
			if (existing[rule] !== true) {
				issues.push({
					file: ".changeset/.markdownlint.json",
					message: `rule "${rule}" is not enabled`,
				});
			}
		}
		return issues;
	} catch {
		return [{ file: ".changeset/.markdownlint.json", message: "could not parse file" }];
	}
}

/**
 * Run the full init pipeline.
 *
 * Exported so Task B5's unified `savvy init` orchestrator can invoke the
 * changeset init step directly without going through the CLI command layer.
 *
 * @param opts - The same options the CLI command receives
 * @returns An Effect that performs initialization
 *
 * @internal
 */
export function runChangesetInit(opts: {
	force: boolean;
	quiet: boolean;
	skipMarkdownlint: boolean;
	check: boolean;
}): Effect.Effect<void, never, WorkspaceRoot | Git> {
	const { force, quiet, skipMarkdownlint, check } = opts;
	return Effect.gen(function* () {
		const root = yield* resolveWorkspaceRoot(process.cwd());

		// 1. Detect GitHub repo
		const repo = yield* detectGitHubRepo(root);
		if (!repo && !quiet) {
			yield* Effect.log("Warning: could not detect GitHub repo from git remote, using placeholder");
		}
		const repoSlug = repo ?? "owner/repo";

		// --check mode: inspect current state without writing
		if (check) {
			const changesetDir = join(root, ".changeset");
			const issues: CheckIssue[] = [
				...checkChangesetDir(root),
				...checkConfig(changesetDir, repoSlug),
				...(!skipMarkdownlint ? checkBaseMarkdownlint(root) : []),
				...checkChangesetMarkdownlint(changesetDir),
			];

			if (issues.length === 0) {
				yield* Effect.log("All @savvy-web/changesets config files are up to date.");
				return;
			}

			for (const issue of issues) {
				yield* Effect.logWarning(`${issue.file}: ${issue.message}`);
			}
			yield* Effect.logWarning('Run "savvy init --force" to fix.');
			return;
		}

		// 2. Create .changeset/ directory
		const changesetDir = yield* ensureChangesetDir(root);
		yield* Effect.log("Ensured .changeset/ directory");

		// 3–5: Run each step, collecting errors
		const errors: InitError[] = [];

		// 3. Handle config.json
		const configResult = yield* handleConfig(changesetDir, repoSlug, force).pipe(Effect.result);
		if (Result.isSuccess(configResult)) {
			yield* Effect.log(configResult.success);
			// 3b. Surface deprecation when the (possibly newly patched) config
			//     still carries the legacy top-level `versionFiles[]`. This is
			//     never fatal — the warning text names the migration target.
			if (!quiet) {
				yield* warnIfLegacyVersionFiles(changesetDir);
			}
		} else {
			errors.push(configResult.failure);
		}

		// 4. Handle base markdownlint config
		if (!skipMarkdownlint) {
			const baseResult = yield* handleBaseMarkdownlint(root).pipe(Effect.result);
			if (Result.isSuccess(baseResult)) {
				yield* Effect.log(baseResult.success);
			} else {
				errors.push(baseResult.failure);
			}
		}

		// 5. Handle .changeset/.markdownlint.json
		const mdlintResult = yield* handleChangesetMarkdownlint(changesetDir, root, force).pipe(Effect.result);
		if (Result.isSuccess(mdlintResult)) {
			yield* Effect.log(mdlintResult.success);
		} else {
			errors.push(mdlintResult.failure);
		}

		// Report collected errors
		if (errors.length > 0) {
			for (const err of errors) {
				yield* Effect.logError(err.message);
			}
			if (!quiet) {
				process.exitCode = 1;
			}
			return;
		}

		yield* Effect.log("Init complete.");
	}).pipe(
		Effect.catch((error) =>
			Effect.gen(function* () {
				if (!quiet) {
					yield* Effect.logError(error instanceof InitError ? error.message : `Init failed: ${String(error)}`);
					process.exitCode = 1;
				}
			}),
		),
	);
}
