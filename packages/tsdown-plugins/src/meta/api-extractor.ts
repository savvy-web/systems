import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { ExtractorMessage } from "@microsoft/api-extractor";
import { Extractor, ExtractorConfig, ExtractorLogLevel } from "@microsoft/api-extractor";
import { TSDocConfigFile } from "@microsoft/tsdoc-config";
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
		},
	});

	if (!result.succeeded) {
		throw new Error(
			`API Extractor reported ${result.errorCount} error(s) and ${result.warningCount} warning(s) for ${options.entryDtsPath}`,
		);
	}
}
