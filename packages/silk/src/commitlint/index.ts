/**
 * Commitlint root shim for \@savvy-web/silk.
 *
 * Drop-in replacement for the root \@savvy-web/commitlint export.
 * Re-exports CommitlintConfig and associated constants/types so a consumer
 * commitlint.config.ts that referenced \@savvy-web/commitlint works unchanged
 * against \@savvy-web/silk/commitlint.
 *
 * @packageDocumentation
 */

import { Commitlint } from "@savvy-web/silk-effects";

export type CommitType = Commitlint.CommitType;
export type ReleaseFormat = Commitlint.ReleaseFormat;
export type CommitTypeDefinition = Commitlint.CommitTypeDefinition;
export type CommitlintPlugin = Commitlint.CommitlintPlugin;
export type PromptConfig = Commitlint.PromptConfig;
export type PromptSettings = Commitlint.PromptSettings;
export type RuleApplicability = Commitlint.RuleApplicability;
export type RuleConfigTuple = Commitlint.RuleConfigTuple;
export type RuleSeverity = Commitlint.RuleSeverity;
export type RulesConfig = Commitlint.RulesConfig;
// silk-owned return type for the silk() factory. Empty-extends is structurally
// identical to the silk-effects interface and stays in sync automatically, while
// giving the type a canonical home in @savvy-web/silk so consumer config files
// can name CommitlintConfig.silk()'s inferred return type portably (no TS2883).
export interface CommitlintUserConfig extends Commitlint.CommitlintUserConfig {}
export type ConfigOptions = Commitlint.ConfigOptions;

// Facade whose silk() signature is declared HERE (in @savvy-web/silk) and
// annotated with silk's own CommitlintUserConfig, delegating to the silk-effects
// implementation. Declaring the signature in silk is what makes the inferred
// return type portable for consumers that depend on silk but not silk-effects.
export const CommitlintConfig = {
	silk(options?: Commitlint.ConfigOptions): CommitlintUserConfig {
		return Commitlint.CommitlintConfig.silk(options);
	},
};
export const COMMIT_TYPES = Commitlint.COMMIT_TYPES;
export const COMMIT_TYPE_DEFINITIONS = Commitlint.COMMIT_TYPE_DEFINITIONS;
export const TDD_SCOPE_PATTERN = Commitlint.TDD_SCOPE_PATTERN;
export const TDD_STATES = Commitlint.TDD_STATES;

export default CommitlintConfig;
