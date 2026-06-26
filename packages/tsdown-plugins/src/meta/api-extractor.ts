import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { ExtractorMessage } from "@microsoft/api-extractor";
import { Extractor, ExtractorConfig, ExtractorLogLevel } from "@microsoft/api-extractor";
import { TSDocConfigFile } from "@microsoft/tsdoc-config";
import { MetaGenerationError } from "../errors.js";
import type { DiagnosticInput } from "../report/collector.js";
import type { WarningSuppressionRule } from "./config.js";
import { createMessageSuppressor } from "./message-suppressor.js";

const require_ = createRequire(import.meta.url);

export interface RunApiExtractorOptions {
	readonly cwd: string;
	readonly packageJsonPath: string;
	/** The entry's .d.ts (api-extractor follows imports from here). */
	readonly entryDtsPath: string;
	/** Resolved tsconfig (absolute paths) for the api-extractor compiler. */
	readonly tsconfigPath: string;
	/** The tsdoc.json the extractor should load (from writeTsdocConfig). */
	readonly tsdocConfigPath: string;
	/** Where to write the per-entry .api.json. */
	readonly apiJsonPath: string;
	/** Where to write tsdoc-metadata.json (only the main entry needs it). */
	readonly tsdocMetadataPath?: string | undefined;
	readonly suppressWarnings: ReadonlyArray<WarningSuppressionRule>;
	/** When set, non-suppressed warnings/errors are routed here and marked handled (no console output). */
	readonly onMessage?: ((entry: DiagnosticInput) => void) | undefined;
	/** When true (CI), ae-forgotten-export is escalated to a hard error that fails the build. */
	readonly ci?: boolean | undefined;
	/** Receives messages matched by `suppressWarnings` (for accounting / --verbose). */
	readonly onSuppressed?: ((entry: DiagnosticInput) => void) | undefined;
	/** When false, the run analyzes + reports diagnostics but writes no api-model (the diagnostics run). Default true. */
	readonly emitDocModel?: boolean | undefined;
}

/** messageIds that become a hard build error in CI (they corrupt the .api.json). */
const CI_FATAL_MESSAGE_IDS = new Set<string>(["ae-forgotten-export"]);

/**
 * Map an API Extractor message to a collector DiagnosticInput, or undefined if not warn/error.
 *
 * Location (`file`/`line`/`column`) is preserved: diagnostics now come from a per-module declaration
 * run (see generateMeta's two-input split), where each `.d.ts.map` references only its own source, so
 * positions resolve to the true source declaration. Reverts the systems#154 mitigation. See systems#162.
 */
export function mapExtractorMessage(message: ExtractorMessage): DiagnosticInput | undefined {
	const isError = message.logLevel === ExtractorLogLevel.Error;
	const isWarning = message.logLevel === ExtractorLogLevel.Warning;
	if (!isError && !isWarning) return undefined;
	return {
		source: "api-extractor",
		level: isError ? "error" : "warn",
		text: message.text,
		...(message.messageId !== undefined ? { code: message.messageId } : {}),
		...(message.sourceFilePath !== undefined ? { file: message.sourceFilePath } : {}),
		...(message.sourceFileLine !== undefined ? { line: message.sourceFileLine } : {}),
		...(message.sourceFileColumn !== undefined ? { column: message.sourceFileColumn } : {}),
	};
}

