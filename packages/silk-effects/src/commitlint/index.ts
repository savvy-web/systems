/**
 * Commitlint namespace — commitlint business logic extracted from \@savvy-web/commitlint.
 *
 * @remarks
 * This barrel re-exports the complete commitlint public surface (minus CLI/bin) from
 * the silk-effects package. Downstream consumers import via the Commitlint namespace:
 *
 * ```typescript
 * import { Commitlint } from "@savvy-web/silk-effects";
 * const config = Commitlint.CommitlintConfig.silk();
 * ```
 *
 */

// =============================================================================
// STEP 1 — SERVICE RECONCILIATION DECISIONS
// =============================================================================
//
// Modules examined from ../commitlint/package/src/ vs existing silk-effects:
//
//   detection/scopes.ts — COPIED
//     Uses workspaces-effect (WorkspaceDiscovery) directly. This is distinct from
//     silk-effects' ConfigDiscovery which focuses on config file paths. The scope
//     detection logic reads workspace package names for commitlint's scope-enum
//     rule — specific to commitlint, no equivalent in silk-effects. Kept as-is;
//     imports workspaces-effect which silk-effects already depends on.
//
//   detection/dco.ts — COPIED
//     Pure filesystem walk using node:fs sync APIs. Detects DCO file at repo root.
//     No equivalent in silk-effects. Platform-adjacent (node:fs) but does not use
//     @effect/platform-node — uses synchronous node:fs builtins that are available
//     in any Node.js-capable runtime. Kept as-is.
//
//   config/factory.ts — COPIED
//     Uses detection/dco.ts and prompt/config.ts. No equivalent in silk-effects.
//
//   config/plugins.ts — COPIED
//     Custom commitlint plugin rules (silk/body-no-markdown, silk/signed-off-by,
//     silk/tdd-scope, silk/scope-enum). No equivalent in silk-effects.
//
//   config/rules.ts — COPIED
//     COMMIT_TYPES, TDD_SCOPE_PATTERN, TDD_STATES, COMMIT_TYPE_DEFINITIONS,
//     DEFAULT_BODY_MAX_LINE_LENGTH, DCO_SIGNOFF_TEXT. No equivalent in silk-effects.
//
//   config/schema.ts — COPIED
//     Effect Schema for ConfigOptions. No equivalent in silk-effects.
//
//   config/types.ts — COPIED
//     TypeScript interfaces: RulesConfig, CommitlintUserConfig, CommitlintPlugin, etc.
//     No equivalent in silk-effects.
//
//   formatter/* — COPIED
//     Custom commitlint formatter with explanations and suggestions.
//     No equivalent in silk-effects.
//
//   prompt/* — COPIED
//     Commitizen adapter + prompt config + emoji mappings.
//     No equivalent in silk-effects.
//
//   static.ts — COPIED
//     Static (non-auto-detecting) commitlint configuration object.
//     No equivalent in silk-effects.
//
//   hook/envelope.ts — COPIED
//     Effect Schema for the Claude Code hook event envelopes
//     (PreToolUse, PostToolUse, SessionStart).
//     No equivalent in silk-effects.
//
//   hook/output.ts — COPIED
//     Builder functions for the JSON hook output objects that Claude reads.
//     No equivalent in silk-effects.
//
//   hook/parse-bash-command.ts — COPIED
//     Parses git commit / gh pr create / gh pr edit CLI commands from hook
//     envelopes. Uses shell-quote (already a silk-effects dep). No equivalent.
//
//   hook/silence-logger.ts — COPIED
//     Logger.minimumLogLevel(LogLevel.Warning) Layer for hook subcommands.
//     No equivalent in silk-effects.
//
//   hook/diagnostics/* — COPIED
//     All six diagnostic modules (branch, cache, commitlint-config, open-issues,
//     package-manager, signing). None use @effect/platform-node; they use node:fs,
//     node:child_process, and node:util builtins directly. No equivalent in
//     silk-effects.
//
//   hook/rules/* — COPIED
//     All seven rule modules (closes-trailer, forbidden-content, plan-leakage,
//     signing-flag-conflict, soft-wrap, types, verbosity). Pure Effect-based rules.
//     No equivalent in silk-effects.
//
//   src/index.ts CommitlintConfig class — REPRODUCED HERE
//     The original index.ts is the public entry point that exports CommitlintConfig.
//     We reproduce the class inline in this barrel so the namespace shape matches.
//
// @effect/cluster, @effect/rpc, @effect/sql — NOT IMPORTED
//     None of the moved non-CLI source files import these packages.
//     They have been removed from silk-effects package.json (see Step 7 notes).
//
// @effect/printer, @effect/printer-ansi — NOT IMPORTED
//     The original commitlint package declared these as dependencies, but neither
//     is imported in any non-CLI source file. The CLI command output used them;
//     since CLI is excluded from this extraction, both have been removed from
//     silk-effects package.json.
//
// @effect/platform-node — NOT USED in any moved module
//     Present only in commitlint's cli/index.ts and cli test files (excluded).
//     The non-CLI source files use node:fs/node:child_process builtins directly,
//     which are platform-agnostic at the Node.js runtime level. silk-effects src
//     remains @effect/platform-node free.
//
// =============================================================================

