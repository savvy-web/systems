/**
 * Commitizen prompt adapter shim for \@savvy-web/silk.
 *
 * Drop-in replacement for \@savvy-web/commitlint/prompt.
 * The default export is defaultPromptConfig, matching the original prompt/index.ts
 * which aliased defaultPromptConfig as default. Named exports mirror the original surface.
 *
 * @packageDocumentation
 */

import { Commitlint } from "@savvy-web/silk-effects";

export type CommitType = Commitlint.CommitType;
export type PromptConfigOptions = Commitlint.PromptConfigOptions;
export type PromptQuestion = Commitlint.PromptQuestion;
export type ResolvedPromptConfig = Commitlint.ResolvedPromptConfig;
export type TypeEnumEntry = Commitlint.TypeEnumEntry;
export type Inquirer = Commitlint.Inquirer;
export type PrompterOptions = Commitlint.PrompterOptions;
export type Question = Commitlint.Question;

export const COMMIT_TYPES = Commitlint.COMMIT_TYPES;
export const TYPE_EMOJIS = Commitlint.TYPE_EMOJIS;
export const TYPE_EMOJIS_UNICODE = Commitlint.TYPE_EMOJIS_UNICODE;
export const getTypeEmoji = Commitlint.getTypeEmoji;
export const createPromptConfig = Commitlint.createPromptConfig;
export const createTypeEnum = Commitlint.createTypeEnum;
export const defaultPromptConfig = Commitlint.defaultPromptConfig;
export const emojiPromptConfig = Commitlint.emojiPromptConfig;
export const prompter = Commitlint.prompter;

export default Commitlint.defaultPromptConfig;
