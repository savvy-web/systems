/**
 * Configuration factory implementation.
 *
 * @internal
 */
import { detectDCO } from "../detection/dco.js";
import { createPromptConfig } from "../prompt/config.js";
import { createScopeEnumRule, silkPlugin } from "./plugins.js";
import { COMMIT_TYPES } from "./rules.js";
import type { ResolvedConfigOptions } from "./schema.js";
import type { CommitlintPlugin, CommitlintUserConfig, RulesConfig } from "./types.js";

/**
 * Create a commitlint configuration with auto-detection.
 *
 * @remarks
 * This function is the internal implementation for {@link CommitlintConfig.silk}.
 * It receives already-validated options and performs the actual configuration
 * assembly with auto-detection of repository settings.
 *
 * @param options - Resolved configuration options (after Zod parsing)
 * @returns Commitlint UserConfig object
 *
 * @internal
 */
export function createConfig(options: ResolvedConfigOptions): CommitlintUserConfig {
	const cwd = options.cwd ?? process.cwd();

	// COMMITLINT_SKIP_DCO=1 disables DCO check (useful for PR title validation)
	const skipDco = process.env.COMMITLINT_SKIP_DCO === "1" || process.env.COMMITLINT_SKIP_DCO === "true";
	const dco = skipDco ? false : (options.dco ?? detectDCO(cwd));
	const scopes = options.scopes ?? [];
	const allScopes = [...new Set([...scopes, ...(options.additionalScopes ?? [])])].sort();

	const rules: RulesConfig = {
		"body-max-line-length": [2, "always", options.bodyMaxLineLength],
		"type-enum": [2, "always", [...COMMIT_TYPES]],
		// Allow any case in subject (AI tools often capitalize, which is acceptable)
		"subject-case": [0],
	};

	if (allScopes.length > 0) {
		// Disable built-in scope-enum and silk/tdd-scope; silk/scope-enum subsumes both
		// to avoid duplicate error messages when tdd scope is invalid.
		rules["scope-enum"] = [0];
		rules["silk/tdd-scope"] = [0];
		rules["silk/scope-enum"] = [2, "always"];
	} else {
		rules["silk/tdd-scope"] = [2, "always"];
	}

	// commitlint assigns inline (object) plugins via `plugins.local = plugin`, so only
	// the last object in the array survives. Always use exactly one plugin object.
	// When scopes are configured, merge silkPlugin.rules and the scope rule together.
	const plugins: CommitlintPlugin[] = [
		allScopes.length > 0
			? { rules: { ...silkPlugin.rules, "silk/scope-enum": createScopeEnumRule(allScopes) } }
			: silkPlugin,
	];

	if (dco) {
		// Use custom case-insensitive rule instead of built-in signed-off-by
		rules["silk/signed-off-by"] = [2, "always"];
	}

	if (options.noMarkdown) {
		rules["silk/body-no-markdown"] = [2, "always"];
		rules["silk/subject-no-markdown"] = [2, "always"];
	}

	return {
		extends: ["@commitlint/config-conventional"],
		plugins,
		rules,
		prompt: createPromptConfig({
			emojis: options.emojis,
			...(allScopes.length > 0 && { scopes: allScopes }),
		}),
	};
}
