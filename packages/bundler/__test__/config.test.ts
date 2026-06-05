// packages/bundler/__test__/config.test.ts
import { describe, expect, it } from "vitest";
import { defineBuild, parseArgs } from "../src/config.js";

describe("defineBuild", () => {
	it("returns a normalized config with defaults (formats=esm, devManifest=preserve)", () => {
		const cfg = defineBuild({});
		expect(cfg.formats).toEqual(["esm"]);
		expect(cfg.devManifest).toBe("preserve");
		expect(cfg.externals).toEqual([]);
	});

	it("passes through externals and a transform", () => {
		const t = ({ pkg }: { pkg: Record<string, unknown> }) => pkg;
		const cfg = defineBuild({ externals: ["typescript"], transform: t });
		expect(cfg.externals).toEqual(["typescript"]);
		expect(cfg.transform).toBe(t);
	});

	it("carries the meta option through", () => {
		const c = defineBuild({
			meta: { localPaths: ["../models"], tsdoc: { tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }] } },
		});
		expect(c.meta?.localPaths).toEqual(["../models"]);
	});
});

describe("parseArgs", () => {
	it("defaults target to dev", () => {
		expect(parseArgs([])).toEqual({ target: "dev", watch: false });
	});
	it("parses --target npm and --watch", () => {
		expect(parseArgs(["--target", "npm", "--watch"])).toEqual({ target: "npm", watch: true });
	});
});