import { createConfig } from "./config/factory.js";
import type { ConfigOptions } from "./config/schema.js";
import { decodeConfigOptions } from "./config/schema.js";
import type { CommitlintUserConfig } from "./config/types.js";

// === CommitlintConfig class (mirrors @savvy-web/commitlint index.ts) ===

/**
 * Dynamic commitlint configuration factory.
 *
 * @remarks
 * Provides static methods for creating commitlint configurations with automatic
 * detection of repository characteristics. The class co-locates configuration
 * creation with schema validation.
 *
 * @public
 *
 * @example
 * ```typescript
 * import { Commitlint } from "@savvy-web/silk-effects";
 *
 * // Auto-detect everything
 * export default Commitlint.CommitlintConfig.silk();
 *
 * // With explicit overrides
 * export default Commitlint.CommitlintConfig.silk({
 *   dco: true,
 *   scopes: ["api", "cli"],
 *   emojis: true,
 * });
 * ```
 */
export class CommitlintConfig {
	static silk(options: ConfigOptions = {}): CommitlintUserConfig {
		const validated = decodeConfigOptions(options);
		return createConfig(validated);
	}

	/* v8 ignore next 3 -- private constructor prevents direct instantiation */
	private constructor() {
		// Prevent instantiation — use static methods only
	}
}

export default CommitlintConfig;

// === Config ===

export type { CommitType } from "./config/rules.js";
export {
	COMMIT_TYPES,
	COMMIT_TYPE_DEFINITIONS,
	DCO_SIGNOFF_TEXT,
	DEFAULT_BODY_MAX_LINE_LENGTH,
	TDD_SCOPE_PATTERN,
	TDD_STATES,
} from "./config/rules.js";
export type { ReleaseFormat } from "./config/schema.js";
export type {
	CommitTypeDefinition,
	CommitlintPlugin,
	PromptConfig,
	PromptSettings,
	RuleApplicability,
	RuleConfigTuple,
	RuleSeverity,
	RulesConfig,
} from "./config/types.js";
export type { CommitlintUserConfig, ConfigOptions };

// === Static config ===

export { default as staticConfig } from "./static.js";

// === Formatter ===

export type { FormatterResult, LintOutcome, RuleResult } from "./formatter/format.js";
export { format } from "./formatter/format.js";
export { ERROR_EXPLANATIONS, ERROR_SUGGESTIONS, getExplanation, getSuggestion } from "./formatter/messages.js";

// === Prompt ===

