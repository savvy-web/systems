import { describe, expect, it } from "vitest";
import { createVsCode } from "../src/lib/vscode/index.js";

describe("vscode template", () => {
	it("creates two entries: settings and extensions", () => {
		const result = createVsCode({});
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("vscode-settings");
		expect(result[0].filename).toBe(".vscode/settings.json");
		expect(result[1].name).toBe("vscode-extensions");
		expect(result[1].filename).toBe(".vscode/extensions.json");
	});

	it("includes formatOnSave by default", () => {
		const settings = JSON.parse(createVsCode({})[0].content);
		expect(settings["editor.formatOnSave"]).toBe(true);
	});

	it("adds biome settings when enabled", () => {
		const settings = JSON.parse(createVsCode({ settings: { biome: true } })[0].content);
		expect(settings["biome.enabled"]).toBe(true);
		expect(settings["editor.codeActionsOnSave"]["source.organizeImports.biome"]).toBe("explicit");
		expect(settings["editor.codeActionsOnSave"]["source.fixAll.biome"]).toBe("explicit");
	});

	it("adds vitest excludes when enabled", () => {
		const settings = JSON.parse(createVsCode({ settings: { vitest: true } })[0].content);
		expect(settings["search.exclude"]["**/.vitest"]).toBe(true);
		expect(settings["search.exclude"]["**/.coverage"]).toBe(true);
	});

	it("adds turbo excludes when enabled", () => {
		const settings = JSON.parse(createVsCode({ settings: { turbo: true } })[0].content);
		expect(settings["search.exclude"]["**/.turbo"]).toBe(true);
	});

	it("sorts and deduplicates extensions", () => {
		const extensions = JSON.parse(
			createVsCode({
				extensions: ["biomejs.biome", "eamodio.gitlens", "biomejs.biome"],
			})[1].content,
		);
		expect(extensions.recommendations).toEqual(["biomejs.biome", "eamodio.gitlens"]);
	});

	it("produces empty recommendations when no extensions given", () => {
		const extensions = JSON.parse(createVsCode({})[1].content);
		expect(extensions.recommendations).toEqual([]);
	});
});
