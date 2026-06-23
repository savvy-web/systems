import { ExtractorLogLevel } from "@microsoft/api-extractor";
import { describe, expect, it } from "vitest";
import { mapExtractorMessage } from "../../src/meta/api-extractor.js";

describe("mapExtractorMessage", () => {
	it("maps a warning message to an api-extractor DiagnosticInput, omitting the unreliable location", () => {
		const entry = mapExtractorMessage({
			logLevel: ExtractorLogLevel.Warning,
			messageId: "ae-forgotten-export",
			text: "ae-forgotten-export",
			sourceFilePath: "src/index.ts",
			sourceFileLine: 12,
			sourceFileColumn: 3,
		} as never);
		// API Extractor analyzes the bundled .d.ts and maps positions back through the source map,
		// anchoring every message to an adjacent declaration rather than the symbol's true location.
		// We omit file/line/column rather than emit a misleading value (see systems#154).
		expect(entry).toEqual({
			source: "api-extractor",
			level: "warn",
			code: "ae-forgotten-export",
			text: "ae-forgotten-export",
		});
	});

	it("omits the location for release-tag and unresolved-link codes alike", () => {
		for (const messageId of ["ae-missing-release-tag", "ae-incompatible-release-tags", "ae-unresolved-link"]) {
			const entry = mapExtractorMessage({
				logLevel: ExtractorLogLevel.Warning,
				messageId,
				text: `${messageId}: "SomeSymbol" ...`,
				sourceFilePath: "src/Adjacent.ts",
				sourceFileLine: 11,
				sourceFileColumn: 46,
			} as never);
			expect(entry).toBeDefined();
			if (entry === undefined) throw new Error("expected a diagnostic entry");
			expect(entry.file).toBeUndefined();
			expect(entry.line).toBeUndefined();
			expect(entry.column).toBeUndefined();
		}
	});

	it("maps an error message to level error", () => {
		const entry = mapExtractorMessage({ logLevel: ExtractorLogLevel.Error, text: "boom" } as never);
		expect(entry).toBeDefined();
		if (entry === undefined) throw new Error("expected a diagnostic entry");
		expect(entry.level).toBe("error");
		expect(entry.file).toBeUndefined();
	});

	it("returns undefined for info/none messages", () => {
		expect(mapExtractorMessage({ logLevel: ExtractorLogLevel.Info, text: "fyi" } as never)).toBeUndefined();
	});
});