export type { PromptConfigOptions, PromptQuestion, ResolvedPromptConfig, TypeEnumEntry } from "./prompt/config.js";
export { createPromptConfig, createTypeEnum, defaultPromptConfig, emojiPromptConfig } from "./prompt/config.js";
export { TYPE_EMOJIS, TYPE_EMOJIS_UNICODE, getTypeEmoji } from "./prompt/emojis.js";
export type { Inquirer, PrompterOptions, Question } from "./prompt/prompter.js";
export { prompter } from "./prompt/prompter.js";

// === Detection ===

export { detectDCO } from "./detection/dco.js";
export { detectScopes } from "./detection/scopes.js";

// === Hook — Envelope schemas ===

export type {
	PostToolUseEnvelope as PostToolUseEnvelopeType,
	PreToolUseEnvelope as PreToolUseEnvelopeType,
	SessionStartEnvelope as SessionStartEnvelopeType,
} from "./hook/envelope.js";
export { PostToolUseEnvelope, PreToolUseEnvelope, SessionStartEnvelope } from "./hook/envelope.js";

// === Hook — Output builders ===

export type { HookOutput } from "./hook/output.js";
export {
	postToolUseAdvise,
	preToolUseAdvise,
	preToolUseAllow,
	preToolUseDeny,
	preToolUseSilent,
	sessionStartContext,
} from "./hook/output.js";

// === Hook — Bash command parser ===

export type { ParsedCommit, ParsedKind } from "./hook/parse-bash-command.js";
export { parseBashCommand } from "./hook/parse-bash-command.js";

// === Hook — Logger silencer ===

export { HookSilencer } from "./hook/silence-logger.js";

// === Hook — Diagnostics ===

export type { BranchInfo } from "./hook/diagnostics/branch.js";
export { inferTicketId, readBranchInfo } from "./hook/diagnostics/branch.js";
export { readCache, writeCache } from "./hook/diagnostics/cache.js";
export { parseHuskyConfigPath, readCommitlintConfigPath } from "./hook/diagnostics/commitlint-config.js";
export type { OpenIssue } from "./hook/diagnostics/open-issues.js";
export {
	ISSUES_CACHE_RELATIVE_PATH,
	ISSUES_CACHE_TTL_SECONDS,
	fetchAndCacheOpenIssues,
	readOpenIssuesFromCache,
	readOrFetchOpenIssues,
} from "./hook/diagnostics/open-issues.js";
export type { LockfilePresence, PackageManager } from "./hook/diagnostics/package-manager.js";
export {
	detectFromLockfiles,
	detectPackageManager,
	parsePackageManagerField,
} from "./hook/diagnostics/package-manager.js";
export type { RawSigningInputs, SigningDiagnostic } from "./hook/diagnostics/signing.js";
export { buildSigningDiagnostic, parseGpgKeyExpiry, readSigningDiagnostic } from "./hook/diagnostics/signing.js";

// === Hook — Rules ===

export type { ClosesTrailerCtx, ClosesTrailerInput } from "./hook/rules/closes-trailer.js";
export { closesTrailerRule, hasClosingTrailer } from "./hook/rules/closes-trailer.js";
export type { ForbiddenContentInput } from "./hook/rules/forbidden-content.js";
export { forbiddenContentRule } from "./hook/rules/forbidden-content.js";
export type { PlanLeakageInput } from "./hook/rules/plan-leakage.js";
export { planLeakageRule } from "./hook/rules/plan-leakage.js";
export type { SigningFlagCtx, SigningFlagInput } from "./hook/rules/signing-flag-conflict.js";
export { signingFlagConflictRule } from "./hook/rules/signing-flag-conflict.js";
export type { SoftWrapInput } from "./hook/rules/soft-wrap.js";
export { softWrapRule } from "./hook/rules/soft-wrap.js";
export type { Rule, RuleHit, RuleSeverity as HookRuleSeverity } from "./hook/rules/types.js";
export { partitionHits } from "./hook/rules/types.js";
export type { VerbosityInput } from "./hook/rules/verbosity.js";
export { VERBOSITY_LINE_THRESHOLD, VERBOSITY_WORD_THRESHOLD, verbosityRule } from "./hook/rules/verbosity.js";