/** Run API Extractor over a single entry's .d.ts, writing the .api.json (and optionally tsdoc-metadata.json). Throws on failure. */
export function runApiExtractor(options: RunApiExtractorOptions): void {
	const suppressor = createMessageSuppressor(options.suppressWarnings);
	// api-extractor needs the folder of the typescript it should compile with.
	const typescriptCompilerFolder = dirname(require_.resolve("typescript/package.json"));
	const tsdocConfigFile = TSDocConfigFile.loadForFolder(dirname(options.tsdocConfigPath));

	const extractorConfig = ExtractorConfig.prepare({
		configObject: {
			projectFolder: options.cwd,
			mainEntryPointFilePath: options.entryDtsPath,
			enumMemberOrder: "preserve",
			compiler: { tsconfigFilePath: options.tsconfigPath },
			// includeForgottenExports keeps "forgotten" declarations (referenced but not exported) IN the
			// doc model instead of dropping them (api-extractor's default). Without it the synthetic base
			// class TypeScript hoists for Effect class mixins (Schema.Class/Data.TaggedError/Context.Tag/
			// Effect.Service emit `declare const X_base = ...; class X extends X_base {}`) is dropped — its
			// name is not exportable from source, so it is always a forgotten export — leaving the model with
			// a dangling `extends X_base` and an empty class body. Downstream .d.ts reconstruction then loses
			// every field. Inclusion is always on so the model stays complete and reconstructable; the
			// diagnostic severity below is what stays configurable. See rspress-plugin-api-extractor#56.
			docModel:
				options.emitDocModel === false
					? { enabled: false }
					: { enabled: true, apiJsonFilePath: options.apiJsonPath, includeForgottenExports: true },
			...(options.tsdocMetadataPath !== undefined
				? { tsdocMetadata: { enabled: true, tsdocMetadataFilePath: options.tsdocMetadataPath } }
				: {}),
			// We do not want api-extractor to write a rollup .d.ts (tsdown already emitted the dts).
			dtsRollup: { enabled: false },
			apiReport: { enabled: false },
			// Without an api-extractor.json, the MessageRouter's compiler/extractor/tsdoc default rules
			// are all `logLevel: "none"`, so analyzer messages (ae-forgotten-export, ae-missing-release-tag,
			// tsdoc-*) reach messageCallback already silenced and mapExtractorMessage drops them. Route the
			// two actionable categories to "warning" so the diagnostics flow to the collector. Per-package
			// noise is filtered ahead of this via `suppressWarnings`.
			//
			// `compilerMessageReporting` is deliberately left at the "none" default: api-extractor analyzes
			// already-emitted, already-typechecked .d.ts with its own BUNDLED TypeScript, which lags the
			// project's compiler. That skew makes it emit spurious diagnostics against third-party lib types
			// (e.g. "Cannot find name 'Float16Array'" from @types/node) that are noise, not the user's code.
			messages: {
				extractorMessageReporting: {
					default: { logLevel: "warning" },
					// The underscore-prefix convention for `@internal` exports is not used in this
					// monorepo, so silence `ae-internal-missing-underscore` rather than nag on it.
					"ae-internal-missing-underscore": { logLevel: "none" },
					// In CI the CI-fatal messageIds are hard errors. With includeForgottenExports the symbol is
					// no longer dropped from the .api.json, so this escalation is no longer about model
					// corruption — it flags a developer who genuinely forgot to export one of their OWN public
					// symbols, a real API-surface mistake worth failing CI over. Derived from the same
					// CI_FATAL_MESSAGE_IDS set that drives the local `ciFatal` tag, so the nudge and the real
					// escalation cannot drift. Suppression still wins (per-package opt-out) — a suppressed
					// message is set to None in the callback before it can count toward errorCount.
					...(options.ci === true
						? Object.fromEntries([...CI_FATAL_MESSAGE_IDS].map((id) => [id, { logLevel: "error" }]))
						: {}),
				},
				tsdocMessageReporting: { default: { logLevel: "warning" } },
			},
		},
		packageJsonFullPath: options.packageJsonPath,
		configObjectFullPath: undefined,
		tsdocConfigFile,
	} as Parameters<typeof ExtractorConfig.prepare>[0]);

	const result = Extractor.invoke(extractorConfig, {
		typescriptCompilerFolder,
		localBuild: true,
		showVerboseMessages: false,
		messageCallback: (message: ExtractorMessage): void => {
			// Apply user suppressions first — a suppressed message must not fail CI or warn. Map it
			// BEFORE setting None so the pre-suppression level is captured for the accounting.
			if (suppressor.matches(message.messageId, message.text)) {
				if (options.onSuppressed !== undefined) {
					const entry = mapExtractorMessage(message);
					if (entry !== undefined) options.onSuppressed(entry);
				}
				message.logLevel = ExtractorLogLevel.None;
				message.handled = true;
				return;
			}
			// Silence noisy environment messages that are not actionable here.
			if (message.messageId === "console-compiler-version-notice" || message.messageId === "console-preamble") {
				message.logLevel = ExtractorLogLevel.None;
				message.handled = true;
			}
			// Route remaining warnings/errors to the collector and suppress API Extractor's own
			// console output for them, so they surface only in the unified build log.
			if (options.onMessage !== undefined) {
				const entry = mapExtractorMessage(message);
				if (entry !== undefined) {
					// Locally a CI-fatal message is shown as a warning; tag it so the formatter can nudge.
					const ciFatal =
						options.ci !== true &&
						entry.level === "warn" &&
						entry.code !== undefined &&
						CI_FATAL_MESSAGE_IDS.has(entry.code);
					options.onMessage(ciFatal ? { ...entry, ciFatal: true } : entry);
					message.handled = true;
				}
			}
		},
	});

	if (!result.succeeded) {
		throw new MetaGenerationError({
			entry: options.entryDtsPath,
			reason: `API Extractor reported ${result.errorCount} error(s) and ${result.warningCount} warning(s)`,
		});
	}
}
