// packages/bundler/__test__/config.test.ts
import { defaultManifestTransform } from "@savvy-web/tsdown-plugins";
import { describe, expect, it } from "vitest";
import { defineBuild, parseArgs } from "../src/config.js";

describe("defineBuild", () => {
	it("returns a normalized config with defaults (formats=esm, devManifest=preserve)", () => {
		const cfg = defineBuild({});
		expect(cfg.formats).toEqual(["esm"]);
		expect(cfg.devManifest).toBe("preserve");
		expect(cfg.externals).toEqual([]);
	});

	it("defaults transform to defaultManifestTransform when none is provided", () => {
		const cfg = defineBuild({});
		expect(cfg.transform).toBe(defaultManifestTransform);
	});

	it("passes through externals and a transform (a custom transform REPLACES the default)", () => {
		const t = ({ pkg }: { pkg: Record<string, unknown> }) => pkg;
		const cfg = defineBuild({ externals: ["typescript"], transform: t });
		expect(cfg.externals).toEqual(["typescript"]);
		expect(cfg.transform).toBe(t);
	});

	it("carries the meta option through", () => {
		const c = defineBuild({
			meta: { localPaths: ["../models"], tsdoc: { tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }] } },
		});
		expect(c.meta).toEqual({
			localPaths: ["../models"],
			tsdoc: { tagDefinitions: [{ tagName: "@since", syntaxKind: "block" }] },
		});
	});

	it("carries meta:false through (explicit opt-out)", () => {
		expect(defineBuild({ meta: false }).meta).toBe(false);
	});

	it("passes exe through", () => {
		const c = defineBuild({ exe: { fileName: "tool" } });
		expect(c.exe).toEqual({ fileName: "tool" });
	});

	it("passes format through", () => {
		const c = defineBuild({ format: ["esm", "cjs"] });
		expect(c.format).toEqual(["esm", "cjs"]);
	});

	it("passes bundledPackages through", () => {
		const c = defineBuild({ bundledPackages: ["@commitlint/types"] });
		expect(c.bundledPackages).toEqual(["@commitlint/types"]);
	});

	it("defaults minify to false (prod output is unminified by default)", () => {
		expect(defineBuild({}).minify).toBe(false);
	});

	it("passes minify:true through", () => {
		expect(defineBuild({ minify: true }).minify).toBe(true);
	});

	it("passes bundle through and leaves it undefined when not provided", () => {
		expect(defineBuild({ bundle: ["semver-effect"] }).bundle).toEqual(["semver-effect"]);
		expect(defineBuild({}).bundle).toBeUndefined();
	});

	it("passes bundleNodeModules through", () => {
		const c = defineBuild({ bundleNodeModules: true });
		expect(c.bundleNodeModules).toBe(true);
	});

	it("passes dtsExternals through", () => {
		const c = defineBuild({ dtsExternals: ["effect", "@effect/platform"] });
		expect(c.dtsExternals).toEqual(["effect", "@effect/platform"]);
	});

	it("leaves dtsExternals undefined when not provided", () => {
		const c = defineBuild({});
		expect(c.dtsExternals).toBeUndefined();
	});

	it("passes overrides through and leaves them undefined when not provided", () => {
		const cfg = defineBuild({
			overrides: [{ entries: ["./changesets/markdownlint"], format: ["esm", "cjs"], bundle: ["x"] }],
		});
		expect(cfg.overrides).toEqual([{ entries: ["./changesets/markdownlint"], format: ["esm", "cjs"], bundle: ["x"] }]);
		expect(defineBuild({}).overrides).toBeUndefined();
	});

	it("defaults define to undefined when not provided", () => {
		expect(defineBuild({}).define).toBeUndefined();
	});

	it("carries a user define through unchanged", () => {
		const define = { "process.env.FLAG": JSON.stringify("on") };
		expect(defineBuild({ define }).define).toEqual(define);
	});
});

describe("parseArgs", () => {
	it("defaults target to dev", () => {
		expect(parseArgs([])).toEqual({ target: "dev", watch: false });
	});
	it("parses --target prod and --watch", () => {
		expect(parseArgs(["--target", "prod", "--watch"])).toEqual({ target: "prod", watch: true });
	});
});
