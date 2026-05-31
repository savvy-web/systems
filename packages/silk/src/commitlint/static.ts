/**
 * Static commitlint config shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/commitlint/static.
 * The default export is the static commitlint config object (no auto-detection).
 * Named constant and type re-exports mirror the original static.ts surface.
 *
 * @packageDocumentation
 */

import { Commitlint } from "@savvy-web/silk-effects";

export type CommitType = Commitlint.CommitType;
export type CommitTypeDefinition = Commitlint.CommitTypeDefinition;
export type CommitlintPlugin = Commitlint.CommitlintPlugin;
export type CommitlintUserConfig = Commitlint.CommitlintUserConfig;
export type PromptConfig = Commitlint.PromptConfig;
export type PromptSettings = Commitlint.PromptSettings;
export type RuleApplicability = Commitlint.RuleApplicability;
export type RuleConfigTuple = Commitlint.RuleConfigTuple;
export type RuleSeverity = Commitlint.RuleSeverity;
export type RulesConfig = Commitlint.RulesConfig;

export const COMMIT_TYPES = Commitlint.COMMIT_TYPES;
export const COMMIT_TYPE_DEFINITIONS = Commitlint.COMMIT_TYPE_DEFINITIONS;
export const DCO_SIGNOFF_TEXT = Commitlint.DCO_SIGNOFF_TEXT;
export const DEFAULT_BODY_MAX_LINE_LENGTH = Commitlint.DEFAULT_BODY_MAX_LINE_LENGTH;
export const TDD_SCOPE_PATTERN = Commitlint.TDD_SCOPE_PATTERN;
export const TDD_STATES = Commitlint.TDD_STATES;

export default Commitlint.staticConfig;
