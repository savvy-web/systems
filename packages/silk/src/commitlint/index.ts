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
// silk-owned canonical home so consumer configs name the silk() return type from a direct dep (avoids TS2883).
export interface CommitlintUserConfig extends Commitlint.CommitlintUserConfig {}
export type ConfigOptions = Commitlint.ConfigOptions;

// Facade declared in silk so consumer configs infer the return type from a direct dep (avoids TS2883).
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
