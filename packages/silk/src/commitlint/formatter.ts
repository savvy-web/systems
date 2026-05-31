/**
 * Commitlint formatter shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/commitlint/formatter.
 * The default export is the format function, matching the original formatter/index.ts
 * which aliased format as default. Named exports mirror the original surface.
 *
 * @packageDocumentation
 */

import { Commitlint } from "@savvy-web/silk-effects";

export type FormatterResult = Commitlint.FormatterResult;
export type LintOutcome = Commitlint.LintOutcome;
export type RuleResult = Commitlint.RuleResult;

export const format = Commitlint.format;
export const ERROR_EXPLANATIONS = Commitlint.ERROR_EXPLANATIONS;
export const ERROR_SUGGESTIONS = Commitlint.ERROR_SUGGESTIONS;
export const getExplanation = Commitlint.getExplanation;
export const getSuggestion = Commitlint.getSuggestion;

export default Commitlint.format;
