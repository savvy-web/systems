import { describe, expect, it } from "vitest";
import type { Template, TemplateEntry, UpdateTemplate } from "../src/lib/types.js";

describe("TemplateEntry", () => {
	it("has required shape", () => {
		const entry: TemplateEntry = {
			name: "test",
			filename: "test.json",
			content: '{"hello": "world"}',
		};
		expect(entry.name).toBe("test");
		expect(entry.filename).toBe("test.json");
		expect(entry.content).toBe('{"hello": "world"}');
	});
});

describe("Template type", () => {
	it("accepts a function matching the signature", () => {
		const template: Template<{ name: string }> = (options) => [
			{ name: "test", filename: "test.txt", content: options.name },
		];
		const result = template({ name: "hello" });
		expect(result).toHaveLength(1);
		expect(result[0].content).toBe("hello");
	});
});

describe("UpdateTemplate type", () => {
	it("accepts existing content and partial options", () => {
		const update: UpdateTemplate<{ name: string; version: string }> = (existing, options) => [
			{ name: "test", filename: "test.txt", content: `${existing}-${options.name ?? "default"}` },
		];
		const result = update("original", { name: "updated" });
		expect(result[0].content).toBe("original-updated");
	});
});
