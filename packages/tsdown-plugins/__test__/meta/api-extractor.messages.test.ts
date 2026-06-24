import { ExtractorLogLevel } from "@microsoft/api-extractor";
import { describe, expect, it } from "vitest";
import { mapExtractorMessage } from "../../src/meta/api-extractor.js";

describe("mapExtractorMessage", () => {
	it("maps a warning message and preserves the source location", () => {
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

	it("preserves location for release-tag and unresolved-link codes alike", () => {
		for (const messageId of ["ae-missing-release-tag", "ae-incompatible-release-tags", "ae-unresolved-link"]) {
			const entry = mapExtractorMessage({
				logLevel: ExtractorLogLevel.Warning,
				messageId,
				text: `${messageId}: "SomeSymbol" ...`,
				sourceFilePath: "src/Real.ts",
				sourceFileLine: 11,
				sourceFileColumn: 46,
			} as never);
			expect(entry?.file).toBe("src/Real.ts");
			expect(entry?.line).toBe(11);
			expect(entry?.column).toBe(46);
		}
	});

	it("omits location fields that are undefined", () => {
		const entry = mapExtractorMessage({ logLevel: ExtractorLogLevel.Error, text: "boom" } as never);
		expect(entry?.level).toBe("error");
		expect(entry?.file).toBeUndefined();
	});

	it("returns undefined for info/none messages", () => {
		expect(mapExtractorMessage({ logLevel: ExtractorLogLevel.Info, text: "fyi" } as never)).toBeUndefined();
	});
});
