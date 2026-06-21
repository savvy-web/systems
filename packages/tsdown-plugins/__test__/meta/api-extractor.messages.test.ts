import { ExtractorLogLevel } from "@microsoft/api-extractor";
import { describe, expect, it } from "vitest";
import { mapExtractorMessage } from "../../src/meta/api-extractor.js";

describe("mapExtractorMessage", () => {
	it("maps a warning message to an api-extractor DiagnosticInput", () => {
		const entry = mapExtractorMessage({
			logLevel: ExtractorLogLevel.Warning,
			messageId: "ae-forgotten-export",
			text: "ae-forgotten-export",
			sourceFilePath: "src/index.ts",
			sourceFileLine: 12,
			sourceFileColumn: 3,
		} as never);
		expect(entry).toEqual({
			source: "api-extractor",
			level: "warn",
			code: "ae-forgotten-export",
			text: "ae-forgotten-export",
			file: "src/index.ts",
			line: 12,
			column: 3,
		});
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
