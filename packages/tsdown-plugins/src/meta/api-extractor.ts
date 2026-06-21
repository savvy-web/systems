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
}

/** Map an API Extractor message to a collector DiagnosticInput, or undefined if not warn/error. */
export function mapExtractorMessage(message: ExtractorMessage): DiagnosticInput | undefined {
	const isError = message.logLevel === ExtractorLogLevel.Error;
	const isWarning = message.logLevel === ExtractorLogLevel.Warning;
	if (!isError && !isWarning) return undefined;
	return {
		source: "api-extractor",
		level: isError ? "error" : "warn",
		text: message.text,
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
			docModel: { enabled: true, apiJsonFilePath: options.apiJsonPath },
			...(options.tsdocMetadataPath !== undefined
				? { tsdocMetadata: { enabled: true, tsdocMetadataFilePath: options.tsdocMetadataPath } }
				: {}),
			// We do not want api-extractor to write a rollup .d.ts (tsdown already emitted the dts).
			dtsRollup: { enabled: false },
			apiReport: { enabled: false },
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
			// Apply user suppressions first.
			if (suppressor.matches(message.messageId, message.text)) {
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
					options.onMessage(entry);
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
